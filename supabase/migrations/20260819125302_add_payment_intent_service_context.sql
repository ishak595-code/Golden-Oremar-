create or replace function private.get_payment_intent_for_service_v1(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  intent private.payment_intents%rowtype;
  target_order public.orders%rowtype;
  price_minor bigint;
begin
  if p_intent_id is null then raise exception 'payment_intent_required' using errcode='22023'; end if;
  select * into intent from private.payment_intents where id=p_intent_id;
  if intent.id is null then raise exception 'payment_intent_not_found' using errcode='P0002'; end if;

  if intent.subject_type='order' then
    select * into target_order from public.orders where id=intent.order_id;
    if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
    select coalesce(sum(oi.line_total_minor),0)::bigint into price_minor from public.order_items oi where oi.order_id=target_order.id;
    return jsonb_build_object(
      'intentId',intent.id,
      'subjectType','order',
      'subjectId',target_order.id,
      'userId',intent.user_id,
      'provider',intent.provider,
      'intentStatus',intent.status,
      'providerReference',intent.provider_reference,
      'amountMinor',intent.amount_minor,
      'priceMinor',price_minor,
      'currency',intent.currency,
      'orderId',target_order.id,
      'orderNumber',target_order.order_number,
      'orderStatus',target_order.status,
      'paymentStatus',target_order.payment_status
    );
  end if;

  if intent.subject_type='event_reservation' then
    return jsonb_build_object(
      'intentId',intent.id,
      'subjectType','event_reservation',
      'subjectId',intent.subject_id,
      'userId',intent.user_id,
      'provider',intent.provider,
      'intentStatus',intent.status,
      'providerReference',intent.provider_reference,
      'amountMinor',intent.amount_minor,
      'currency',intent.currency
    );
  end if;

  raise exception 'unsupported_payment_subject_type' using errcode='55000';
end;
$$;

create or replace function public.get_payment_intent_for_service_v1(p_intent_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select private.get_payment_intent_for_service_v1(p_intent_id); $$;
revoke all on function public.get_payment_intent_for_service_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_payment_intent_for_service_v1(uuid) to service_role;
