create or replace function private.create_customer_order_v5(p_items jsonb,p_shipping_address jsonb,p_customer_note text,p_coupon_code text,p_gift jsonb,p_payment_method_id uuid,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  payment_config jsonb;
  live_card_payments boolean:=false;
  hosted_checkout boolean:=false;
  configured_provider text;
  selected_method private.customer_payment_methods%rowtype;
  base jsonb;
  order_id_value uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb)
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
  elsif not hosted_checkout then raise exception 'payment_method_required' using errcode='22023'; end if;
  base:=private.create_customer_order_v4(p_items,p_shipping_address,p_customer_note,p_coupon_code,p_gift,p_idempotency_key);
  order_id_value:=(base->>'orderId')::uuid;
  if p_payment_method_id is not null then
    insert into private.order_payment_preferences(order_id,user_id,payment_method_id,provider)
    values(order_id_value,caller_id,selected_method.id,selected_method.provider)
    on conflict(order_id) do update set payment_method_id=excluded.payment_method_id,provider=excluded.provider,updated_at=timezone('utc',now()) where private.order_payment_preferences.user_id=caller_id;
    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('order',order_id_value,'order.payment_method_selected',jsonb_build_object('order_id',order_id_value,'user_id',caller_id,'payment_method_id',selected_method.id,'provider',selected_method.provider,'last4',selected_method.last4,'brand',selected_method.brand));
    base:=base||jsonb_build_object('paymentMethod',jsonb_build_object('id',selected_method.id,'provider',selected_method.provider,'brand',selected_method.brand,'last4',selected_method.last4,'nickname',selected_method.nickname),'paymentFlow','saved_card');
  else base:=base||jsonb_build_object('paymentMethod',null,'paymentFlow','checkout_form'); end if;
  return base;
end;
$$;
