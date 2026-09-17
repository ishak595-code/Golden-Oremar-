-- Drift closure (final function): create_customer_order - the original v1
-- checkout implementation, still reachable because the public wrapper of the
-- same name routes to create_customer_order_guarded_v1, which performs the
-- shipping-zone and rate-sync preflight and then calls this.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.create_customer_order(p_items jsonb, p_shipping_address jsonb, p_customer_note text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  customer_profile public.profiles%rowtype;
  brand_config public.brand_settings%rowtype;
  existing_key private.idempotency_keys%rowtype;
  normalized_address jsonb;
  normalized_options jsonb;
  request_hash text;
  scoped_key text;
  inserted_key_count integer := 0;
  item jsonb;
  product_reference text;
  quantity_value integer;
  target_product_id uuid;
  target_product_currency text;
  target_variant_id uuid;
  cart_id_value uuid;
  order_id_value uuid := gen_random_uuid();
  order_number_value text;
  currency_value text;
  subtotal_value bigint;
  shipping_value bigint := 0;
  max_order_value bigint := 100000000;
  reservation_hours integer := 24;
  total_value bigint;
  shortage_product text;
  response_payload jsonb;
  reservation record;
begin
  if current_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select profile.* into customer_profile from public.profiles profile where profile.id = current_user_id and profile.status = 'active' and profile.deleted_at is null;
  if not found then raise exception 'active_profile_required' using errcode = '42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 160 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'invalid_cart_items' using errcode = '22023';
  end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' then raise exception 'invalid_shipping_address' using errcode = '22023'; end if;
  if p_customer_note is not null and char_length(p_customer_note) > 1000 then raise exception 'invalid_customer_note' using errcode = '22023'; end if;
  normalized_address := jsonb_strip_nulls(jsonb_build_object(
    'label', nullif(btrim(coalesce(p_shipping_address ->> 'label', 'Teslimat')), ''),
    'recipient_name', nullif(btrim(coalesce(p_shipping_address ->> 'recipient_name', p_shipping_address ->> 'recipientName')), ''),
    'phone', nullif(btrim(coalesce(p_shipping_address ->> 'phone', '')), ''),
    'country_code', upper(coalesce(nullif(btrim(coalesce(p_shipping_address ->> 'country_code', p_shipping_address ->> 'countryCode')), ''), 'TR')),
    'province', nullif(btrim(coalesce(p_shipping_address ->> 'province', '')), ''),
    'district', nullif(btrim(coalesce(p_shipping_address ->> 'district', '')), ''),
    'neighborhood', nullif(btrim(coalesce(p_shipping_address ->> 'neighborhood', '')), ''),
    'address_line', nullif(btrim(coalesce(p_shipping_address ->> 'address_line', p_shipping_address ->> 'addressLine')), ''),
    'postal_code', nullif(btrim(coalesce(p_shipping_address ->> 'postal_code', p_shipping_address ->> 'postalCode')), ''),
    'delivery_notes', nullif(btrim(coalesce(p_shipping_address ->> 'delivery_notes', p_shipping_address ->> 'deliveryNotes')), '')
  ));
  if char_length(coalesce(normalized_address ->> 'label', '')) not between 1 and 60
    or char_length(coalesce(normalized_address ->> 'recipient_name', '')) not between 2 and 120
    or char_length(coalesce(normalized_address ->> 'phone', '')) not between 7 and 40
    or coalesce(normalized_address ->> 'country_code', '') !~ '^[A-Z]{2}$'
    or char_length(coalesce(normalized_address ->> 'province', '')) not between 2 and 120
    or char_length(coalesce(normalized_address ->> 'district', '')) not between 2 and 120
    or char_length(coalesce(normalized_address ->> 'neighborhood', '')) > 160
    or char_length(coalesce(normalized_address ->> 'address_line', '')) not between 10 and 1000
    or char_length(coalesce(normalized_address ->> 'postal_code', '')) > 20
    or char_length(coalesce(normalized_address ->> 'delivery_notes', '')) > 500 then
    raise exception 'invalid_shipping_address' using errcode = '22023';
  end if;
  scoped_key := 'checkout:' || current_user_id::text || ':' || p_idempotency_key;
  request_hash := encode(extensions.digest(convert_to(jsonb_build_object('user_id', current_user_id, 'items', p_items, 'shipping_address', normalized_address, 'customer_note', coalesce(p_customer_note, ''))::text, 'UTF8'), 'sha256'), 'hex');
  select key_row.* into existing_key from private.idempotency_keys key_row where key_row.key = scoped_key;
  if found then
    if existing_key.scope <> 'customer_checkout' or existing_key.user_id is distinct from current_user_id or existing_key.request_hash <> request_hash then
      raise exception 'idempotency_key_reused' using errcode = '22023';
    end if;
    if existing_key.completed_at is not null then return existing_key.response_body; end if;
    raise exception 'request_in_progress' using errcode = '40001';
  end if;
  insert into private.idempotency_keys(key, scope, user_id, request_hash, locked_at, expires_at)
  values (scoped_key, 'customer_checkout', current_user_id, request_hash, timezone('utc', now()), timezone('utc', now()) + interval '7 days')
  on conflict (key) do nothing;
  get diagnostics inserted_key_count = row_count;
  if inserted_key_count = 0 then
    select key_row.* into existing_key from private.idempotency_keys key_row where key_row.key = scoped_key;
    if existing_key.scope <> 'customer_checkout' or existing_key.user_id is distinct from current_user_id or existing_key.request_hash <> request_hash then
      raise exception 'idempotency_key_reused' using errcode = '22023';
    end if;
    if existing_key.completed_at is not null then return existing_key.response_body; end if;
    raise exception 'request_in_progress' using errcode = '40001';
  end if;
  if (select count(*) from public.orders customer_order where customer_order.user_id = current_user_id and customer_order.created_at > timezone('utc', now()) - interval '10 minutes') >= 10 then
    raise exception 'order_rate_limit_exceeded' using errcode = 'P0001';
  end if;
  select settings.* into brand_config from public.brand_settings settings where settings.slug = 'golden-oremar';
  if not found then raise exception 'brand_configuration_missing' using errcode = 'P0001'; end if;
  currency_value := brand_config.default_currency;
  if coalesce(brand_config.public_config #>> '{checkout,shippingMinor}', '') ~ '^[0-9]+$' then shipping_value := (brand_config.public_config #>> '{checkout,shippingMinor}')::bigint; end if;
  if coalesce(brand_config.public_config #>> '{checkout,maxOrderMinor}', '') ~ '^[0-9]+$' then max_order_value := (brand_config.public_config #>> '{checkout,maxOrderMinor}')::bigint; end if;
  if coalesce(brand_config.public_config #>> '{checkout,stockReservationHours}', '') ~ '^[0-9]+$' then
    reservation_hours := least(168, greatest(1, (brand_config.public_config #>> '{checkout,stockReservationHours}')::integer));
  end if;
  select cart.id into cart_id_value from public.carts cart where cart.user_id = current_user_id and cart.status = 'active' for update;
  if cart_id_value is null then
    insert into public.carts(user_id, status, currency, expires_at)
    values (current_user_id, 'active', currency_value, timezone('utc', now()) + make_interval(hours => reservation_hours))
    returning id into cart_id_value;
  else
    delete from public.cart_items where cart_id = cart_id_value;
    update public.carts set currency = currency_value, expires_at = timezone('utc', now()) + make_interval(hours => reservation_hours), updated_at = timezone('utc', now()) where id = cart_id_value;
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'invalid_cart_item' using errcode = '22023'; end if;
    product_reference := btrim(coalesce(item ->> 'productReference', item ->> 'productId', item ->> 'id', ''));
    if char_length(product_reference) not between 1 and 200 or coalesce(item ->> 'quantity', '') !~ '^[0-9]{1,2}$' then
      raise exception 'invalid_cart_item' using errcode = '22023';
    end if;
    quantity_value := (item ->> 'quantity')::integer;
    if quantity_value not between 1 and 99 then raise exception 'invalid_cart_quantity' using errcode = '22023'; end if;
    normalized_options := coalesce(item -> 'selectedOptions', '{}'::jsonb);
    if jsonb_typeof(normalized_options) <> 'object' or octet_length(normalized_options::text) > 4000 then
      raise exception 'invalid_selected_options' using errcode = '22023';
    end if;
    select product.id, product.currency, variant.id into target_product_id, target_product_currency, target_variant_id
    from public.products product
    join public.producers producer on producer.id = product.producer_id
    join public.product_variants variant on variant.product_id = product.id
    where (product.id::text = product_reference or product.legacy_id = product_reference)
      and product.status = 'published' and product.is_active = true and product.deleted_at is null
      and producer.status = 'active' and producer.is_verified = true and producer.deleted_at is null
      and variant.is_active = true
    order by variant.is_default desc, variant.created_at asc limit 1;
    if not found then raise exception 'product_not_available' using errcode = '22023'; end if;
    if target_product_currency <> currency_value then raise exception 'mixed_currency_cart' using errcode = '22023'; end if;
    if exists (select 1 from public.cart_items existing_item where existing_item.cart_id = cart_id_value and existing_item.variant_id = target_variant_id and existing_item.selected_options = normalized_options) then
      raise exception 'duplicate_cart_item' using errcode = '22023';
    end if;
    insert into public.cart_items(cart_id, variant_id, quantity, selected_options) values (cart_id_value, target_variant_id, quantity_value, normalized_options);
  end loop;
  perform inventory.variant_id
  from public.product_inventory inventory
  join public.cart_items cart_item on cart_item.variant_id = inventory.variant_id
  join public.product_variants variant on variant.id = cart_item.variant_id
  join public.products product on product.id = variant.product_id
  where cart_item.cart_id = cart_id_value and product.stock_mode in ('tracked', 'seasonal')
  order by inventory.variant_id for update of inventory;
  select product.name into shortage_product
  from public.cart_items cart_item
  join public.product_variants variant on variant.id = cart_item.variant_id
  join public.products product on product.id = variant.product_id
  left join public.product_inventory inventory on inventory.variant_id = variant.id
  where cart_item.cart_id = cart_id_value and product.stock_mode in ('tracked', 'seasonal')
    and (inventory.variant_id is null or inventory.available_quantity - inventory.reserved_quantity < cart_item.quantity)
  order by product.name limit 1;
  if shortage_product is not null then raise exception 'insufficient_stock:%', shortage_product using errcode = 'P0001'; end if;
  select coalesce(sum(variant.price_minor * cart_item.quantity), 0) into subtotal_value
  from public.cart_items cart_item join public.product_variants variant on variant.id = cart_item.variant_id where cart_item.cart_id = cart_id_value;
  if coalesce(brand_config.public_config #>> '{checkout,freeShippingThresholdMinor}', '') ~ '^[0-9]+$'
    and subtotal_value >= (brand_config.public_config #>> '{checkout,freeShippingThresholdMinor}')::bigint then shipping_value := 0; end if;
  total_value := subtotal_value + shipping_value;
  if subtotal_value <= 0 or total_value <= 0 or total_value > max_order_value then raise exception 'invalid_order_total' using errcode = '22023'; end if;
  order_number_value := brand_config.order_prefix || '-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 8, '0');
  insert into public.orders(id, order_number, user_id, cart_id, status, payment_status, fulfillment_status, currency, subtotal_minor, discount_minor, tax_minor, shipping_minor, total_minor, shipping_address, customer_note, placed_at, checkout_idempotency_key, reservation_expires_at)
  values (order_id_value, order_number_value, current_user_id, cart_id_value, 'pending_payment', 'unpaid', 'unfulfilled', currency_value, subtotal_value, 0, 0, shipping_value, total_value, normalized_address, nullif(btrim(coalesce(p_customer_note, '')), ''), timezone('utc', now()), p_idempotency_key, timezone('utc', now()) + make_interval(hours => reservation_hours));
  insert into public.order_items(order_id, product_id, variant_id, producer_id, product_name, variant_name, sku, image_path, quantity, unit_price_minor, discount_minor, tax_minor, line_total_minor, snapshot)
  select order_id_value, product.id, variant.id, product.producer_id, product.name, variant.name, variant.sku, primary_image.storage_path, cart_item.quantity, variant.price_minor, 0, 0, variant.price_minor * cart_item.quantity,
    jsonb_build_object('selected_options', cart_item.selected_options, 'product_slug', product.slug, 'product_legacy_id', product.legacy_id, 'unit_label', product.unit_label, 'origin', product.origin, 'stock_mode', product.stock_mode, 'tax_rate_basis_points', product.tax_rate_basis_points)
  from public.cart_items cart_item
  join public.product_variants variant on variant.id = cart_item.variant_id
  join public.products product on product.id = variant.product_id
  left join lateral (select image.storage_path from public.product_images image where image.product_id = product.id order by image.is_primary desc, image.sort_order asc, image.created_at asc limit 1) primary_image on true
  where cart_item.cart_id = cart_id_value;
  for reservation in
    select item.variant_id, sum(item.quantity)::integer as quantity from public.order_items item join public.products product on product.id = item.product_id
    where item.order_id = order_id_value and item.variant_id is not null and product.stock_mode in ('tracked', 'seasonal') group by item.variant_id order by item.variant_id
  loop
    update public.product_inventory inventory set reserved_quantity = inventory.reserved_quantity + reservation.quantity, version = inventory.version + 1, updated_at = timezone('utc', now()) where inventory.variant_id = reservation.variant_id;
    insert into private.inventory_movements(variant_id, movement_type, quantity_delta, reference_type, reference_id, reason, idempotency_key, actor_user_id)
    values (reservation.variant_id, 'reservation', -reservation.quantity, 'order', order_id_value, 'Customer checkout stock reservation', 'order:' || order_id_value::text || ':reserve:' || reservation.variant_id::text, current_user_id);
  end loop;
  insert into public.order_status_history(order_id, from_status, to_status, note, visible_to_customer, actor_user_id)
  values (order_id_value, null, 'pending_payment', 'Sipariş talebi alındı. Ödeme veya işletme onayı bekleniyor.', true, current_user_id);
  update public.carts set status = 'converted', expires_at = null, updated_at = timezone('utc', now()) where id = cart_id_value;
  insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
  values ('order', order_id_value, 'order.pending_payment_created', jsonb_build_object('order_id', order_id_value, 'order_number', order_number_value, 'user_id', current_user_id, 'currency', currency_value, 'total_minor', total_value, 'reservation_expires_at', timezone('utc', now()) + make_interval(hours => reservation_hours)));
  response_payload := jsonb_build_object('ok', true, 'orderId', order_id_value, 'orderNumber', order_number_value, 'status', 'pending_payment', 'paymentStatus', 'unpaid', 'paymentMode', 'manual_confirmation', 'currency', currency_value, 'subtotalMinor', subtotal_value, 'shippingMinor', shipping_value, 'totalMinor', total_value, 'reservationExpiresAt', timezone('utc', now()) + make_interval(hours => reservation_hours));
  update private.idempotency_keys set response_status = 201, response_body = response_payload, completed_at = timezone('utc', now()) where key = scoped_key;
  return response_payload;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_customer_order(p_items jsonb, p_shipping_address jsonb, p_customer_note text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.create_customer_order_guarded_v1(p_items,p_shipping_address,p_customer_note,p_idempotency_key);
$function$
;
