create table if not exists private.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_method_id uuid not null references private.customer_payment_methods(id) on delete restrict,
  provider text not null,
  idempotency_key text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in ('created','processing','authorized','captured','failed','cancelled')),
  provider_reference text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  failure_code text,
  failure_message text,
  provider_result jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_result)='object'),
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  completed_at timestamptz,
  unique(user_id,idempotency_key)
);

create index if not exists payment_intents_order_created_idx on private.payment_intents(order_id,created_at desc);
create index if not exists payment_intents_user_created_idx on private.payment_intents(user_id,created_at desc);
create index if not exists payment_intents_processing_idx on private.payment_intents(updated_at) where status in ('created','processing','authorized');
create unique index if not exists payment_intents_provider_reference_uidx on private.payment_intents(provider,provider_reference) where provider_reference is not null;

revoke all on private.payment_intents from public,anon,authenticated;
grant select,insert,update on private.payment_intents to service_role;

create or replace function private.apply_verified_payment_v1(
  p_order_id uuid,
  p_provider text,
  p_provider_reference text,
  p_payment_method_type text,
  p_amount_minor bigint,
  p_currency text,
  p_status text,
  p_actor_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  target_order public.orders%rowtype;
  normalized_provider text := lower(btrim(coalesce(p_provider,'')));
  normalized_reference text := btrim(coalesce(p_provider_reference,''));
  normalized_method text := lower(btrim(coalesce(p_payment_method_type,'')));
  normalized_currency text := upper(btrim(coalesce(p_currency,'')));
  normalized_status text := lower(btrim(coalesce(p_status,'')));
  existing_payment public.payment_records%rowtype;
  payment_id uuid;
  new_payment_status text;
  should_confirm boolean := false;
  event_id text;
begin
  if p_order_id is null then raise exception 'order_required' using errcode='22023'; end if;
  if char_length(normalized_provider) not between 2 and 80 then raise exception 'invalid_payment_provider' using errcode='22023'; end if;
  if char_length(normalized_reference) not between 4 and 220 then raise exception 'invalid_payment_reference' using errcode='22023'; end if;
  if normalized_method not in ('card','bank_transfer','cash_on_delivery','wallet','other') then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_payment_currency' using errcode='22023'; end if;
  if normalized_status not in ('authorized','captured','failed','cancelled') then raise exception 'invalid_payment_status' using errcode='22023'; end if;

  select o.* into target_order from public.orders o where o.id=p_order_id for update;
  if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.status in ('cancelled','refunded') then raise exception 'terminal_order_payment_not_allowed' using errcode='55000'; end if;
  if normalized_currency<>target_order.currency then raise exception 'payment_currency_mismatch' using errcode='22023'; end if;
  if p_amount_minor<>target_order.total_minor then raise exception 'payment_amount_mismatch' using errcode='22023'; end if;

  select payment.* into existing_payment
  from public.payment_records payment
  where payment.provider=normalized_provider and payment.provider_reference=normalized_reference
  for update;

  if existing_payment.id is not null then
    if existing_payment.order_id<>target_order.id
      or existing_payment.amount_minor<>p_amount_minor
      or existing_payment.currency<>normalized_currency
      or existing_payment.payment_method_type<>normalized_method then
      raise exception 'payment_reference_reused' using errcode='23505';
    end if;
    if existing_payment.status=normalized_status then
      return jsonb_build_object('paymentId',existing_payment.id,'orderId',target_order.id,'paymentStatus',target_order.payment_status,'orderStatus',target_order.status,'unchanged',true);
    end if;
    if not (
      (existing_payment.status in ('created','pending') and normalized_status in ('authorized','captured','failed','cancelled'))
      or (existing_payment.status='authorized' and normalized_status in ('captured','failed','cancelled'))
    ) then
      raise exception 'invalid_payment_transition:%:%',existing_payment.status,normalized_status using errcode='22023';
    end if;
    update public.payment_records
    set status=normalized_status,
        authorized_at=case when normalized_status in ('authorized','captured') then coalesce(authorized_at,timezone('utc',now())) else authorized_at end,
        captured_at=case when normalized_status='captured' then coalesce(captured_at,timezone('utc',now())) else captured_at end,
        failure_code=case when normalized_status='failed' then 'provider_failure' else null end,
        failure_message=case when normalized_status='failed' then 'Payment rejected by verified payment workflow.' else null end,
        updated_at=timezone('utc',now())
    where id=existing_payment.id returning id into payment_id;
  else
    insert into public.payment_records(order_id,user_id,provider,provider_reference,payment_method_type,amount_minor,currency,status,authorized_at,captured_at,failure_code,failure_message)
    values(target_order.id,target_order.user_id,normalized_provider,normalized_reference,normalized_method,p_amount_minor,normalized_currency,normalized_status,
      case when normalized_status in ('authorized','captured') then timezone('utc',now()) end,
      case when normalized_status='captured' then timezone('utc',now()) end,
      case when normalized_status='failed' then 'provider_failure' end,
      case when normalized_status='failed' then 'Payment rejected by verified payment workflow.' end)
    returning id into payment_id;
  end if;

  new_payment_status:=case normalized_status when 'authorized' then 'authorized' when 'captured' then 'paid' when 'failed' then 'failed' when 'cancelled' then 'unpaid' end;
  should_confirm:=normalized_status='captured' and target_order.status='pending_payment';

  if should_confirm then
    perform private.consume_order_inventory_v1(target_order.id,p_actor_user_id);
    update public.orders set payment_status='paid',status='confirmed',reservation_expires_at=null,updated_at=timezone('utc',now()) where id=target_order.id;
    insert into public.order_status_history(order_id,from_status,to_status,note,visible_to_customer,actor_user_id)
    values(target_order.id,target_order.status,'confirmed','Ödeme tahsil edildi ve sipariş onaylandı.',true,p_actor_user_id);
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(target_order.user_id,'order','Siparişiniz onaylandı',target_order.order_number||' numaralı siparişinizin ödemesi tahsil edildi ve sipariş onaylandı.','/account/orders',jsonb_build_object('orderId',target_order.id,'paymentId',payment_id,'status','confirmed'));
  else
    update public.orders set payment_status=new_payment_status,updated_at=timezone('utc',now()) where id=target_order.id;
  end if;

  event_id:=left(normalized_reference||':'||normalized_status,500);
  insert into private.payment_events(provider,provider_event_id,payment_id,event_type,payload,signature_verified,processing_status,processed_at)
  values(normalized_provider,event_id,payment_id,'payment.'||normalized_status,
    jsonb_build_object('order_id',target_order.id,'provider',normalized_provider,'provider_reference',normalized_reference,'amount_minor',p_amount_minor,'currency',normalized_currency,'status',normalized_status,'actor_user_id',p_actor_user_id),
    normalized_provider<>'manual','processed',timezone('utc',now()))
  on conflict(provider,provider_event_id) do nothing;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('payment',payment_id,'payment.'||normalized_status,jsonb_build_object('payment_id',payment_id,'order_id',target_order.id,'status',normalized_status));

  return jsonb_build_object('paymentId',payment_id,'orderId',target_order.id,'paymentStatus',new_payment_status,'orderStatus',case when should_confirm then 'confirmed' else target_order.status end);
end;
$$;

create or replace function private.prepare_order_payment_for_service_v1(p_user_id uuid,p_order_id uuid,p_idempotency_key text)
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
begin
  if p_user_id is null or p_order_id is null then raise exception 'payment_context_required' using errcode='22023'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 120 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid_payment_idempotency_key' using errcode='22023'; end if;

  select coalesce(bs.public_config->'payments','{}'::jsonb) into payment_config from public.brand_settings bs where bs.slug='golden-oremar' limit 1;
  configured_provider:=nullif(lower(btrim(coalesce(payment_config->>'provider',''))),'');
  if configured_provider is null or not coalesce((payment_config->>'live_card_payments_enabled')::boolean,false) then raise exception 'payment_provider_not_configured' using errcode='55000'; end if;

  select o.* into target_order from public.orders o where o.id=p_order_id for update;
  if target_order.id is null or target_order.user_id<>p_user_id then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.status<>'pending_payment' then
    if target_order.payment_status='paid' then return jsonb_build_object('action','terminal','status','captured','orderId',target_order.id,'orderNumber',target_order.order_number,'paymentStatus','paid','orderStatus',target_order.status); end if;
    raise exception 'order_not_payable' using errcode='55000';
  end if;
  if target_order.payment_status='authorized' then raise exception 'payment_review_pending' using errcode='55000'; end if;
  if target_order.payment_status not in ('unpaid','failed') then raise exception 'order_not_payable' using errcode='55000'; end if;
  if target_order.reservation_expires_at is not null and target_order.reservation_expires_at<=timezone('utc',now()) then raise exception 'payment_reservation_expired' using errcode='55000'; end if;

  select p.* into pref from private.order_payment_preferences p where p.order_id=target_order.id and p.user_id=p_user_id;
  if pref.order_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  select m.* into method from private.customer_payment_methods m where m.id=pref.payment_method_id and m.user_id=p_user_id and m.status='active';
  if method.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  if method.provider<>configured_provider or pref.provider<>configured_provider then raise exception 'payment_method_provider_mismatch' using errcode='22023'; end if;
  if method.exp_year is not null and method.exp_month is not null and make_date(method.exp_year,method.exp_month,1)<date_trunc('month',timezone('utc',now()))::date then raise exception 'payment_method_expired' using errcode='22023'; end if;
  select c.* into provider_customer from private.payment_provider_customers c where c.user_id=p_user_id and c.provider=configured_provider;
  if provider_customer.user_id is null then raise exception 'provider_customer_missing' using errcode='P0002'; end if;

  select * into existing_intent from private.payment_intents i where i.user_id=p_user_id and i.idempotency_key=p_idempotency_key for update;
  if existing_intent.id is not null then
    if existing_intent.order_id<>target_order.id or existing_intent.payment_method_id<>method.id or existing_intent.amount_minor<>target_order.total_minor or existing_intent.currency<>target_order.currency or existing_intent.provider<>configured_provider then raise exception 'payment_idempotency_key_reused' using errcode='23505'; end if;
    intent_id:=existing_intent.id;
    if existing_intent.status='created' then
      update private.payment_intents set status='processing',attempt_count=attempt_count+1,updated_at=timezone('utc',now()) where id=intent_id;
      action_value:='charge';
    elsif existing_intent.status='processing' then action_value:='reconcile';
    else action_value:='terminal';
    end if;
  else
    insert into private.payment_intents(user_id,order_id,payment_method_id,provider,idempotency_key,amount_minor,currency,status,attempt_count)
    values(p_user_id,target_order.id,method.id,configured_provider,p_idempotency_key,target_order.total_minor,target_order.currency,'processing',1)
    returning id into intent_id;
    action_value:='charge';
  end if;

  select p.* into profile_row from public.profiles p where p.id=p_user_id;
  select u.* into auth_row from auth.users u where u.id=p_user_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',oi.id,'name',oi.product_name,'quantity',oi.quantity,'lineTotalMinor',oi.line_total_minor,'producerId',oi.producer_id) order by oi.id),'[]'::jsonb)
  into items_payload from public.order_items oi where oi.order_id=target_order.id;

  return jsonb_build_object(
    'action',action_value,
    'intentId',intent_id,
    'intentStatus',coalesce(existing_intent.status,'processing'),
    'orderId',target_order.id,
    'orderNumber',target_order.order_number,
    'amountMinor',target_order.total_minor,
    'subtotalMinor',target_order.subtotal_minor,
    'discountMinor',target_order.discount_minor,
    'shippingMinor',target_order.shipping_minor,
    'currency',target_order.currency,
    'shippingAddress',target_order.shipping_address,
    'items',items_payload,
    'provider',configured_provider,
    'providerCustomerRef',case when action_value='charge' then provider_customer.provider_customer_ref else null end,
    'providerPaymentMethodRef',case when action_value='charge' then method.provider_payment_method_ref else null end,
    'paymentMethod',jsonb_build_object('id',method.id,'brand',method.brand,'last4',method.last4),
    'buyer',jsonb_build_object('id',p_user_id,'displayName',profile_row.display_name,'phone',coalesce(profile_row.phone,target_order.shipping_address->>'phone'),'email',auth_row.email,'createdAt',auth_row.created_at),
    'providerReference',existing_intent.provider_reference
  );
end;
$$;

create or replace function private.complete_order_payment_for_service_v1(
  p_intent_id uuid,
  p_provider_reference text,
  p_status text,
  p_provider_payload jsonb default '{}'::jsonb,
  p_failure_code text default null,
  p_failure_message text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  intent private.payment_intents%rowtype;
  normalized_status text:=lower(btrim(coalesce(p_status,'')));
  normalized_reference text:=btrim(coalesce(p_provider_reference,''));
  safe_payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
  applied jsonb;
begin
  if p_intent_id is null then raise exception 'payment_intent_required' using errcode='22023'; end if;
  if normalized_status not in ('authorized','captured','failed','cancelled') then raise exception 'invalid_payment_status' using errcode='22023'; end if;
  if char_length(normalized_reference) not between 4 and 220 then raise exception 'invalid_payment_reference' using errcode='22023'; end if;
  if jsonb_typeof(safe_payload)<>'object' then raise exception 'invalid_provider_payload' using errcode='22023'; end if;
  if p_failure_code is not null and char_length(p_failure_code)>120 then raise exception 'invalid_failure_code' using errcode='22023'; end if;
  if p_failure_message is not null and char_length(p_failure_message)>500 then raise exception 'invalid_failure_message' using errcode='22023'; end if;

  select i.* into intent from private.payment_intents i where i.id=p_intent_id for update;
  if intent.id is null then raise exception 'payment_intent_not_found' using errcode='P0002'; end if;
  if intent.status='captured' then return jsonb_build_object('ok',true,'intentId',intent.id,'status','captured','unchanged',true,'orderId',intent.order_id); end if;
  if intent.status in ('failed','cancelled') and normalized_status=intent.status then return jsonb_build_object('ok',true,'intentId',intent.id,'status',intent.status,'unchanged',true,'orderId',intent.order_id); end if;
  if intent.status='authorized' and normalized_status not in ('captured','failed','cancelled','authorized') then raise exception 'invalid_intent_transition' using errcode='22023'; end if;
  if intent.status not in ('processing','authorized') then raise exception 'invalid_intent_transition' using errcode='22023'; end if;

  applied:=private.apply_verified_payment_v1(intent.order_id,intent.provider,normalized_reference,'card',intent.amount_minor,intent.currency,normalized_status,null);

  update private.payment_intents
  set status=normalized_status,
      provider_reference=normalized_reference,
      failure_code=case when normalized_status='failed' then nullif(btrim(coalesce(p_failure_code,'')),'') else null end,
      failure_message=case when normalized_status='failed' then nullif(btrim(coalesce(p_failure_message,'')),'') else null end,
      provider_result=safe_payload,
      completed_at=case when normalized_status in ('captured','failed','cancelled') then timezone('utc',now()) else null end,
      updated_at=timezone('utc',now())
  where id=intent.id;

  return jsonb_build_object('ok',true,'intentId',intent.id,'status',normalized_status,'orderId',intent.order_id,'payment',applied);
end;
$$;

create or replace function private.get_payment_intent_for_service_v1(p_intent_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object('intentId',i.id,'userId',i.user_id,'orderId',i.order_id,'provider',i.provider,'status',i.status,'providerReference',i.provider_reference,'amountMinor',i.amount_minor,'currency',i.currency,'updatedAt',i.updated_at)
  from private.payment_intents i where i.id=p_intent_id;
$$;

create or replace function public.prepare_order_payment_for_service_v1(p_user_id uuid,p_order_id uuid,p_idempotency_key text)
returns jsonb language sql security definer set search_path='' as $$ select private.prepare_order_payment_for_service_v1(p_user_id,p_order_id,p_idempotency_key); $$;
create or replace function public.complete_order_payment_for_service_v1(p_intent_id uuid,p_provider_reference text,p_status text,p_provider_payload jsonb default '{}'::jsonb,p_failure_code text default null,p_failure_message text default null)
returns jsonb language sql security definer set search_path='' as $$ select private.complete_order_payment_for_service_v1(p_intent_id,p_provider_reference,p_status,p_provider_payload,p_failure_code,p_failure_message); $$;
create or replace function public.get_payment_intent_for_service_v1(p_intent_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select private.get_payment_intent_for_service_v1(p_intent_id); $$;

revoke all on function public.prepare_order_payment_for_service_v1(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_order_payment_for_service_v1(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.get_payment_intent_for_service_v1(uuid) from public,anon,authenticated;
grant execute on function public.prepare_order_payment_for_service_v1(uuid,uuid,text) to service_role;
grant execute on function public.complete_order_payment_for_service_v1(uuid,text,text,jsonb,text,text) to service_role;
grant execute on function public.get_payment_intent_for_service_v1(uuid) to service_role;
