create or replace function private.prepare_order_payment_for_service_v2(p_user_id uuid,p_order_id uuid,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  target_order public.orders%rowtype;
  pref private.order_payment_preferences%rowtype;
  method private.customer_payment_methods%rowtype;
  provider_customer private.payment_provider_customers%rowtype;
  profile_row public.profiles%rowtype;
  auth_row auth.users%rowtype;
  payment_config jsonb;
  configured_provider text;
  existing_intent private.payment_intents%rowtype;
  intent_id uuid;
  action_value text;
  items_payload jsonb;
  basket_price_minor bigint;
  shipping_discount_minor bigint:=0;
  split_total_minor bigint:=0;
begin
  if p_user_id is null or p_order_id is null then raise exception 'payment_context_required' using errcode='22023'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 120 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid_payment_idempotency_key' using errcode='22023'; end if;

  select coalesce(bs.public_config->'payments','{}'::jsonb) into payment_config from public.brand_settings bs where bs.slug='golden-oremar' limit 1;
  configured_provider:=nullif(lower(btrim(coalesce(payment_config->>'provider',''))),'');
  if configured_provider is null or not coalesce((payment_config->>'live_card_payments_enabled')::boolean,false) then raise exception 'payment_provider_not_configured' using errcode='55000'; end if;

  select o.* into target_order from public.orders o where o.id=p_order_id for update;
  if target_order.id is null or target_order.user_id<>p_user_id then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.payment_status='paid' then
    return jsonb_build_object('action','terminal','status','captured','orderId',target_order.id,'orderNumber',target_order.order_number,'paymentStatus','paid','orderStatus',target_order.status);
  end if;
  if target_order.status<>'pending_payment' or target_order.payment_status not in ('unpaid','failed','authorized') then raise exception 'order_not_payable' using errcode='55000'; end if;
  if target_order.reservation_expires_at is not null and target_order.reservation_expires_at<=timezone('utc',now()) then raise exception 'payment_reservation_expired' using errcode='55000'; end if;

  select p.* into pref from private.order_payment_preferences p where p.order_id=target_order.id and p.user_id=p_user_id;
  if pref.order_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  select m.* into method from private.customer_payment_methods m where m.id=pref.payment_method_id and m.user_id=p_user_id and m.status='active';
  if method.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  if method.provider<>configured_provider or pref.provider<>configured_provider then raise exception 'payment_method_provider_mismatch' using errcode='22023'; end if;
  if method.exp_year is not null and method.exp_month is not null and make_date(method.exp_year,method.exp_month,1)<date_trunc('month',timezone('utc',now()))::date then raise exception 'payment_method_expired' using errcode='22023'; end if;
  select c.* into provider_customer from private.payment_provider_customers c where c.user_id=p_user_id and c.provider=configured_provider;
  if provider_customer.user_id is null then raise exception 'provider_customer_missing' using errcode='P0002'; end if;

  if exists(
    select 1
    from public.order_items oi
    left join private.producer_payment_accounts pa on pa.producer_id=oi.producer_id and pa.provider=configured_provider and pa.status='ready' and pa.submerchant_key is not null
    where oi.order_id=target_order.id and (oi.producer_id is null or pa.producer_id is null)
  ) then raise exception 'producer_payment_account_not_ready' using errcode='55000'; end if;

  select coalesce(sum(oi.line_total_minor),0)::bigint into basket_price_minor from public.order_items oi where oi.order_id=target_order.id;
  select coalesce(op.shipping_discount_minor,0)::bigint into shipping_discount_minor from public.order_promotions op where op.order_id=target_order.id;
  if basket_price_minor<=0 then raise exception 'invalid_marketplace_basket_total' using errcode='55000'; end if;
  if target_order.total_minor<>basket_price_minor+target_order.shipping_minor-shipping_discount_minor then raise exception 'marketplace_payment_total_mismatch' using errcode='55000'; end if;

  if exists(
    select 1 from public.order_items oi
    where oi.order_id=target_order.id and greatest(0,oi.line_total_minor-round((((oi.unit_price_minor*oi.quantity)-oi.discount_minor)::numeric*oi.commission_basis_points_snapshot::numeric)/10000)::bigint)<=0
  ) then raise exception 'invalid_submerchant_payout_amount' using errcode='55000'; end if;

  select coalesce(sum(greatest(0,oi.line_total_minor-round((((oi.unit_price_minor*oi.quantity)-oi.discount_minor)::numeric*oi.commission_basis_points_snapshot::numeric)/10000)::bigint)),0)::bigint
  into split_total_minor
  from public.order_items oi where oi.order_id=target_order.id;
  if split_total_minor<=0 or split_total_minor>target_order.total_minor then raise exception 'submerchant_payout_exceeds_charge' using errcode='55000'; end if;

  select * into existing_intent from private.payment_intents i where i.user_id=p_user_id and i.idempotency_key=p_idempotency_key for update;
  if existing_intent.id is not null then
    if existing_intent.subject_type<>'order' or existing_intent.subject_id<>target_order.id or existing_intent.order_id<>target_order.id or existing_intent.payment_method_id<>method.id or existing_intent.amount_minor<>target_order.total_minor or existing_intent.currency<>target_order.currency or existing_intent.provider<>configured_provider then raise exception 'payment_idempotency_key_reused' using errcode='23505'; end if;
    intent_id:=existing_intent.id;
    if existing_intent.status='created' then
      update private.payment_intents set status='processing',attempt_count=attempt_count+1,updated_at=timezone('utc',now()) where id=intent_id;
      action_value:='charge';
    elsif existing_intent.status in ('processing','authorized') then action_value:='reconcile';
    else action_value:='terminal';
    end if;
  else
    insert into private.payment_intents(user_id,subject_type,subject_id,order_id,payment_method_id,provider,idempotency_key,amount_minor,currency,status,attempt_count)
    values(p_user_id,'order',target_order.id,target_order.id,method.id,configured_provider,p_idempotency_key,target_order.total_minor,target_order.currency,'processing',1)
    returning id into intent_id;
    action_value:='charge';
  end if;

  select p.* into profile_row from public.profiles p where p.id=p_user_id;
  select u.* into auth_row from auth.users u where u.id=p_user_id;
  if profile_row.id is null or auth_row.id is null or auth_row.email is null then raise exception 'payment_buyer_profile_incomplete' using errcode='55000'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',oi.id,
      'name',oi.product_name,
      'quantity',oi.quantity,
      'lineTotalMinor',oi.line_total_minor,
      'producerId',oi.producer_id,
      'subMerchantKey',pa.submerchant_key,
      'subMerchantPriceMinor',greatest(0,oi.line_total_minor-round((((oi.unit_price_minor*oi.quantity)-oi.discount_minor)::numeric*oi.commission_basis_points_snapshot::numeric)/10000)::bigint)
    ) order by oi.id),'[]'::jsonb)
  into items_payload
  from public.order_items oi
  join private.producer_payment_accounts pa on pa.producer_id=oi.producer_id and pa.provider=configured_provider and pa.status='ready'
  where oi.order_id=target_order.id;

  return jsonb_build_object(
    'action',action_value,
    'intentId',intent_id,
    'intentStatus',coalesce(existing_intent.status,'processing'),
    'orderId',target_order.id,
    'orderNumber',target_order.order_number,
    'amountMinor',target_order.total_minor,
    'priceMinor',basket_price_minor,
    'shippingMinor',target_order.shipping_minor,
    'shippingDiscountMinor',shipping_discount_minor,
    'discountMinor',target_order.discount_minor,
    'currency',target_order.currency,
    'shippingAddress',target_order.shipping_address,
    'items',items_payload,
    'provider',configured_provider,
    'providerCustomerRef',case when action_value='charge' then provider_customer.provider_customer_ref else null end,
    'providerPaymentMethodRef',case when action_value='charge' then method.provider_payment_method_ref else null end,
    'paymentMethod',jsonb_build_object('id',method.id,'brand',method.brand,'last4',method.last4),
    'buyer',jsonb_build_object('id',p_user_id,'displayName',profile_row.display_name,'phone',coalesce(profile_row.phone,target_order.shipping_address->>'phone'),'email',auth_row.email,'createdAt',auth_row.created_at),
    'providerReference',existing_intent.provider_reference,
    'splitTotalMinor',split_total_minor
  );
end;
$$;

create or replace function public.prepare_order_payment_for_service_v2(p_user_id uuid,p_order_id uuid,p_idempotency_key text)
returns jsonb language sql security definer set search_path='' as $$ select private.prepare_order_payment_for_service_v2(p_user_id,p_order_id,p_idempotency_key); $$;
revoke all on function public.prepare_order_payment_for_service_v2(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_order_payment_for_service_v2(uuid,uuid,text) to service_role;
