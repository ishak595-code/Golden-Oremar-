-- Order requests keep the product options the customer picked.
--
-- A line may carry the same selectedOptions.orderCustomization the cart sends.
-- It is normalised with the product's own option schema (unknown or hidden
-- choices are refused, exactly like the cart) and stored on the line together
-- with a readable summary ("Kesim: Kuşbaşı") for the admin list and the
-- WhatsApp message. The same variant may appear twice with different options.

create or replace function private.submit_order_request_v1(
  p_idempotency_key text,
  p_method text,
  p_source text,
  p_items jsonb,
  p_customer jsonb,
  p_consent boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  settings private.offline_order_settings%rowtype;
  config jsonb := private.get_public_offline_ordering_v1();
  existing private.order_requests%rowtype;
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
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
  line jsonb;
  priced jsonb := '[]'::jsonb;
  subtotal bigint := 0;
  weight integer := 0;
  quote jsonb;
  shipping bigint;
  reference_value text;
  attempt integer := 0;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  request_row private.order_requests%rowtype;
  v record;
  sellable integer;
  qty integer;
  customization jsonb;
  option_summary text;
  line_keys text[] := '{}'::text[];
  line_key text;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 100 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  select * into existing from private.order_requests where idempotency_key = p_idempotency_key;
  if existing.id is not null then
    return private.order_request_receipt_v1(existing.id);
  end if;

  if p_method not in ('whatsapp', 'bank_transfer') then raise exception 'invalid_order_method' using errcode = '22023'; end if;
  if p_method = 'whatsapp' and not coalesce((config#>>'{whatsapp,enabled}')::boolean, false) then raise exception 'order_method_unavailable' using errcode = '55000'; end if;
  if p_method = 'bank_transfer' and not coalesce((config#>>'{bankTransfer,enabled}')::boolean, false) then raise exception 'order_method_unavailable' using errcode = '55000'; end if;
  if coalesce(p_source, '') not in ('product', 'cart') then raise exception 'invalid_order_source' using errcode = '22023'; end if;
  if p_consent is not true then raise exception 'order_consent_required' using errcode = '22023'; end if;
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' or pg_column_size(p_customer) > 8192 then raise exception 'invalid_customer' using errcode = '22023'; end if;

  if char_length(name_value) not between 2 and 120 or name_value ~ '[[:cntrl:]]' then raise exception 'invalid_customer_name' using errcode = '22023'; end if;
  phone_digits := regexp_replace(phone_raw, '[^0-9]', '', 'g');
  if phone_raw like '+%' then
    phone_value := '+' || phone_digits;
  elsif phone_digits ~ '^5[0-9]{9}$' then
    phone_value := '+90' || phone_digits;
  elsif phone_digits ~ '^05[0-9]{9}$' then
    phone_value := '+9' || phone_digits;
  elsif phone_digits ~ '^905[0-9]{9}$' then
    phone_value := '+' || phone_digits;
  elsif phone_digits ~ '^00[1-9][0-9]{8,13}$' then
    phone_value := '+' || substr(phone_digits, 3);
  end if;
  if phone_value is null or phone_value !~ '^\+[0-9]{10,15}$' or (phone_value like '+90%' and phone_value !~ '^\+90[2-5][0-9]{9}$') then
    raise exception 'invalid_customer_phone' using errcode = '22023';
  end if;
  if email_value is not null and (char_length(email_value) > 254 or email_value !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then raise exception 'invalid_customer_email' using errcode = '22023'; end if;
  if char_length(province_value) not between 2 and 80 or char_length(district_value) not between 2 and 80 then raise exception 'invalid_customer_location' using errcode = '22023'; end if;
  if char_length(address_value) not between 10 and 500 then raise exception 'invalid_customer_address' using errcode = '22023'; end if;
  if note_value is not null and char_length(note_value) > 1000 then raise exception 'invalid_customer_note' using errcode = '22023'; end if;

  client_ip := coalesce(nullif(headers->>'cf-connecting-ip', ''), nullif(headers->>'x-real-ip', ''), nullif(btrim(split_part(coalesce(headers->>'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
  ip_digest := encode(sha256(convert_to('order-request:' || client_ip, 'UTF8')), 'hex');
  if (select count(*) from private.order_requests r where r.ip_hash = ip_digest and r.created_at > timezone('utc', now()) - interval '1 hour') >= 6
    or (select count(*) from private.order_requests r where r.phone = phone_value and r.created_at > timezone('utc', now()) - interval '1 day') >= 6
    or (select count(*) from private.order_requests r where r.created_at > timezone('utc', now()) - interval '1 hour') >= 400 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 or pg_column_size(p_items) > 65536 then raise exception 'invalid_order_items' using errcode = '22023'; end if;
  for line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(line) <> 'object' or coalesce(line->>'variantId', '') !~ '^[0-9a-fA-F-]{36}$' or coalesce(line->>'quantity', '') !~ '^[0-9]{1,3}$' then
      raise exception 'invalid_order_items' using errcode = '22023';
    end if;
    qty := (line->>'quantity')::integer;
    if qty not between 1 and 50 then raise exception 'invalid_order_quantity' using errcode = '22023'; end if;

    select pv.id, pv.name as variant_name, pv.price_minor, coalesce(pv.weight_grams, 0) as weight_grams,
      p.id as product_id, p.name as product_name, p.slug, p.currency, p.stock_mode,
      coalesce(i.available_quantity, 0) - coalesce(i.reserved_quantity, 0) as sellable
    into v
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.producers pr on pr.id = p.producer_id
    left join public.product_inventory i on i.variant_id = pv.id
    where pv.id = (line->>'variantId')::uuid and pv.is_active and pv.price_minor > 0
      and p.status = 'published' and p.is_active and p.deleted_at is null
      and pr.status = 'active' and pr.is_verified and pr.deleted_at is null;
    if not found then raise exception 'product_not_available' using errcode = 'P0002'; end if;
    customization := null;
    option_summary := null;
    if jsonb_typeof(line->'selectedOptions') = 'object' and (line->'selectedOptions') ? 'orderCustomization' then
      customization := private.normalize_order_customization_v1(v.product_id, line->'selectedOptions'->'orderCustomization');
      select string_agg((l.value->>'group') || ': ' || (l.value->>'choice'), ' · ' order by l.key)
        into option_summary from jsonb_each(coalesce(customization->'labels', '{}'::jsonb)) l;
    end if;
    line_key := v.id::text || ':' || coalesce((customization->'choices')::text, '');
    if line_key = any(line_keys) then raise exception 'duplicate_order_items' using errcode = '22023'; end if;
    line_keys := line_keys || line_key;
    if v.currency <> 'TRY' then raise exception 'mixed_currency_cart_not_supported' using errcode = '22023'; end if;
    if v.stock_mode in ('tracked', 'seasonal') then
      sellable := greatest(0, v.sellable);
      if qty > sellable then raise exception 'insufficient_stock:%', sellable using errcode = '22023'; end if;
    end if;

    priced := priced || jsonb_build_array(jsonb_build_object(
      'variantId', v.id::text, 'productId', v.product_id::text, 'slug', v.slug,
      'productName', v.product_name, 'variantName', v.variant_name,
      'quantity', qty, 'unitPriceMinor', v.price_minor, 'lineTotalMinor', v.price_minor * qty,
      'options', option_summary, 'customization', customization));
    subtotal := subtotal + v.price_minor * qty;
    weight := weight + greatest(v.weight_grams, 0) * qty;
  end loop;

  quote := public.get_shipping_quote_v1('TR', greatest(weight, 1000), subtotal, 'TRY');
  if coalesce((quote->>'available')::boolean, false) then shipping := (quote->>'shippingMinor')::bigint; end if;

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
    province_value, district_value, address_value, note_value, priced, 'TRY', subtotal, shipping,
    subtotal + coalesce(shipping, 0), timezone('utc', now()), ip_digest, left(coalesce(headers->>'user-agent', ''), 400),
    jsonb_build_array(jsonb_build_object('status', 'new', 'at', timezone('utc', now()), 'by', 'customer')))
  on conflict (idempotency_key) do nothing
  returning * into request_row;

  if request_row.id is null then
    select * into request_row from private.order_requests where idempotency_key = p_idempotency_key;
  end if;
  return private.order_request_receipt_v1(request_row.id);
end;
$function$;
