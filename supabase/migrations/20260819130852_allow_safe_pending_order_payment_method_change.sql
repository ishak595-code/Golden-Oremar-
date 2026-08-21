create or replace function private.set_my_pending_order_payment_method_v1(p_order_id uuid,p_payment_method_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  target_order public.orders%rowtype;
  method private.customer_payment_methods%rowtype;
  payment_config jsonb;
  configured_provider text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_order_id is null or p_payment_method_id is null then raise exception 'payment_context_required' using errcode='22023'; end if;
  select * into target_order from public.orders where id=p_order_id and user_id=caller_id for update;
  if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.status<>'pending_payment' or target_order.payment_status not in ('unpaid','failed') then raise exception 'order_payment_method_change_not_allowed' using errcode='55000'; end if;
  if target_order.reservation_expires_at is not null and target_order.reservation_expires_at<=timezone('utc',now()) then raise exception 'payment_reservation_expired' using errcode='55000'; end if;
  if exists(select 1 from private.payment_intents i where i.order_id=target_order.id and i.status in ('processing','authorized')) then raise exception 'payment_reconciliation_required' using errcode='55000'; end if;
  select coalesce(bs.public_config->'payments','{}'::jsonb) into payment_config from public.brand_settings bs where bs.slug='golden-oremar' limit 1;
  configured_provider:=nullif(lower(btrim(coalesce(payment_config->>'provider',''))),'');
  if configured_provider is null or not coalesce((payment_config->>'live_card_payments_enabled')::boolean,false) then raise exception 'payment_provider_not_configured' using errcode='55000'; end if;
  select * into method from private.customer_payment_methods where id=p_payment_method_id and user_id=caller_id and status='active';
  if method.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  if method.provider<>configured_provider then raise exception 'payment_method_provider_mismatch' using errcode='22023'; end if;
  if method.exp_year is not null and method.exp_month is not null and make_date(method.exp_year,method.exp_month,1)<date_trunc('month',timezone('utc',now()))::date then raise exception 'payment_method_expired' using errcode='22023'; end if;
  insert into private.order_payment_preferences(order_id,user_id,payment_method_id,provider,updated_at)
  values(target_order.id,caller_id,method.id,method.provider,timezone('utc',now()))
  on conflict(order_id) do update set payment_method_id=excluded.payment_method_id,provider=excluded.provider,updated_at=excluded.updated_at;
  update public.orders set payment_status='unpaid',updated_at=timezone('utc',now()) where id=target_order.id and payment_status='failed';
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('order',target_order.id,'order.payment_method_changed',jsonb_build_object('order_id',target_order.id,'user_id',caller_id,'payment_method_id',method.id,'provider',method.provider));
  return jsonb_build_object('ok',true,'orderId',target_order.id,'paymentMethodId',method.id,'provider',method.provider,'paymentStatus','unpaid');
end;
$$;
create or replace function public.set_my_pending_order_payment_method_v1(p_order_id uuid,p_payment_method_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select private.set_my_pending_order_payment_method_v1(p_order_id,p_payment_method_id); $$;
revoke all on function public.set_my_pending_order_payment_method_v1(uuid,uuid) from public,anon;
grant execute on function public.set_my_pending_order_payment_method_v1(uuid,uuid) to authenticated;
