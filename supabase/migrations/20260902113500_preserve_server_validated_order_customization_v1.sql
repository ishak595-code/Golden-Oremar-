-- Preserve server-validated product customization from cart to immutable order snapshots.
-- The canonical option schema and normalize_order_customization_v1 function are defined by
-- 20260902113000_add_product_commerce_lifecycle_v1.sql. This migration must not replace that
-- schema-based validator with product-name heuristics.

create or replace function private.set_my_cart_item_v1(
  p_variant_id uuid,
  p_quantity integer,
  p_selected_options jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  cart_row public.carts%rowtype;
  variant_row public.product_variants%rowtype;
  product_row public.products%rowtype;
  producer_row public.producers%rowtype;
  inventory_row public.product_inventory%rowtype;
  sellable integer;
  options_value jsonb;
  customization_value jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  if p_quantity is null or p_quantity not between 0 and 99 then raise exception 'invalid_cart_quantity' using errcode='22023'; end if;
  if p_selected_options is not null and (jsonb_typeof(p_selected_options)<>'object' or pg_column_size(p_selected_options)>8192) then raise exception 'invalid_selected_options' using errcode='22023'; end if;

  select variant.* into variant_row from public.product_variants variant where variant.id=p_variant_id and variant.is_active=true;
  if variant_row.id is null then raise exception 'variant_not_available' using errcode='P0002'; end if;

  select * into product_row from public.products where id=variant_row.product_id;
  select * into producer_row from public.producers where id=product_row.producer_id;
  if product_row.id is null or product_row.status<>'published' or not product_row.is_active or product_row.deleted_at is not null
     or producer_row.id is null or producer_row.status<>'active' or not producer_row.is_verified or producer_row.deleted_at is not null then
    raise exception 'product_not_available' using errcode='P0002';
  end if;

  options_value:=coalesce(variant_row.option_values,'{}'::jsonb)-'orderCustomization';
  if p_selected_options is not null and p_selected_options ? 'orderCustomization' then
    customization_value:=private.normalize_order_customization_v1(product_row.id,p_selected_options->'orderCustomization');
    if customization_value is not null then
      options_value:=options_value||jsonb_build_object('orderCustomization',customization_value);
    end if;
  end if;

  cart_row:=private.get_or_create_customer_cart_v1(caller_id);
  if cart_row.currency<>product_row.currency then raise exception 'mixed_currency_cart_not_supported' using errcode='22023'; end if;

  if p_quantity=0 then
    delete from public.cart_items where cart_id=cart_row.id and variant_id=p_variant_id;
    update public.carts set expires_at=timezone('utc',now())+interval '30 days',updated_at=timezone('utc',now()) where id=cart_row.id;
    return private.get_customer_cart_snapshot_v1(caller_id);
  end if;

  if product_row.stock_mode in ('tracked','seasonal') then
    select * into inventory_row from public.product_inventory where variant_id=p_variant_id;
    sellable:=greatest(0,coalesce(inventory_row.available_quantity,0)-coalesce(inventory_row.reserved_quantity,0));
    if p_quantity>sellable then raise exception 'insufficient_stock:%',sellable using errcode='22023'; end if;
  end if;

  delete from public.cart_items
  where cart_id=cart_row.id and variant_id=p_variant_id and selected_options is distinct from options_value;

  insert into public.cart_items(cart_id,variant_id,quantity,selected_options)
  values(cart_row.id,p_variant_id,p_quantity,options_value)
  on conflict(cart_id,variant_id,selected_options) do update
  set quantity=excluded.quantity,updated_at=timezone('utc',now());

  update public.carts set expires_at=timezone('utc',now())+interval '30 days',updated_at=timezone('utc',now()) where id=cart_row.id;
  return private.get_customer_cart_snapshot_v1(caller_id);
end;
$$;

revoke all on function private.set_my_cart_item_v1(uuid,integer,jsonb) from public;

create or replace function private.create_customer_order_v5(
  p_items jsonb,
  p_shipping_address jsonb,
  p_customer_note text,
  p_coupon_code text,
  p_gift jsonb,
  p_payment_method_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  legal_readiness jsonb;
  payment_config jsonb;
  live_card_payments boolean:=false;
  hosted_checkout boolean:=false;
  configured_provider text;
  selected_method private.customer_payment_methods%rowtype;
  base jsonb;
  order_id_value uuid;
  items_with_customization jsonb:=p_items;
  source_item jsonb;
  variant_reference text;
  cart_variant_id uuid;
  cart_product_id uuid;
  cart_customization jsonb;
  normalized_customization jsonb;
  customization_by_variant jsonb:='{}'::jsonb;
  order_item record;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  legal_readiness:=private.commercial_checkout_legal_readiness_v1();
  if not coalesce((legal_readiness->>'ready')::boolean,false) then raise exception 'commercial_legal_readiness_required' using errcode='55000'; end if;

  select private.default_payment_control_v1()||coalesce(bs.public_config->'payments','{}'::jsonb)
  into payment_config from public.brand_settings bs where bs.slug='golden-oremar' limit 1;
  if payment_config is null then payment_config:=private.default_payment_control_v1(); end if;
  live_card_payments:=coalesce((payment_config->>'live_card_payments_enabled')::boolean,false);
  hosted_checkout:=coalesce((payment_config->>'checkout_form_enabled')::boolean,false);
  configured_provider:=nullif(lower(btrim(coalesce(payment_config->>'provider',''))),'');
  if configured_provider<>'iyzico' then raise exception 'payment_provider_not_configured' using errcode='55000'; end if;

  if p_payment_method_id is not null then
    if not live_card_payments then raise exception 'saved_card_payment_not_enabled' using errcode='55000'; end if;
    select * into selected_method from private.customer_payment_methods p where p.id=p_payment_method_id and p.user_id=caller_id and p.status='active' for update;
    if selected_method.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
    if selected_method.provider<>configured_provider then raise exception 'payment_method_provider_mismatch' using errcode='22023'; end if;
    if selected_method.exp_year is not null and selected_method.exp_month is not null and make_date(selected_method.exp_year,selected_method.exp_month,1)<date_trunc('month',timezone('utc',now()))::date then raise exception 'payment_method_expired' using errcode='22023'; end if;
  elsif not hosted_checkout then
    raise exception 'payment_method_required' using errcode='22023';
  end if;

  if p_items is not null and jsonb_typeof(p_items)='array' then
    items_with_customization:='[]'::jsonb;
    for source_item in select value from jsonb_array_elements(p_items)
    loop
      source_item:=source_item-'orderCustomization';
      variant_reference:=btrim(coalesce(source_item->>'variantReference',source_item->>'variantId',source_item->>'variantSku',''));
      cart_variant_id:=null;
      cart_product_id:=null;
      cart_customization:=null;
      if variant_reference<>'' then
        select ci.variant_id,v.product_id,ci.selected_options->'orderCustomization'
        into cart_variant_id,cart_product_id,cart_customization
        from public.carts c
        join public.cart_items ci on ci.cart_id=c.id
        join public.product_variants v on v.id=ci.variant_id
        where c.user_id=caller_id and c.status='active' and (c.expires_at is null or c.expires_at>timezone('utc',now()))
          and (v.id::text=variant_reference or v.sku=variant_reference)
        order by c.created_at desc
        limit 1;
      end if;
      if cart_variant_id is not null and cart_customization is not null and cart_customization<>'null'::jsonb then
        normalized_customization:=private.normalize_order_customization_v1(cart_product_id,cart_customization);
        customization_by_variant:=customization_by_variant||jsonb_build_object(cart_variant_id::text,normalized_customization);
        source_item:=source_item||jsonb_build_object('orderCustomization',normalized_customization);
      end if;
      items_with_customization:=items_with_customization||jsonb_build_array(source_item);
    end loop;
  end if;

  base:=private.create_customer_order_v4(items_with_customization,p_shipping_address,p_customer_note,p_coupon_code,p_gift,p_idempotency_key);
  order_id_value:=(base->>'orderId')::uuid;

  if customization_by_variant<>'{}'::jsonb then
    for order_item in
      select oi.id,oi.product_id,oi.variant_id,o.cart_id
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      where oi.order_id=order_id_value and oi.variant_id is not null
    loop
      normalized_customization:=customization_by_variant->order_item.variant_id::text;
      if normalized_customization is not null and normalized_customization<>'null'::jsonb then
        normalized_customization:=private.normalize_order_customization_v1(order_item.product_id,normalized_customization);
        update public.order_items
        set snapshot=jsonb_set(
          coalesce(snapshot,'{}'::jsonb),
          '{selected_options}',
          (coalesce(snapshot->'selected_options','{}'::jsonb)-'orderCustomization')||jsonb_build_object('orderCustomization',normalized_customization),
          true
        )
        where id=order_item.id;

        update public.cart_items
        set selected_options=(coalesce(selected_options,'{}'::jsonb)-'orderCustomization')||jsonb_build_object('orderCustomization',normalized_customization),
            updated_at=timezone('utc',now())
        where cart_id=order_item.cart_id and variant_id=order_item.variant_id;
      end if;
    end loop;
  end if;

  if p_payment_method_id is not null then
    insert into private.order_payment_preferences(order_id,user_id,payment_method_id,provider)
    values(order_id_value,caller_id,selected_method.id,selected_method.provider)
    on conflict(order_id) do update set payment_method_id=excluded.payment_method_id,provider=excluded.provider,updated_at=timezone('utc',now())
    where private.order_payment_preferences.user_id=caller_id;

    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('order',order_id_value,'order.payment_method_selected',jsonb_build_object('order_id',order_id_value,'user_id',caller_id,'payment_method_id',selected_method.id,'provider',selected_method.provider,'last4',selected_method.last4,'brand',selected_method.brand));
    base:=base||jsonb_build_object('paymentMethod',jsonb_build_object('id',selected_method.id,'provider',selected_method.provider,'brand',selected_method.brand,'last4',selected_method.last4,'nickname',selected_method.nickname),'paymentFlow','saved_card');
  else
    base:=base||jsonb_build_object('paymentMethod',null,'paymentFlow','checkout_form');
  end if;

  return base;
end;
$$;

revoke all on function private.create_customer_order_v5(jsonb,jsonb,text,text,jsonb,uuid,text) from public;
