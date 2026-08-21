create or replace function public.remove_my_payment_method_v1(p_payment_method_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  target private.customer_payment_methods%rowtype;
  replacement_id uuid;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_payment_method_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;

  select * into target
  from private.customer_payment_methods p
  where p.id=p_payment_method_id and p.user_id=uid and p.status in ('active','expired')
  for update;
  if target.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;

  update private.customer_payment_methods
  set status='removed',is_default=false,updated_at=timezone('utc',now())
  where id=target.id;

  if target.is_default then
    select p.id into replacement_id
    from private.customer_payment_methods p
    where p.user_id=uid and p.status='active' and p.id<>target.id
    order by p.created_at desc
    limit 1
    for update;
    if replacement_id is not null then
      update private.customer_payment_methods set is_default=true,updated_at=timezone('utc',now()) where id=replacement_id;
    end if;
  end if;

  return jsonb_build_object('ok',true,'removedId',target.id,'newDefaultId',replacement_id);
end;
$function$;
revoke all on function public.remove_my_payment_method_v1(uuid) from public,anon;
grant execute on function public.remove_my_payment_method_v1(uuid) to authenticated;

create or replace function public.get_checkout_payment_readiness_v2()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'mode', coalesce(nullif(bs.public_config -> 'payments' ->> 'mode', ''), 'manual_confirmation'),
    'liveCardPaymentsEnabled', coalesce((bs.public_config -> 'payments' ->> 'live_card_payments_enabled')::boolean, false),
    'provider', nullif(bs.public_config -> 'payments' ->> 'provider', ''),
    'savedPaymentMethodsSupported', coalesce((bs.public_config -> 'payments' ->> 'saved_payment_methods_enabled')::boolean, false),
    'providerHostedCardEntryRequired', true,
    'requiresProviderConfiguration', not coalesce((bs.public_config -> 'payments' ->> 'live_card_payments_enabled')::boolean, false),
    'paymentVerificationRequired', true,
    'storesProviderSecretsClientSide', false,
    'storesRawCardData', false
  )
  from public.brand_settings bs
  where bs.slug='golden-oremar'
  limit 1;
$function$;
revoke all on function public.get_checkout_payment_readiness_v2() from public;
grant execute on function public.get_checkout_payment_readiness_v2() to anon,authenticated;
