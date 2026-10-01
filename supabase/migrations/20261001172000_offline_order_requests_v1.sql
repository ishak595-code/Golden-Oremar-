-- Orders without online payment: WhatsApp and bank transfer (Havale/EFT).
--
-- Until card payment is switched on, customers (guests included) can still
-- order. The storefront sends the chosen variants, quantities, contact and
-- delivery details; the database prices everything itself (client prices are
-- never trusted), checks that each product is published and in stock,
-- computes shipping with the same zone rules as checkout, and returns a
-- reference code. WhatsApp orders continue in the chat with that code; bank
-- transfer orders get the store's IBAN details and pay with the code in the
-- description.
--
-- Super Admin manages the channels and bank accounts (payment.manage) and
-- works the requests in the admin panel (order.read / order.update). Stock is
-- taken when a request is confirmed and given back if a confirmed request is
-- cancelled, so stock never goes negative from this path.

create table if not exists private.offline_order_settings (
  id boolean primary key default true check (id),
  whatsapp_enabled boolean not null default true,
  bank_transfer_enabled boolean not null default true,
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,15}$'),
  bank_accounts jsonb not null default '[]'::jsonb check (jsonb_typeof(bank_accounts) = 'array'),
  payment_window_hours integer not null default 48 check (payment_window_hours between 1 and 240),
  customer_note text check (customer_note is null or char_length(customer_note) <= 600),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid
);
insert into private.offline_order_settings (id) values (true) on conflict (id) do nothing;
alter table private.offline_order_settings enable row level security;

create table if not exists private.order_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^GO-[0-9]{6}-[A-Z0-9]{4}$'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 100),
  method text not null check (method in ('whatsapp', 'bank_transfer')),
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled')),
  source text not null default 'cart' check (source in ('product', 'cart')),
  customer_user_id uuid,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  phone text not null check (phone ~ '^\+[0-9]{10,15}$'),
  email text check (email is null or char_length(email) <= 254),
  province text not null check (char_length(province) between 2 and 80),
  district text not null check (char_length(district) between 2 and 80),
  address_line text not null check (char_length(address_line) between 10 and 500),
  customer_note text check (customer_note is null or char_length(customer_note) <= 1000),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  currency text not null default 'TRY',
  subtotal_minor bigint not null check (subtotal_minor > 0),
  shipping_minor bigint check (shipping_minor is null or shipping_minor >= 0),
  total_minor bigint not null check (total_minor > 0),
  consent_at timestamptz not null,
  stock_committed boolean not null default false,
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  user_agent text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists order_requests_status_created_idx on private.order_requests (status, created_at desc);
create index if not exists order_requests_ip_created_idx on private.order_requests (ip_hash, created_at desc);
create index if not exists order_requests_phone_created_idx on private.order_requests (phone, created_at desc);
create index if not exists order_requests_customer_idx on private.order_requests (customer_user_id, created_at desc) where customer_user_id is not null;
alter table private.order_requests enable row level security;

-- IBANs are checked with the existing private.is_valid_tr_iban_v1 (TR, mod-97).

-- WhatsApp number used for orders: the dedicated one, or the contact one.
create or replace function private.offline_order_whatsapp_digits_v1()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select s.whatsapp_number from private.offline_order_settings s where s.id),
    nullif(regexp_replace(coalesce((select b.public_config#>>'{contactInfo,whatsapp}' from public.brand_settings b where b.slug = 'golden-oremar'), ''), '[^0-9]', '', 'g'), '')
  );
$function$;

create or replace function private.get_public_offline_ordering_v1()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with s as (select * from private.offline_order_settings where id),
  wa as (select private.offline_order_whatsapp_digits_v1() as digits),
  accounts as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'bankName', a->>'bankName', 'accountHolder', a->>'accountHolder', 'iban', a->>'iban', 'branch', nullif(a->>'branch', ''))
      order by ord), '[]'::jsonb) as list
    from s, jsonb_array_elements(s.bank_accounts) with ordinality as x(a, ord)
    where coalesce((a->>'active')::boolean, true)
  )
  select jsonb_build_object(
    'whatsapp', jsonb_build_object(
      'enabled', s.whatsapp_enabled and wa.digits ~ '^[0-9]{10,15}$',
      'number', case when s.whatsapp_enabled and wa.digits ~ '^[0-9]{10,15}$' then wa.digits end),
    'bankTransfer', jsonb_build_object(
      'enabled', s.bank_transfer_enabled and jsonb_array_length(accounts.list) > 0,
      'accounts', case when s.bank_transfer_enabled then accounts.list else '[]'::jsonb end,
      'paymentWindowHours', s.payment_window_hours),
    'note', s.customer_note
  )
  from s, wa, accounts;
