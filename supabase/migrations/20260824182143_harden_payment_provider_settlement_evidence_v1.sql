create or replace function private.validate_order_provider_item_transactions_v1(
  p_order_id uuid,
  p_provider_payload jsonb
)
returns integer
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
  expected_count integer:=0;
  provider_count integer:=0;
begin
  if p_order_id is null then raise exception 'order_required' using errcode='22023'; end if;
  if jsonb_typeof(payload)<>'object' or payload->>'signatureVerified'<>'true' then
    raise exception 'verified_provider_payload_required' using errcode='55000';
  end if;
  if jsonb_typeof(payload->'itemTransactions')<>'array' then
    raise exception 'provider_item_transactions_required' using errcode='55000';
  end if;

  select count(*)::integer into expected_count
  from public.order_items oi
  where oi.order_id=p_order_id;
  if expected_count<1 or expected_count>100 then
    raise exception 'invalid_order_item_count' using errcode='55000';
  end if;

  provider_count:=jsonb_array_length(payload->'itemTransactions');
  if provider_count<>expected_count then
    raise exception 'provider_item_transaction_count_mismatch' using errcode='55000';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(payload->'itemTransactions') tx
    where jsonb_typeof(tx)<>'object'
      or nullif(btrim(coalesce(tx->>'itemId','')),'') is null
      or nullif(btrim(coalesce(tx->>'paymentTransactionId','')),'') is null
      or char_length(btrim(coalesce(tx->>'paymentTransactionId','')))>220
  ) then
    raise exception 'provider_item_transaction_invalid' using errcode='55000';
  end if;

  if (
    select count(distinct tx->>'itemId')
    from jsonb_array_elements(payload->'itemTransactions') tx
  )<>provider_count then
    raise exception 'provider_item_id_duplicate' using errcode='55000';
  end if;

  if (
    select count(distinct tx->>'paymentTransactionId')
    from jsonb_array_elements(payload->'itemTransactions') tx
  )<>provider_count then
    raise exception 'provider_payment_transaction_duplicate' using errcode='55000';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(payload->'itemTransactions') tx
    where not exists(
      select 1 from public.order_items oi
      where oi.order_id=p_order_id and oi.id::text=tx->>'itemId'
    )
  ) then
    raise exception 'provider_item_reference_mismatch' using errcode='55000';
  end if;

  if exists(
    select 1
    from public.order_items oi
    left join lateral(
      select tx
      from jsonb_array_elements(payload->'itemTransactions') tx
      where tx->>'itemId'=oi.id::text
      limit 1
    ) matched on true
    where oi.order_id=p_order_id
      and (
        matched.tx is null
        or coalesce(matched.tx->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
        or round((matched.tx->>'price')::numeric*100)::bigint<>oi.line_total_minor
        or coalesce(matched.tx->>'subMerchantPrice','') !~ '^[0-9]+([.][0-9]+)?$'
        or round((matched.tx->>'subMerchantPrice')::numeric*100)::bigint<>
          greatest(0,oi.line_total_minor-round((((oi.unit_price_minor*oi.quantity)-oi.discount_minor)::numeric*oi.commission_basis_points_snapshot::numeric)/10000)::bigint)
      )
  ) then
    raise exception 'provider_item_financial_mismatch' using errcode='55000';
  end if;

  return expected_count;
end;
$$;

revoke all on function private.validate_order_provider_item_transactions_v1(uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function private.validate_event_provider_item_transaction_v1(
  p_reservation_id uuid,
  p_provider_payload jsonb
)
returns integer
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
  finance private.event_reservation_finance%rowtype;
  tx jsonb;
  tx_id text;
begin
  if p_reservation_id is null then raise exception 'event_reservation_required' using errcode='22023'; end if;
  if jsonb_typeof(payload)<>'object' or payload->>'signatureVerified'<>'true' then
    raise exception 'verified_provider_payload_required' using errcode='55000';
  end if;
  if jsonb_typeof(payload->'itemTransactions')<>'array' or jsonb_array_length(payload->'itemTransactions')<>1 then
    raise exception 'provider_event_item_transaction_required' using errcode='55000';
  end if;

  select * into finance
  from private.event_reservation_finance f
  where f.reservation_id=p_reservation_id;
  if finance.reservation_id is null or finance.total_minor<=0 then
    raise exception 'event_payment_context_not_found' using errcode='P0002';
  end if;

  tx:=payload->'itemTransactions'->0;
  if jsonb_typeof(tx)<>'object' or tx->>'itemId'<>p_reservation_id::text then
    raise exception 'provider_event_item_reference_mismatch' using errcode='55000';
  end if;
  tx_id:=nullif(btrim(coalesce(tx->>'paymentTransactionId','')),'');
  if tx_id is null or char_length(tx_id)>220 then
    raise exception 'provider_event_payment_transaction_invalid' using errcode='55000';
  end if;
  if coalesce(tx->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
    or round((tx->>'price')::numeric*100)::bigint<>finance.total_minor then
    raise exception 'provider_event_price_mismatch' using errcode='55000';
  end if;
  if finance.producer_id is not null and (
    coalesce(tx->>'subMerchantPrice','') !~ '^[0-9]+([.][0-9]+)?$'
    or round((tx->>'subMerchantPrice')::numeric*100)::bigint<>finance.producer_net_minor
  ) then
    raise exception 'provider_event_submerchant_split_mismatch' using errcode='55000';
  end if;

  return 1;
end;
$$;

revoke all on function private.validate_event_provider_item_transaction_v1(uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function private.complete_order_payment_for_service_v2(
  p_intent_id uuid,
  p_provider_reference text,
  p_payment_method_type text,
  p_status text,
  p_provider_payload jsonb default '{}'::jsonb,
  p_failure_code text default null,
  p_failure_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  intent private.payment_intents%rowtype;
  normalized_method text:=lower(btrim(coalesce(p_payment_method_type,'')));
  normalized_status text:=lower(btrim(coalesce(p_status,'')));
  normalized_reference text:=btrim(coalesce(p_provider_reference,''));
  safe_payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
  applied jsonb;
  expected_split_count integer:=0;
  persisted_split_count integer:=0;
  payment_id_value uuid;
begin
  if p_intent_id is null then raise exception 'payment_intent_required' using errcode='22023'; end if;
  if normalized_method not in ('card','bank_transfer','wallet','other') then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  if normalized_status not in ('authorized','captured','failed','cancelled') then raise exception 'invalid_payment_status' using errcode='22023'; end if;
  if char_length(normalized_reference) not between 4 and 220 then raise exception 'invalid_payment_reference' using errcode='22023'; end if;
  if jsonb_typeof(safe_payload)<>'object' then raise exception 'invalid_provider_payload' using errcode='22023'; end if;

  select * into intent from private.payment_intents where id=p_intent_id for update;
  if intent.id is null or intent.subject_type<>'order' or intent.order_id is null then raise exception 'payment_intent_not_found' using errcode='P0002'; end if;
  if intent.status='captured' then return jsonb_build_object('ok',true,'intentId',intent.id,'status','captured','unchanged',true,'orderId',intent.order_id); end if;
  if intent.status in ('failed','cancelled') and normalized_status=intent.status then return jsonb_build_object('ok',true,'intentId',intent.id,'status',intent.status,'unchanged',true,'orderId',intent.order_id); end if;
  if intent.status not in ('processing','authorized') then raise exception 'invalid_intent_transition' using errcode='22023'; end if;

  if normalized_status in ('authorized','captured') then
    expected_split_count:=private.validate_order_provider_item_transactions_v1(intent.order_id,safe_payload);
  end if;

  applied:=private.apply_verified_payment_v1(intent.order_id,intent.provider,normalized_reference,normalized_method,intent.amount_minor,intent.currency,normalized_status,null);
  payment_id_value:=nullif(applied->>'paymentId','')::uuid;

  if normalized_status in ('authorized','captured') then
    if payment_id_value is null then raise exception 'payment_record_required' using errcode='55000'; end if;
    persisted_split_count:=private.persist_payment_item_splits_for_service_v1(payment_id_value,safe_payload);
    if persisted_split_count<>expected_split_count then
      raise exception 'provider_item_split_persistence_mismatch' using errcode='55000';
    end if;
  end if;

  update private.payment_intents
  set status=normalized_status,
      provider_reference=normalized_reference,
      failure_code=case when normalized_status='failed' then nullif(btrim(coalesce(p_failure_code,'')),'') else null end,
      failure_message=case when normalized_status='failed' then nullif(btrim(coalesce(p_failure_message,'')),'') else null end,
      provider_result=provider_result||safe_payload,
      completed_at=case when normalized_status in ('captured','failed','cancelled') then timezone('utc',now()) else null end,
      updated_at=timezone('utc',now())
  where id=intent.id;

  return jsonb_build_object('ok',true,'intentId',intent.id,'status',normalized_status,'orderId',intent.order_id,'payment',applied,'splitCount',persisted_split_count);
end;
$$;

revoke all on function private.complete_order_payment_for_service_v2(uuid,text,text,text,jsonb,text,text) from public,anon,authenticated,service_role;

create or replace function private.complete_event_reservation_payment_for_service_v1(
  p_intent_id uuid,
  p_provider_reference text,
  p_payment_method_type text,
  p_status text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  intent private.payment_intents%rowtype;
  r public.event_reservations%rowtype;
  f private.event_reservation_finance%rowtype;
  e public.events%rowtype;
  payment public.payment_records%rowtype;
  method text:=lower(btrim(coalesce(p_payment_method_type,'')));
  st text:=lower(btrim(coalesce(p_status,'')));
  ref text:=btrim(coalesce(p_provider_reference,''));
  payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
  other_guests bigint:=0;
  can_honor boolean:=true;
  event_key text;
  validated_item_count integer:=0;
begin
  if method not in ('card','bank_transfer','wallet','other') or st not in ('authorized','captured') then raise exception 'invalid_payment_completion' using errcode='22023'; end if;
  if char_length(ref) not between 4 and 220 or jsonb_typeof(payload)<>'object' then raise exception 'invalid_provider_payment' using errcode='22023'; end if;

  select * into intent from private.payment_intents where id=p_intent_id for update;
  if intent.id is null or intent.subject_type<>'event_reservation' then raise exception 'payment_intent_not_found' using errcode='P0002'; end if;
  if intent.status='captured' then return jsonb_build_object('ok',true,'intentId',intent.id,'status','captured','subjectType','event_reservation','reservationId',intent.subject_id,'unchanged',true); end if;
  if intent.status not in ('processing','authorized') then raise exception 'invalid_intent_transition' using errcode='22023'; end if;

  select * into r from public.event_reservations where id=intent.subject_id for update;
  select * into f from private.event_reservation_finance where reservation_id=intent.subject_id for update;
  select * into e from public.events where id=r.event_id for update;
  if r.id is null or f.reservation_id is null or e.id is null or f.user_id<>intent.user_id or f.total_minor<>intent.amount_minor or f.currency<>intent.currency then raise exception 'event_payment_context_mismatch' using errcode='55000'; end if;

  validated_item_count:=private.validate_event_provider_item_transaction_v1(r.id,payload);
  if validated_item_count<>1 then raise exception 'provider_event_item_transaction_required' using errcode='55000'; end if;

  select * into payment from public.payment_records where provider=intent.provider and provider_reference=ref for update;
  if payment.id is null then
    insert into public.payment_records(subject_type,subject_id,order_id,user_id,provider,provider_reference,payment_method_type,amount_minor,currency,status,authorized_at,captured_at)
    values('event_reservation',r.id,null,intent.user_id,intent.provider,ref,method,intent.amount_minor,intent.currency,st,case when st in ('authorized','captured') then timezone('utc',now()) else null end,case when st='captured' then timezone('utc',now()) else null end)
    returning * into payment;
  elsif payment.subject_type<>'event_reservation' or payment.subject_id<>r.id or payment.amount_minor<>intent.amount_minor or payment.currency<>intent.currency then
    raise exception 'payment_provider_reference_conflict' using errcode='23505';
  else
    update public.payment_records
    set status=st,payment_method_type=method,authorized_at=coalesce(authorized_at,timezone('utc',now())),captured_at=case when st='captured' then coalesce(captured_at,timezone('utc',now())) else captured_at end,updated_at=timezone('utc',now())
    where id=payment.id returning * into payment;
  end if;

  insert into private.payment_events(provider,provider_event_id,payment_id,event_type,payload,signature_verified,processing_status,processed_at)
  values(intent.provider,ref||':'||st||':event-reservation',payment.id,'payment.'||st,payload,true,'processed',timezone('utc',now()))
  on conflict(provider,provider_event_id) do nothing;

  if st='authorized' then
    update private.event_reservation_finance set payment_status='authorized',provider=intent.provider,provider_reference=ref,updated_at=timezone('utc',now()) where reservation_id=r.id;
    update private.payment_intents set status='authorized',provider_reference=ref,provider_result=provider_result||payload,updated_at=timezone('utc',now()) where id=intent.id;
    return jsonb_build_object('ok',true,'intentId',intent.id,'status','authorized','subjectType','event_reservation','reservationId',r.id,'refundRequired',false);
  end if;

  if f.payment_expires_at is not null and f.payment_expires_at<=timezone('utc',now()) then
    select coalesce(sum(orx.guest_count),0) into other_guests
    from public.event_reservations orx
    left join private.event_reservation_finance ofx on ofx.reservation_id=orx.id
    where orx.event_id=e.id and orx.id<>r.id
      and (orx.status in ('pending','confirmed','attended') or (orx.status='pending_payment' and (ofx.payment_status='authorized' or (ofx.payment_status='pending' and ofx.payment_expires_at>timezone('utc',now())))));
    if e.capacity is not null and other_guests+r.guest_count>e.capacity then can_honor:=false; end if;
  end if;

  update private.payment_intents set status='captured',provider_reference=ref,provider_result=provider_result||payload,completed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=intent.id;

  if not can_honor then
    update private.event_reservation_finance set payment_status='refund_required',provider=intent.provider,provider_reference=ref,paid_at=timezone('utc',now()),updated_at=timezone('utc',now()) where reservation_id=r.id;
    update public.event_reservations set status='cancelled',updated_at=timezone('utc',now()) where id=r.id;
    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('event_reservation',r.id,'event.payment_refund_required',jsonb_build_object('reservation_id',r.id,'event_id',e.id,'payment_id',payment.id,'provider_reference',ref,'amount_minor',f.total_minor,'currency',f.currency));
    return jsonb_build_object('ok',true,'intentId',intent.id,'status','captured','subjectType','event_reservation','reservationId',r.id,'refundRequired',true);
  end if;

  update private.event_reservation_finance set payment_status='paid',provider=intent.provider,provider_reference=ref,paid_at=timezone('utc',now()),updated_at=timezone('utc',now()) where reservation_id=r.id;
  update public.event_reservations set status='confirmed',updated_at=timezone('utc',now()) where id=r.id;

  if f.producer_id is not null then
    event_key:='event_reservation:'||r.id::text||':sale';
    insert into private.producer_ledger_entries(producer_id,event_reservation_id,entry_type,currency,merchandise_minor,tax_minor,producer_gross_minor,platform_fee_minor,producer_net_minor,commission_basis_points,availability_status,available_at,source_key,metadata)
    values(f.producer_id,r.id,'sale',f.currency,f.total_minor,0,f.total_minor,f.platform_fee_minor,f.producer_net_minor,f.commission_basis_points_snapshot,'pending',e.ends_at,event_key,jsonb_build_object('event_id',e.id,'event_title',e.title,'reservation_code',r.reservation_code,'payment_id',payment.id))
    on conflict(source_key) do nothing;

    insert into private.payment_item_splits(payment_id,order_id,order_item_id,event_reservation_id,producer_id,provider_payment_transaction_id,item_price_minor,provider_paid_price_minor,submerchant_price_minor,transaction_status,approval_status,provider_snapshot)
    select payment.id,null,null,r.id,f.producer_id,nullif(x->>'paymentTransactionId',''),f.total_minor,
      case when (x->>'paidPrice')~'^[0-9]+([.][0-9]+)?$' then round((x->>'paidPrice')::numeric*100)::bigint else null end,
      f.producer_net_minor,
      case when (x->>'transactionStatus')~'^-?[0-9]+$' then (x->>'transactionStatus')::integer else null end,
      'pending',x
    from jsonb_array_elements(payload->'itemTransactions') x
    limit 1
    on conflict(payment_id,event_reservation_id) where event_reservation_id is not null
    do update set
      provider_payment_transaction_id=excluded.provider_payment_transaction_id,
      provider_paid_price_minor=excluded.provider_paid_price_minor,
      transaction_status=excluded.transaction_status,
      provider_snapshot=excluded.provider_snapshot,
      updated_at=timezone('utc',now());
  end if;

  if e.capacity is not null and (
    select coalesce(sum(rr.guest_count),0)
    from public.event_reservations rr
    left join private.event_reservation_finance ff on ff.reservation_id=rr.id
    where rr.event_id=e.id
      and (rr.status in ('pending','confirmed','attended') or (rr.status='pending_payment' and (ff.payment_status='authorized' or (ff.payment_status='pending' and ff.payment_expires_at>timezone('utc',now())))))
  )>=e.capacity then
    update public.events set status='sold_out',updated_at=timezone('utc',now()) where id=e.id and status='published';
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('event_reservation',r.id,'event.payment_captured',jsonb_build_object('reservation_id',r.id,'event_id',e.id,'payment_id',payment.id,'user_id',r.user_id));

  return jsonb_build_object('ok',true,'intentId',intent.id,'status','captured','subjectType','event_reservation','reservationId',r.id,'paymentId',payment.id,'refundRequired',false);
end;
$$;

revoke all on function private.complete_event_reservation_payment_for_service_v1(uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
