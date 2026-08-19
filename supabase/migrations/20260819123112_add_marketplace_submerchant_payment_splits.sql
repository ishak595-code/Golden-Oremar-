create table if not exists private.producer_payment_accounts (
  producer_id uuid primary key references public.producers(id) on delete restrict,
  provider text not null default 'iyzico',
  provider_submerchant_type text check (provider_submerchant_type in ('PERSONAL','PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY')),
  submerchant_external_id text not null,
  submerchant_key text,
  status text not null default 'pending_configuration' check (status in ('pending_configuration','onboarding','ready','suspended','error')),
  last_error text,
  provider_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_snapshot)='object'),
  onboarded_at timestamptz,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(provider,submerchant_external_id)
);

revoke all on private.producer_payment_accounts from public,anon,authenticated;
grant select,insert,update on private.producer_payment_accounts to service_role;

create table if not exists private.payment_item_splits (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payment_records(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  producer_id uuid not null references public.producers(id) on delete restrict,
  provider_payment_transaction_id text not null,
  item_price_minor bigint not null check (item_price_minor>=0),
  provider_paid_price_minor bigint check (provider_paid_price_minor is null or provider_paid_price_minor>=0),
  submerchant_price_minor bigint not null check (submerchant_price_minor>=0),
  transaction_status integer,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','disapproved')),
  provider_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_snapshot)='object'),
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(payment_id,order_item_id),
  unique(provider_payment_transaction_id)
);
create index if not exists payment_item_splits_order_idx on private.payment_item_splits(order_id,order_item_id);
create index if not exists payment_item_splits_producer_idx on private.payment_item_splits(producer_id,created_at desc);
revoke all on private.payment_item_splits from public,anon,authenticated;
grant select,insert,update on private.payment_item_splits to service_role;