$function$;

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

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'invalid_order_items' using errcode = '22023'; end if;
  for line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(line) <> 'object' or coalesce(line->>'variantId', '') !~ '^[0-9a-fA-F-]{36}$' or coalesce(line->>'quantity', '') !~ '^[0-9]{1,3}$' then
      raise exception 'invalid_order_items' using errcode = '22023';
    end if;
    qty := (line->>'quantity')::integer;
    if qty not between 1 and 50 then raise exception 'invalid_order_quantity' using errcode = '22023'; end if;
    if priced @> jsonb_build_array(jsonb_build_object('variantId', lower(line->>'variantId'))) then raise exception 'duplicate_order_items' using errcode = '22023'; end if;

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
    if v.currency <> 'TRY' then raise exception 'mixed_currency_cart_not_supported' using errcode = '22023'; end if;
    if v.stock_mode in ('tracked', 'seasonal') then
      sellable := greatest(0, v.sellable);
      if qty > sellable then raise exception 'insufficient_stock:%', sellable using errcode = '22023'; end if;
    end if;

    priced := priced || jsonb_build_array(jsonb_build_object(
      'variantId', v.id::text, 'productId', v.product_id::text, 'slug', v.slug,
      'productName', v.product_name, 'variantName', v.variant_name,
      'quantity', qty, 'unitPriceMinor', v.price_minor, 'lineTotalMinor', v.price_minor * qty));
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

create or replace function private.order_request_receipt_v1(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'reference', r.reference,
    'method', r.method,
    'status', r.status,
    'items', r.items,
    'currency', r.currency,
    'subtotalMinor', r.subtotal_minor,
    'shippingMinor', r.shipping_minor,
    'totalMinor', r.total_minor,
    'customerName', r.customer_name,
    'createdAt', r.created_at,
    'whatsappNumber', (private.get_public_offline_ordering_v1())#>>'{whatsapp,number}',
    'bankTransfer', case when r.method = 'bank_transfer' then (private.get_public_offline_ordering_v1())->'bankTransfer' end
  )
  from private.order_requests r where r.id = p_id;
$function$;

-- Admin: channel settings ---------------------------------------------------

