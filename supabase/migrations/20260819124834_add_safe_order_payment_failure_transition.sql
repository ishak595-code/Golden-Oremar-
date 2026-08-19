create or replace function private.fail_order_payment_intent_for_service_v1(
  p_intent_id uuid,
  p_failure_code text,
  p_failure_message text,
  p_provider_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  intent private.payment_intents%rowtype;
  target_order public.orders%rowtype;
  safe_code text:=nullif(btrim(coalesce(p_failure_code,'')),'');
  safe_message text:=nullif(btrim(coalesce(p_failure_message,'')),'');
  safe_payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
begin
  if p_intent_id is null then raise exception 'payment_intent_required' using errcode='22023'; end if;
  if safe_code is null or char_length(safe_code)>120 or safe_code ~ '[[:cntrl:]]' then raise exception 'invalid_failure_code' using errcode='22023'; end if;
  if safe_message is not null and (char_length(safe_message)>500 or safe_message ~ '[[:cntrl:]]') then raise exception 'invalid_failure_message' using errcode='22023'; end if;
  if jsonb_typeof(safe_payload)<>'object' then raise exception 'invalid_provider_payload' using errcode='22023'; end if;

  select * into intent from private.payment_intents where id=p_intent_id for update;
  if intent.id is null or intent.subject_type<>'order' or intent.order_id is null then raise exception 'payment_intent_not_found' using errcode='P0002'; end if;
  if intent.status='captured' then raise exception 'captured_payment_cannot_fail' using errcode='55000'; end if;
  if intent.status='failed' then return jsonb_build_object('ok',true,'intentId',intent.id,'status','failed','orderId',intent.order_id,'unchanged',true); end if;
  if intent.status not in ('created','processing','authorized') then raise exception 'invalid_intent_transition' using errcode='22023'; end if;

  select * into target_order from public.orders where id=intent.order_id for update;
  if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.payment_status='paid' then raise exception 'paid_order_cannot_fail' using errcode='55000'; end if;

  update private.payment_intents
  set status='failed',failure_code=safe_code,failure_message=safe_message,provider_result=safe_payload,completed_at=timezone('utc',now()),updated_at=timezone('utc',now())
  where id=intent.id;

  if target_order.status='pending_payment' then
    update public.orders set payment_status='failed',updated_at=timezone('utc',now()) where id=target_order.id;
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('payment_intent',intent.id,'payment.failed',jsonb_build_object('intent_id',intent.id,'order_id',intent.order_id,'failure_code',safe_code));

  return jsonb_build_object('ok',true,'intentId',intent.id,'status','failed','orderId',intent.order_id,'orderStatus',target_order.status,'paymentStatus','failed');
end;
$$;

create or replace function public.fail_order_payment_intent_for_service_v1(p_intent_id uuid,p_failure_code text,p_failure_message text,p_provider_payload jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path='' as $$ select private.fail_order_payment_intent_for_service_v1(p_intent_id,p_failure_code,p_failure_message,p_provider_payload); $$;
revoke all on function public.fail_order_payment_intent_for_service_v1(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.fail_order_payment_intent_for_service_v1(uuid,text,text,jsonb) to service_role;
