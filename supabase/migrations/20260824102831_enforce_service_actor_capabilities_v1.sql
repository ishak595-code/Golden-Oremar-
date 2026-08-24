do $$
declare r text; fn_oid oid; old_def text; new_def text;
begin
  foreach r in array array[
    'private.prepare_order_settlement_for_service_v1(uuid,uuid)',
    'private.fail_order_settlement_for_service_v1(uuid,uuid,text)',
    'private.complete_order_settlement_item_for_service_v1(uuid,uuid,text,jsonb)'
  ] loop
    fn_oid:=to_regprocedure(r);
    old_def:=pg_get_functiondef(fn_oid);
    new_def:=replace(old_def,'private.is_super_admin_user_v1(p_actor_user_id)','private.user_has_permission_v1(p_actor_user_id,''payout.release'')');
    new_def:=replace(new_def,$old$raise exception 'super_admin_required'$old$,$new$raise exception 'permission_required:payout.release'$new$);
    if new_def=old_def then raise exception 'settlement actor capability rewrite failed: %',r; end if;
    execute new_def;
  end loop;
end $$;

create or replace function public.get_event_refund_context_for_service_v1(p_requester_id uuid,p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  f private.event_reservation_finance%rowtype;
  r public.event_reservations%rowtype;
  i private.payment_intents%rowtype;
  requester_can_execute boolean:=false;
  transaction_id text;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_requester_id is null or p_reservation_id is null then raise exception 'refund_context_required' using errcode='22023'; end if;
  requester_can_execute:=private.user_has_permission_v1(p_requester_id,'refund.execute');
  select * into r from public.event_reservations where id=p_reservation_id;
  select * into f from private.event_reservation_finance where reservation_id=p_reservation_id;
  if r.id is null or f.reservation_id is null then raise exception 'event_refund_context_not_found' using errcode='P0002'; end if;
  if r.user_id<>p_requester_id and not requester_can_execute then raise exception 'refund_not_allowed' using errcode='42501'; end if;
  if f.payment_status='refunded' then return jsonb_build_object('reservationId',r.id,'userId',r.user_id,'status','refunded','amountMinor',f.total_minor,'currency',f.currency,'attemptCount',f.refund_attempt_count); end if;
  if f.payment_status<>'refund_required' or f.provider<>'iyzico' or f.provider_reference is null then raise exception 'event_refund_not_required' using errcode='55000'; end if;
  select * into i from private.payment_intents where subject_type='event_reservation' and subject_id=r.id and status='captured' and provider='iyzico' order by created_at desc limit 1;
  if i.id is null then raise exception 'refund_payment_intent_not_found' using errcode='P0002'; end if;
  select nullif(x->>'paymentTransactionId','') into transaction_id from jsonb_array_elements(case when jsonb_typeof(i.provider_result->'itemTransactions')='array' then i.provider_result->'itemTransactions' else '[]'::jsonb end) x where nullif(x->>'paymentTransactionId','') is not null limit 1;
  if transaction_id is null then raise exception 'refund_transaction_id_missing' using errcode='55000'; end if;
  return jsonb_build_object('reservationId',r.id,'userId',r.user_id,'eventId',r.event_id,'intentId',i.id,'provider','iyzico','providerReference',f.provider_reference,'paymentTransactionId',transaction_id,'amountMinor',f.total_minor,'currency',f.currency,'attemptCount',f.refund_attempt_count,'lastError',f.last_refund_error,'lastAttemptAt',f.last_refund_attempt_at,'requesterCanExecuteRefund',requester_can_execute,'requesterIsSuperAdmin',private.user_has_permission_v1(p_requester_id,'role.manage'));
end;
$$;
revoke all on function public.get_event_refund_context_for_service_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_refund_context_for_service_v1(uuid,uuid) to service_role;