create or replace function private.admin_get_offline_ordering_settings_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare s private.offline_order_settings%rowtype;
begin
  if auth.uid() is null or not (coalesce(private.has_permission('payment.manage'), false) or coalesce(private.has_permission('payment.read'), false)) then
    raise exception 'permission_required:payment.manage' using errcode = '42501';
  end if;
  select * into s from private.offline_order_settings where id;
  return jsonb_build_object(
    'whatsappEnabled', s.whatsapp_enabled,
    'bankTransferEnabled', s.bank_transfer_enabled,
    'whatsappNumber', s.whatsapp_number,
    'contactWhatsappNumber', nullif(regexp_replace(coalesce((select b.public_config#>>'{contactInfo,whatsapp}' from public.brand_settings b where b.slug = 'golden-oremar'), ''), '[^0-9]', '', 'g'), ''),
    'bankAccounts', s.bank_accounts,
    'paymentWindowHours', s.payment_window_hours,
    'customerNote', s.customer_note,
    'updatedAt', s.updated_at,
    'canManage', coalesce(private.has_permission('payment.manage'), false),
    'public', private.get_public_offline_ordering_v1());
end;
$function$;

create or replace function private.admin_update_offline_ordering_settings_v1(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  before_row jsonb;
  accounts jsonb := '[]'::jsonb;
  account jsonb;
  iban text;
  number_value text;
  window_value integer;
  note_value text;
begin
  if caller_id is null or not coalesce(private.has_permission('payment.manage'), false) then
    raise exception 'permission_required:payment.manage' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 16384 then raise exception 'invalid_settings_payload' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_payload->'bankAccounts', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payload->'bankAccounts', '[]'::jsonb)) > 5 then
    raise exception 'invalid_bank_accounts' using errcode = '22023';
  end if;
  for account in select value from jsonb_array_elements(coalesce(p_payload->'bankAccounts', '[]'::jsonb)) loop
    iban := upper(regexp_replace(coalesce(account->>'iban', ''), '\s', '', 'g'));
    if not private.is_valid_tr_iban_v1(iban) then raise exception 'invalid_iban' using errcode = '22023'; end if;
    if char_length(btrim(coalesce(account->>'bankName', ''))) not between 2 and 80 then raise exception 'invalid_bank_name' using errcode = '22023'; end if;
    if char_length(btrim(coalesce(account->>'accountHolder', ''))) not between 2 and 140 then raise exception 'invalid_account_holder' using errcode = '22023'; end if;
    if char_length(btrim(coalesce(account->>'branch', ''))) > 80 then raise exception 'invalid_bank_branch' using errcode = '22023'; end if;
    accounts := accounts || jsonb_build_array(jsonb_build_object(
      'bankName', btrim(account->>'bankName'),
      'accountHolder', btrim(account->>'accountHolder'),
      'iban', substr(iban, 1, 4) || ' ' || substr(iban, 5, 4) || ' ' || substr(iban, 9, 4) || ' ' || substr(iban, 13, 4) || ' ' || substr(iban, 17, 4) || ' ' || substr(iban, 21, 4) || ' ' || substr(iban, 25, 2),
      'branch', nullif(btrim(coalesce(account->>'branch', '')), ''),
      'active', coalesce((account->>'active')::boolean, true)));
  end loop;

  number_value := nullif(regexp_replace(coalesce(p_payload->>'whatsappNumber', ''), '[^0-9]', '', 'g'), '');
  if number_value is not null and number_value ~ '^05[0-9]{9}$' then number_value := '9' || number_value; end if;
  if number_value is not null and number_value ~ '^5[0-9]{9}$' then number_value := '90' || number_value; end if;
  if number_value is not null and number_value !~ '^[0-9]{10,15}$' then raise exception 'invalid_whatsapp_number' using errcode = '22023'; end if;
  window_value := coalesce(nullif(p_payload->>'paymentWindowHours', '')::integer, 48);
  if window_value not between 1 and 240 then raise exception 'invalid_payment_window' using errcode = '22023'; end if;
  note_value := nullif(btrim(coalesce(p_payload->>'customerNote', '')), '');
  if note_value is not null and char_length(note_value) > 600 then raise exception 'invalid_customer_note' using errcode = '22023'; end if;

  select to_jsonb(s) into before_row from private.offline_order_settings s where s.id;
  update private.offline_order_settings set
    whatsapp_enabled = coalesce((p_payload->>'whatsappEnabled')::boolean, whatsapp_enabled),
    bank_transfer_enabled = coalesce((p_payload->>'bankTransferEnabled')::boolean, bank_transfer_enabled),
    whatsapp_number = number_value,
    bank_accounts = accounts,
    payment_window_hours = window_value,
    customer_note = note_value,
    updated_at = timezone('utc', now()),
    updated_by = caller_id
  where id;

  perform private.write_admin_audit_v2('payment.offline_ordering_updated', 'offline_order_settings', 'singleton',
    before_row - 'bank_accounts' || jsonb_build_object('bankAccountCount', jsonb_array_length(coalesce(before_row->'bank_accounts', '[]'::jsonb))),
    jsonb_build_object('bankAccountCount', jsonb_array_length(accounts), 'whatsappEnabled', p_payload->'whatsappEnabled', 'bankTransferEnabled', p_payload->'bankTransferEnabled'),
    '{}'::jsonb, null);
  return private.admin_get_offline_ordering_settings_v1();
end;
$function$;

-- Admin: requests -----------------------------------------------------------

create or replace function private.admin_list_order_requests_v1(p_status text default 'open', p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  q text := lower(btrim(coalesce(p_query, '')));
  state_value text := lower(btrim(coalesce(p_status, 'open')));
begin
  if auth.uid() is null or not coalesce(private.has_permission('order.read'), false) then
    raise exception 'permission_required:order.read' using errcode = '42501';
  end if;
  if state_value not in ('open', 'all', 'new', 'contacted', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled') then raise exception 'invalid_status_filter' using errcode = '22023'; end if;
  if char_length(q) > 120 then raise exception 'search_query_too_long' using errcode = '22023'; end if;
  if p_limit not between 1 and 200 or p_offset < 0 then raise exception 'invalid_pagination' using errcode = '22023'; end if;
  return (
    with filtered as (
      select r.* from private.order_requests r
      where (state_value = 'all'
          or (state_value = 'open' and r.status in ('new', 'contacted', 'confirmed', 'paid'))
          or r.status = state_value)
        and (q = '' or lower(r.reference) like '%' || q || '%' or lower(r.customer_name) like '%' || q || '%'
          or r.phone like '%' || regexp_replace(q, '[^0-9]', '', 'g') || '%' and regexp_replace(q, '[^0-9]', '', 'g') <> '')
    )
    select jsonb_build_object(
      'counts', (select jsonb_object_agg(s.status, s.n) from (select status, count(*) n from private.order_requests group by status) s),
      'total', (select count(*) from filtered),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
          'id', f.id, 'reference', f.reference, 'method', f.method, 'status', f.status, 'source', f.source,
          'guest', f.customer_user_id is null, 'customerName', f.customer_name, 'phone', f.phone, 'email', f.email,
          'province', f.province, 'district', f.district, 'addressLine', f.address_line, 'customerNote', f.customer_note,
          'items', f.items, 'currency', f.currency, 'subtotalMinor', f.subtotal_minor, 'shippingMinor', f.shipping_minor,
          'totalMinor', f.total_minor, 'stockCommitted', f.stock_committed, 'adminNote', f.admin_note,
          'statusHistory', f.status_history, 'createdAt', f.created_at, 'updatedAt', f.updated_at)
          order by f.created_at desc)
        from (select * from filtered order by created_at desc limit p_limit offset p_offset) f), '[]'::jsonb)
    )
  );
end;
$function$;

create or replace function private.admin_update_order_request_v1(p_id uuid, p_status text, p_admin_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  r private.order_requests%rowtype;
  next_status text := lower(btrim(coalesce(p_status, '')));
  note_value text := nullif(btrim(coalesce(p_admin_note, '')), '');
  committing boolean;
  line jsonb;
  updated_rows integer;
begin
  if caller_id is null or not coalesce(private.has_permission('order.update'), false) then
    raise exception 'permission_required:order.update' using errcode = '42501';
  end if;
  if next_status not in ('new', 'contacted', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled') then raise exception 'invalid_order_request_status' using errcode = '22023'; end if;
  if note_value is not null and char_length(note_value) > 2000 then raise exception 'invalid_admin_note' using errcode = '22023'; end if;
  select * into r from private.order_requests where id = p_id for update;
  if r.id is null then raise exception 'order_request_not_found' using errcode = 'P0002'; end if;
  if r.status in ('completed', 'cancelled') and next_status <> r.status then raise exception 'order_request_closed' using errcode = '55000'; end if;

  committing := next_status in ('confirmed', 'paid', 'shipped', 'completed') and not r.stock_committed;
  if committing then
    for line in select value from jsonb_array_elements(r.items) loop
      update public.product_inventory i
      set available_quantity = i.available_quantity - (line->>'quantity')::integer,
          version = i.version + 1, updated_at = timezone('utc', now())
      from public.products p, public.product_variants v
      where i.variant_id = (line->>'variantId')::uuid and v.id = i.variant_id and p.id = v.product_id
        and p.stock_mode in ('tracked', 'seasonal')
        and i.available_quantity - coalesce(i.reserved_quantity, 0) >= (line->>'quantity')::integer;
      get diagnostics updated_rows = row_count;
      if updated_rows = 0 and exists (
        select 1 from public.product_variants v join public.products p on p.id = v.product_id
        where v.id = (line->>'variantId')::uuid and p.stock_mode in ('tracked', 'seasonal')) then
        raise exception 'insufficient_stock:%', line->>'productName' using errcode = '22023';
      end if;
    end loop;
  elsif next_status = 'cancelled' and r.stock_committed then
    for line in select value from jsonb_array_elements(r.items) loop
      update public.product_inventory i
      set available_quantity = i.available_quantity + (line->>'quantity')::integer,
          version = i.version + 1, updated_at = timezone('utc', now())
      from public.products p, public.product_variants v
      where i.variant_id = (line->>'variantId')::uuid and v.id = i.variant_id and p.id = v.product_id
        and p.stock_mode in ('tracked', 'seasonal');
    end loop;
  end if;

  update private.order_requests set
    status = next_status,
    stock_committed = case when committing then true when next_status = 'cancelled' then false else stock_committed end,
    admin_note = coalesce(note_value, admin_note),
    status_history = case when next_status <> r.status
      then status_history || jsonb_build_array(jsonb_build_object('status', next_status, 'at', timezone('utc', now()), 'by', caller_id))
      else status_history end,
    updated_at = timezone('utc', now())
  where id = r.id;

  perform private.write_admin_audit_v2('order_request.updated', 'order_request', r.id::text,
    jsonb_build_object('status', r.status, 'stockCommitted', r.stock_committed),
    jsonb_build_object('status', next_status, 'stockCommitted', committing or (r.stock_committed and next_status <> 'cancelled')),
    jsonb_build_object('reference', r.reference), null);

  return jsonb_build_object('id', r.id, 'reference', r.reference, 'status', next_status);
end;
$function$;

-- Exposure ------------------------------------------------------------------

revoke all on function private.offline_order_whatsapp_digits_v1() from public, anon, authenticated;
revoke all on function private.get_public_offline_ordering_v1() from public, anon, authenticated;
revoke all on function private.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function private.order_request_receipt_v1(uuid) from public, anon, authenticated;
grant execute on function private.get_public_offline_ordering_v1() to service_role;
grant execute on function private.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) to service_role;

create or replace function api_public_bridge.get_public_offline_ordering_v1()
returns jsonb language sql stable security definer set search_path to ''
as $function$ select private.get_public_offline_ordering_v1(); $function$;
create or replace function api_public_bridge.submit_order_request_v1(p_idempotency_key text, p_method text, p_source text, p_items jsonb, p_customer jsonb, p_consent boolean)
returns jsonb language sql volatile security definer set search_path to ''
as $function$ select private.submit_order_request_v1(p_idempotency_key, p_method, p_source, p_items, p_customer, p_consent); $function$;
revoke all on function api_public_bridge.get_public_offline_ordering_v1() from public, anon, authenticated, service_role;
revoke all on function api_public_bridge.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
grant execute on function api_public_bridge.get_public_offline_ordering_v1() to anon, authenticated, service_role;
grant execute on function api_public_bridge.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) to anon, authenticated, service_role;

create or replace function public.get_public_offline_ordering_v1()
returns jsonb language sql stable security invoker set search_path to ''
as $function$ select api_public_bridge.get_public_offline_ordering_v1(); $function$;
create or replace function public.submit_order_request_v1(p_idempotency_key text, p_method text, p_source text, p_items jsonb, p_customer jsonb, p_consent boolean)
returns jsonb language sql volatile security invoker set search_path to ''
as $function$ select api_public_bridge.submit_order_request_v1(p_idempotency_key, p_method, p_source, p_items, p_customer, p_consent); $function$;
revoke all on function public.get_public_offline_ordering_v1() from public;
revoke all on function public.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) from public;
grant execute on function public.get_public_offline_ordering_v1() to anon, authenticated, service_role;
grant execute on function public.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) to anon, authenticated, service_role;