create or replace function public.super_admin_set_producer_payment_provider_type_v1(p_producer_id uuid,p_provider_submerchant_type text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  normalized_type text:=upper(btrim(coalesce(p_provider_submerchant_type,'')));
  target public.producers%rowtype;
  result private.producer_payment_accounts%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_producer_id is null then raise exception 'producer_required' using errcode='22023'; end if;
  if normalized_type not in ('PERSONAL','PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then raise exception 'invalid_provider_submerchant_type' using errcode='22023'; end if;
  select * into target from public.producers where id=p_producer_id and deleted_at is null;
  if target.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  insert into private.producer_payment_accounts(producer_id,provider,provider_submerchant_type,submerchant_external_id,status,last_error,updated_at)
  values(target.id,'iyzico',normalized_type,'GO-'||replace(target.id::text,'-',''),'pending_configuration',null,timezone('utc',now()))
  on conflict(producer_id) do update set
    provider_submerchant_type=excluded.provider_submerchant_type,
    status=case when private.producer_payment_accounts.submerchant_key is null then 'pending_configuration' else private.producer_payment_accounts.status end,
    last_error=null,
    updated_at=timezone('utc',now())
  returning * into result;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'producer.payment_provider_type_set','producer',target.id,jsonb_build_object('provider','iyzico','submerchantType',normalized_type));
  return jsonb_build_object('ok',true,'producerId',result.producer_id,'provider',result.provider,'providerSubmerchantType',result.provider_submerchant_type,'status',result.status,'ready',result.status='ready');
end;
$$;
revoke all on function public.super_admin_set_producer_payment_provider_type_v1(uuid,text) from public,anon;
grant execute on function public.super_admin_set_producer_payment_provider_type_v1(uuid,text) to authenticated;

create or replace function private.prepare_producer_submerchant_for_service_v1(p_producer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  producer_row public.producers%rowtype;
  app public.producer_applications%rowtype;
  kyc private.producer_application_kyc%rowtype;
  account private.producer_payment_accounts%rowtype;
  owner_profile public.profiles%rowtype;
  owner_auth auth.users%rowtype;
  identity_value text;
  tax_value text;
  iban_value text;
  result_status text;
begin
  if p_producer_id is null then raise exception 'producer_required' using errcode='22023'; end if;
  select * into producer_row from public.producers where id=p_producer_id and deleted_at is null;
  if producer_row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if producer_row.application_id is null then raise exception 'producer_application_missing' using errcode='55000'; end if;
  select * into app from public.producer_applications where id=producer_row.application_id;
  select * into kyc from private.producer_application_kyc where application_id=producer_row.application_id;
  if kyc.application_id is null then raise exception 'producer_kyc_missing' using errcode='55000'; end if;
  select * into account from private.producer_payment_accounts where producer_id=producer_row.id;
  if account.producer_id is null or account.provider_submerchant_type is null then raise exception 'producer_payment_type_not_configured' using errcode='55000'; end if;
  if account.status='ready' and account.submerchant_key is not null then
    return jsonb_build_object('action','terminal','producerId',producer_row.id,'provider',account.provider,'status','ready','submerchantExternalId',account.submerchant_external_id);
  end if;
  if account.status='suspended' then raise exception 'producer_payment_account_suspended' using errcode='55000'; end if;
  select * into owner_profile from public.profiles where id=producer_row.owner_user_id;
  select * into owner_auth from auth.users where id=producer_row.owner_user_id;
  identity_value:=private.decrypt_producer_kyc(kyc.national_id_ciphertext);
  tax_value:=private.decrypt_producer_kyc(kyc.tax_number_ciphertext);
  iban_value:=private.decrypt_producer_kyc(kyc.iban_ciphertext);
  if iban_value is null or char_length(regexp_replace(upper(iban_value),'[^A-Z0-9]','','g')) not between 15 and 34 then raise exception 'producer_iban_required' using errcode='55000'; end if;
  if account.provider_submerchant_type='PERSONAL' and identity_value is null then raise exception 'producer_identity_required' using errcode='55000'; end if;
  if account.provider_submerchant_type<>'PERSONAL' and tax_value is null then raise exception 'producer_tax_number_required' using errcode='55000'; end if;
  update private.producer_payment_accounts set status='onboarding',last_error=null,updated_at=timezone('utc',now()) where producer_id=producer_row.id;
  result_status:='onboarding';
  return jsonb_build_object(
    'action','onboard',
    'producerId',producer_row.id,
    'provider','iyzico',
    'providerSubmerchantType',account.provider_submerchant_type,
    'submerchantExternalId',account.submerchant_external_id,
    'name',producer_row.display_name,
    'legalName',kyc.legal_name,
    'contactEmail',coalesce(kyc.contact_email,owner_auth.email),
    'phone',kyc.phone,
    'address',kyc.address,
    'iban',iban_value,
    'identityNumber',identity_value,
    'taxOffice',kyc.tax_office,
    'taxNumber',tax_value,
    'bankAccountHolder',kyc.bank_account_holder,
    'currency','TRY',
    'status',result_status
  );
end;
$$;

create or replace function private.complete_producer_submerchant_for_service_v1(p_producer_id uuid,p_submerchant_key text,p_provider_snapshot jsonb default '{}'::jsonb,p_error text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  account private.producer_payment_accounts%rowtype;
  normalized_key text:=nullif(btrim(coalesce(p_submerchant_key,'')),'');
  safe_snapshot jsonb:=coalesce(p_provider_snapshot,'{}'::jsonb);
begin
  if p_producer_id is null then raise exception 'producer_required' using errcode='22023'; end if;
  if jsonb_typeof(safe_snapshot)<>'object' then raise exception 'invalid_provider_snapshot' using errcode='22023'; end if;
  if p_error is not null and char_length(p_error)>500 then raise exception 'invalid_provider_error' using errcode='22023'; end if;
  select * into account from private.producer_payment_accounts where producer_id=p_producer_id for update;
  if account.producer_id is null then raise exception 'producer_payment_account_not_found' using errcode='P0002'; end if;
  if normalized_key is not null and char_length(normalized_key) not between 8 and 500 then raise exception 'invalid_submerchant_key' using errcode='22023'; end if;
  update private.producer_payment_accounts
  set submerchant_key=coalesce(normalized_key,submerchant_key),
      status=case when normalized_key is not null then 'ready' else 'error' end,
      last_error=case when normalized_key is not null then null else nullif(btrim(coalesce(p_error,'provider_onboarding_failed')),'') end,
      provider_snapshot=safe_snapshot,
      onboarded_at=case when normalized_key is not null then coalesce(onboarded_at,timezone('utc',now())) else onboarded_at end,
      updated_at=timezone('utc',now())
  where producer_id=p_producer_id
  returning * into account;
  return jsonb_build_object('ok',normalized_key is not null,'producerId',account.producer_id,'provider',account.provider,'status',account.status,'ready',account.status='ready');
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
  basket_price_minor bigint;
  shipping_charge_minor bigint;
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

  if exists(
    select 1 from public.order_items oi
    left join private.producer_payment_accounts pa on pa.producer_id=oi.producer_id and pa.provider=configured_provider and pa.status='ready' and pa.submerchant_key is not null
    where oi.order_id=target_order.id and (oi.producer_id is null or pa.producer_id is null)
  ) then raise exception 'producer_payment_account_not_ready' using errcode='55000'; end if;

  select coalesce(sum(oi.line_total_minor),0)::bigint into basket_price_minor from public.order_items oi where oi.order_id=target_order.id;
  shipping_charge_minor:=target_order.total_minor-basket_price_minor;
  if basket_price_minor<=0 or shipping_charge_minor<0 then raise exception 'invalid_marketplace_payment_totals' using errcode='55000'; end if;

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
  join private.producer_payment_accounts pa on pa.producer_id=oi.producer_id and pa.provider=configured_provider
  where oi.order_id=target_order.id;

  return jsonb_build_object(
    'action',action_value,
    'intentId',intent_id,
    'intentStatus',coalesce(existing_intent.status,'processing'),
    'orderId',target_order.id,
    'orderNumber',target_order.order_number,
    'amountMinor',target_order.total_minor,
    'priceMinor',basket_price_minor,
    'shippingChargeMinor',shipping_charge_minor,
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

create or replace function private.persist_payment_item_splits_for_service_v1(p_payment_id uuid,p_provider_payload jsonb)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  payment public.payment_records%rowtype;
  item jsonb;
  order_item public.order_items%rowtype;
  inserted_count integer:=0;
  tx_id text;
  provider_item_id uuid;
  provider_price_minor bigint;
  provider_paid_minor bigint;
  provider_submerchant_minor bigint;
  expected_submerchant_minor bigint;
begin
  if p_payment_id is null or p_provider_payload is null or jsonb_typeof(p_provider_payload)<>'object' then return 0; end if;
  select * into payment from public.payment_records where id=p_payment_id;
  if payment.id is null then raise exception 'payment_not_found' using errcode='P0002'; end if;
  if jsonb_typeof(p_provider_payload->'itemTransactions')<>'array' then return 0; end if;
  for item in select value from jsonb_array_elements(p_provider_payload->'itemTransactions')
  loop
    if jsonb_typeof(item)<>'object' then continue; end if;
    begin provider_item_id:=(item->>'itemId')::uuid; exception when others then continue; end;
    tx_id:=nullif(btrim(coalesce(item->>'paymentTransactionId','')),'');
    if tx_id is null then continue; end if;
    select * into order_item from public.order_items where id=provider_item_id and order_id=payment.order_id;
    if order_item.id is null or order_item.producer_id is null then continue; end if;
    expected_submerchant_minor:=greatest(0,order_item.line_total_minor-round((((order_item.unit_price_minor*order_item.quantity)-order_item.discount_minor)::numeric*order_item.commission_basis_points_snapshot::numeric)/10000)::bigint);
    provider_price_minor:=case when coalesce(item->>'price','') ~ '^[0-9]+([.][0-9]+)?$' then round((item->>'price')::numeric*100)::bigint else order_item.line_total_minor end;
    provider_paid_minor:=case when coalesce(item->>'paidPrice','') ~ '^[0-9]+([.][0-9]+)?$' then round((item->>'paidPrice')::numeric*100)::bigint else null end;
    provider_submerchant_minor:=case when coalesce(item->>'subMerchantPrice','') ~ '^[0-9]+([.][0-9]+)?$' then round((item->>'subMerchantPrice')::numeric*100)::bigint else expected_submerchant_minor end;
    if provider_submerchant_minor<>expected_submerchant_minor then raise exception 'provider_submerchant_split_mismatch:%',order_item.id using errcode='55000'; end if;
    insert into private.payment_item_splits(payment_id,order_id,order_item_id,producer_id,provider_payment_transaction_id,item_price_minor,provider_paid_price_minor,submerchant_price_minor,transaction_status,provider_snapshot)
    values(payment.id,payment.order_id,order_item.id,order_item.producer_id,tx_id,provider_price_minor,provider_paid_minor,provider_submerchant_minor,
      case when coalesce(item->>'transactionStatus','') ~ '^-?[0-9]+$' then (item->>'transactionStatus')::integer else null end,item)
    on conflict(payment_id,order_item_id) do update set
      provider_payment_transaction_id=excluded.provider_payment_transaction_id,
      provider_paid_price_minor=excluded.provider_paid_price_minor,
      transaction_status=excluded.transaction_status,
      provider_snapshot=excluded.provider_snapshot,
      updated_at=timezone('utc',now());
    inserted_count:=inserted_count+1;
  end loop;
  return inserted_count;
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
  split_count integer:=0;
  payment_id_value uuid;
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
  payment_id_value:=nullif(applied->>'paymentId','')::uuid;
  if normalized_status in ('authorized','captured') and payment_id_value is not null then
    split_count:=private.persist_payment_item_splits_for_service_v1(payment_id_value,safe_payload);
  end if;

  update private.payment_intents
  set status=normalized_status,
      provider_reference=normalized_reference,
      failure_code=case when normalized_status='failed' then nullif(btrim(coalesce(p_failure_code,'')),'') else null end,
      failure_message=case when normalized_status='failed' then nullif(btrim(coalesce(p_failure_message,'')),'') else null end,
      provider_result=safe_payload,
      completed_at=case when normalized_status in ('captured','failed','cancelled') then timezone('utc',now()) else null end,
      updated_at=timezone('utc',now())
  where id=intent.id;

  return jsonb_build_object('ok',true,'intentId',intent.id,'status',normalized_status,'orderId',intent.order_id,'payment',applied,'splitCount',split_count);
end;
$$;

create or replace function public.prepare_producer_submerchant_for_service_v1(p_producer_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select private.prepare_producer_submerchant_for_service_v1(p_producer_id); $$;
create or replace function public.complete_producer_submerchant_for_service_v1(p_producer_id uuid,p_submerchant_key text,p_provider_snapshot jsonb default '{}'::jsonb,p_error text default null)
returns jsonb language sql security definer set search_path='' as $$ select private.complete_producer_submerchant_for_service_v1(p_producer_id,p_submerchant_key,p_provider_snapshot,p_error); $$;
revoke all on function public.prepare_producer_submerchant_for_service_v1(uuid) from public,anon,authenticated;
revoke all on function public.complete_producer_submerchant_for_service_v1(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.prepare_producer_submerchant_for_service_v1(uuid) to service_role;
grant execute on function public.complete_producer_submerchant_for_service_v1(uuid,text,jsonb,text) to service_role;
