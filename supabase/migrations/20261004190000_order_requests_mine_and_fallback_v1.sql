-- WhatsApp / Havale-EFT orders in "Siparişlerim", and orders that must not be
-- lost when the normal order path fails.
--
-- 1. list_my_order_requests_v1: a signed-in customer sees the order requests
--    placed from their account (order_requests.customer_user_id). Until now
--    they only reached the admin list, so Siparişlerim never showed them.
--
-- 2. submit_order_request_fallback_v1: when submit_order_request_v1 fails
--    for a server-side reason (5xx, a broken shipping quote, ...) while the
--    database itself still answers, the storefront records the order here
--    instead of only opening WhatsApp. It is deliberately simpler than the
--    normal path: no shipping quote, no stock reservation, the order note says
--    so. Prices come from the database where the variant still exists; only
--    otherwise the shown price is stored and marked unverified, so the store
--    confirms the total with the customer (as it does for every WhatsApp
--    order). The same key as the failed attempt is used, so a retry, the
--    normal path and this path can never create two orders.
--    It is also what a device uses to sync an order that was sent on WhatsApp
--    while the backend was completely down, if the normal path refuses it
--    later (for example stock changed in between): the customer already sent
--    it, so the store must still see it.

create or replace function private.list_my_order_requests_v1(p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from private.order_requests r where r.customer_user_id = caller_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'reference', r.reference,
          'idempotencyKey', r.idempotency_key,
          'method', r.method,
          'status', r.status,
          'items', (select coalesce(jsonb_agg(jsonb_build_object(
              'productName', l->>'productName', 'variantName', l->>'variantName', 'options', l->>'options',
              'quantity', (l->>'quantity')::integer, 'lineTotalMinor', (l->>'lineTotalMinor')::bigint, 'slug', l->>'slug')), '[]'::jsonb)
            from jsonb_array_elements(r.items) l),
          'currency', r.currency,
          'subtotalMinor', r.subtotal_minor,
          'shippingMinor', r.shipping_minor,
          'totalMinor', r.total_minor,
          'pricesVerified', not exists (select 1 from jsonb_array_elements(r.items) l where coalesce((l->>'priceUnverified')::boolean, false)),
          'createdAt', r.created_at,
          'updatedAt', r.updated_at)
        order by r.created_at desc)
      from (select * from private.order_requests r0 where r0.customer_user_id = caller_id order by r0.created_at desc limit p_limit offset p_offset) r
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.submit_order_request_fallback_v1(
  p_idempotency_key text, p_method text, p_source text, p_items jsonb, p_customer jsonb, p_consent boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  headers jsonb;
  client_ip text;
  ip_digest text;
  name_value text := btrim(coalesce(p_customer->>'name', ''));
  phone_raw text := regexp_replace(coalesce(p_customer->>'phone', ''), '[^0-9+]', '', 'g');
  phone_digits text;
  phone_value text;
  email_value text := nullif(lower(btrim(coalesce(p_customer->>'email', ''))), '');
  province_value text := btrim(coalesce(p_customer->>'province', ''));
  district_value text := btrim(coalesce(p_customer->>'district', ''));
  address_value text := btrim(coalesce(p_customer->>'addressLine', ''));
  note_value text := nullif(btrim(coalesce(p_customer->>'note', '')), '');
  reason_value text := case when p_reason = 'offline_sync' then 'offline_sync' else 'order_path_failed' end;
  line jsonb;
  priced jsonb := '[]'::jsonb;
  subtotal bigint := 0;
  qty integer;
  client_price bigint;
  db_price bigint;
  db_product_id uuid;
  db_slug text;
  db_product_name text;
  db_variant_name text;
  any_unverified boolean := false;
  reference_value text;
  attempt integer := 0;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  request_row private.order_requests%rowtype;
  whatsapp_number text;
  marker text;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 100 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  begin whatsapp_number := (private.get_public_offline_ordering_v1())#>>'{whatsapp,number}'; exception when others then whatsapp_number := null; end;

  select * into request_row from private.order_requests where idempotency_key = p_idempotency_key;
  if request_row.id is null then
    if p_method not in ('whatsapp', 'bank_transfer') then raise exception 'invalid_order_method' using errcode = '22023'; end if;
    if coalesce(p_source, '') not in ('product', 'cart') then raise exception 'invalid_order_source' using errcode = '22023'; end if;
    if p_consent is not true then raise exception 'order_consent_required' using errcode = '22023'; end if;
    if p_customer is null or jsonb_typeof(p_customer) <> 'object' or pg_column_size(p_customer) > 8192 then raise exception 'invalid_customer' using errcode = '22023'; end if;
    if char_length(name_value) not between 2 and 120 or name_value ~ '[[:cntrl:]]' then raise exception 'invalid_customer_name' using errcode = '22023'; end if;
    phone_digits := regexp_replace(phone_raw, '[^0-9]', '', 'g');
    if phone_raw like '+%' then phone_value := '+' || phone_digits;
    elsif phone_digits ~ '^5[0-9]{9}$' then phone_value := '+90' || phone_digits;
    elsif phone_digits ~ '^05[0-9]{9}$' then phone_value := '+9' || phone_digits;
    elsif phone_digits ~ '^905[0-9]{9}$' then phone_value := '+' || phone_digits;
    elsif phone_digits ~ '^00[1-9][0-9]{8,13}$' then phone_value := '+' || substr(phone_digits, 3);
    end if;
    if phone_value is null or phone_value !~ '^\+[0-9]{10,15}$' or (phone_value like '+90%' and phone_value !~ '^\+90[2-5][0-9]{9}$') then
      raise exception 'invalid_customer_phone' using errcode = '22023';
    end if;
    if email_value is not null and (char_length(email_value) > 254 or email_value !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then raise exception 'invalid_customer_email' using errcode = '22023'; end if;
    if char_length(province_value) not between 2 and 80 or char_length(district_value) not between 2 and 80 then raise exception 'invalid_customer_location' using errcode = '22023'; end if;
    if char_length(address_value) not between 10 and 500 then raise exception 'invalid_customer_address' using errcode = '22023'; end if;

    begin headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb); exception when others then headers := '{}'::jsonb; end;
    client_ip := coalesce(nullif(headers->>'cf-connecting-ip', ''), nullif(headers->>'x-real-ip', ''), nullif(btrim(split_part(coalesce(headers->>'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
    ip_digest := encode(sha256(convert_to('order-request:' || client_ip, 'UTF8')), 'hex');
    if (select count(*) from private.order_requests r where r.ip_hash = ip_digest and r.created_at > timezone('utc', now()) - interval '1 hour') >= 6
      or (select count(*) from private.order_requests r where r.phone = phone_value and r.created_at > timezone('utc', now()) - interval '1 day') >= 6
      or (select count(*) from private.order_requests r where r.created_at > timezone('utc', now()) - interval '1 hour') >= 400 then
      raise exception 'rate_limit_exceeded' using errcode = 'P0001';
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 or pg_column_size(p_items) > 65536 then raise exception 'invalid_order_items' using errcode = '22023'; end if;
    for line in select value from jsonb_array_elements(p_items) loop
      if jsonb_typeof(line) <> 'object' or coalesce(line->>'variantId', '') !~ '^[0-9a-fA-F-]{36}$' or coalesce(line->>'quantity', '') !~ '^[0-9]{1,3}$'
        or coalesce(line->>'unitPriceMinor', '') !~ '^[0-9]{1,10}$' or char_length(coalesce(line->>'productName', '')) not between 1 and 200 or char_length(coalesce(line->>'variantName', '')) > 200 then
        raise exception 'invalid_order_items' using errcode = '22023';
      end if;
      qty := (line->>'quantity')::integer;
      client_price := (line->>'unitPriceMinor')::bigint;
      if qty not between 1 and 50 then raise exception 'invalid_order_quantity' using errcode = '22023'; end if;
      if client_price <= 0 then raise exception 'invalid_order_items' using errcode = '22023'; end if;
      db_price := null; db_product_id := null; db_slug := null; db_product_name := null; db_variant_name := null;
      begin
        select pv.price_minor, p.id, p.slug, p.name, pv.name
          into db_price, db_product_id, db_slug, db_product_name, db_variant_name
          from public.product_variants pv join public.products p on p.id = pv.product_id
          where pv.id = (line->>'variantId')::uuid and pv.price_minor > 0;
      exception when others then
        db_price := null; db_product_id := null; db_slug := null; db_product_name := null; db_variant_name := null;
      end;
      priced := priced || jsonb_build_array(jsonb_build_object(
        'variantId', line->>'variantId',
        'productId', db_product_id::text,
        'slug', coalesce(db_slug, left(coalesce(line->>'slug', ''), 220)),
        'productName', coalesce(db_product_name, line->>'productName'),
        'variantName', coalesce(db_variant_name, nullif(line->>'variantName', '')),
        'quantity', qty,
        'unitPriceMinor', coalesce(db_price, client_price),
        'lineTotalMinor', coalesce(db_price, client_price) * qty,
        'options', nullif(left(coalesce(line->>'options', ''), 300), ''),
        'customization', null,
        'priceUnverified', db_price is null));
      any_unverified := any_unverified or db_price is null;
      subtotal := subtotal + coalesce(db_price, client_price) * qty;
    end loop;

    marker := case reason_value
      when 'offline_sync' then '[Bağlantı yokken WhatsApp ile gönderildi; cihaz bağlantı gelince kaydetti. Stok ayrılmadı, kargo onayda.'
      else '[Sipariş sistemi yanıt vermediği için yedek yoldan kaydedildi. Stok ayrılmadı, kargo onayda.' end
      || case when any_unverified then ' Bazı fiyatlar doğrulanmadı.' else '' end || ']';
    note_value := left(marker || coalesce(' ' || note_value, ''), 1000);

    loop
      attempt := attempt + 1;
      reference_value := 'GO-' || to_char(timezone('Europe/Istanbul', now()), 'YYMMDD') || '-' ||
        (select string_agg(substr(alphabet, 1 + floor(random() * char_length(alphabet))::integer, 1), '') from generate_series(1, 4));
      exit when not exists (select 1 from private.order_requests r where r.reference = reference_value);
      if attempt > 20 then raise exception 'order_reference_unavailable' using errcode = '55000'; end if;
    end loop;

    insert into private.order_requests (
      reference, idempotency_key, method, source, customer_user_id, customer_name, phone, email,
      province, district, address_line, customer_note, items, currency, subtotal_minor, shipping_minor,
      total_minor, consent_at, ip_hash, user_agent, status_history)
    values (
      reference_value, p_idempotency_key, p_method, p_source, caller_id, name_value, phone_value, email_value,
      province_value, district_value, address_value, note_value, priced, 'TRY', subtotal, null,
      subtotal, timezone('utc', now()), ip_digest, left(coalesce(headers->>'user-agent', ''), 400),
      jsonb_build_array(jsonb_build_object('status', 'new', 'at', timezone('utc', now()), 'by', 'customer', 'via', reason_value)))
    on conflict (idempotency_key) do nothing
    returning * into request_row;
    if request_row.id is null then
      select * into request_row from private.order_requests where idempotency_key = p_idempotency_key;
    end if;
  end if;

  return jsonb_build_object(
    'reference', request_row.reference,
    'method', request_row.method,
    'status', request_row.status,
    'items', request_row.items,
    'currency', request_row.currency,
    'subtotalMinor', request_row.subtotal_minor,
    'shippingMinor', request_row.shipping_minor,
    'totalMinor', request_row.total_minor,
    'customerName', request_row.customer_name,
    'createdAt', request_row.created_at,
    'whatsappNumber', whatsapp_number,
    'bankTransfer', null,
    'fallback', true);
end;
$$;

revoke all on function private.list_my_order_requests_v1(integer, integer) from public, anon, authenticated;
grant execute on function private.list_my_order_requests_v1(integer, integer) to authenticated;
create or replace function public.list_my_order_requests_v1(p_limit integer default 20, p_offset integer default 0)
returns jsonb language sql set search_path = ''
as $$ select private.list_my_order_requests_v1(p_limit, p_offset); $$;
revoke all on function public.list_my_order_requests_v1(integer, integer) from public, anon;
grant execute on function public.list_my_order_requests_v1(integer, integer) to authenticated;

-- Guests order too: same bridge as submit_order_request_v1 (anon has no access to schema private).
revoke all on function private.submit_order_request_fallback_v1(text, text, text, jsonb, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function private.submit_order_request_fallback_v1(text, text, text, jsonb, jsonb, boolean, text) to service_role;
create or replace function api_public_bridge.submit_order_request_fallback_v1(
  p_idempotency_key text, p_method text, p_source text, p_items jsonb, p_customer jsonb, p_consent boolean, p_reason text)
returns jsonb language sql security definer set search_path = ''
as $$ select private.submit_order_request_fallback_v1(p_idempotency_key, p_method, p_source, p_items, p_customer, p_consent, p_reason); $$;
revoke all on function api_public_bridge.submit_order_request_fallback_v1(text, text, text, jsonb, jsonb, boolean, text) from public, anon, authenticated, service_role;
grant execute on function api_public_bridge.submit_order_request_fallback_v1(text, text, text, jsonb, jsonb, boolean, text) to anon, authenticated, service_role;
create or replace function public.submit_order_request_fallback_v1(
  p_idempotency_key text, p_method text, p_source text, p_items jsonb, p_customer jsonb, p_consent boolean, p_reason text default 'order_path_failed')
returns jsonb language sql set search_path = ''
as $$ select api_public_bridge.submit_order_request_fallback_v1(p_idempotency_key, p_method, p_source, p_items, p_customer, p_consent, p_reason); $$;
revoke all on function public.submit_order_request_fallback_v1(text, text, text, jsonb, jsonb, boolean, text) from public;
grant execute on function public.submit_order_request_fallback_v1(text, text, text, jsonb, jsonb, boolean, text) to anon, authenticated, service_role;