-- Admin wrappers follow the existing pattern: public SQL wrapper, private
-- SECURITY DEFINER core that checks the permission itself.
revoke all on function private.admin_get_offline_ordering_settings_v1() from public, anon;
revoke all on function private.admin_update_offline_ordering_settings_v1(jsonb) from public, anon;
revoke all on function private.admin_list_order_requests_v1(text, text, integer, integer) from public, anon;
revoke all on function private.admin_update_order_request_v1(uuid, text, text) from public, anon;
grant execute on function private.admin_get_offline_ordering_settings_v1() to authenticated, service_role;
grant execute on function private.admin_update_offline_ordering_settings_v1(jsonb) to authenticated, service_role;
grant execute on function private.admin_list_order_requests_v1(text, text, integer, integer) to authenticated, service_role;
grant execute on function private.admin_update_order_request_v1(uuid, text, text) to authenticated, service_role;

create or replace function public.admin_get_offline_ordering_settings_v1()
returns jsonb language sql stable set search_path to ''
as $function$ select private.admin_get_offline_ordering_settings_v1(); $function$;
create or replace function public.admin_update_offline_ordering_settings_v1(p_payload jsonb)
returns jsonb language sql volatile set search_path to ''
as $function$ select private.admin_update_offline_ordering_settings_v1(p_payload); $function$;
create or replace function public.admin_list_order_requests_v1(p_status text default 'open', p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language sql stable set search_path to ''
as $function$ select private.admin_list_order_requests_v1(p_status, p_query, p_limit, p_offset); $function$;
create or replace function public.admin_update_order_request_v1(p_id uuid, p_status text, p_admin_note text default null)
returns jsonb language sql volatile set search_path to ''
as $function$ select private.admin_update_order_request_v1(p_id, p_status, p_admin_note); $function$;
revoke all on function public.admin_get_offline_ordering_settings_v1() from public, anon;
revoke all on function public.admin_update_offline_ordering_settings_v1(jsonb) from public, anon;
revoke all on function public.admin_list_order_requests_v1(text, text, integer, integer) from public, anon;
revoke all on function public.admin_update_order_request_v1(uuid, text, text) from public, anon;
grant execute on function public.admin_get_offline_ordering_settings_v1() to authenticated, service_role;
grant execute on function public.admin_update_offline_ordering_settings_v1(jsonb) to authenticated, service_role;
grant execute on function public.admin_list_order_requests_v1(text, text, integer, integer) to authenticated, service_role;
grant execute on function public.admin_update_order_request_v1(uuid, text, text) to authenticated, service_role;
