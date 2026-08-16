begin;

update public.brand_settings
set public_config = jsonb_set(
  coalesce(public_config, '{}'::jsonb),
  '{payments}',
  coalesce(public_config -> 'payments', '{}'::jsonb) || jsonb_build_object(
    'mode', coalesce(nullif(public_config -> 'payments' ->> 'mode', ''), 'manual_confirmation'),
    'live_card_payments_enabled', coalesce((public_config -> 'payments' ->> 'live_card_payments_enabled')::boolean, false),
    'provider', nullif(public_config -> 'payments' ->> 'provider', ''),
    'requires_provider_configuration', not coalesce((public_config -> 'payments' ->> 'live_card_payments_enabled')::boolean, false)
  ),
  true
)
where slug = 'default';

create or replace function public.get_checkout_payment_readiness_v1()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'mode', coalesce(nullif(bs.public_config -> 'payments' ->> 'mode', ''), 'manual_confirmation'),
    'liveCardPaymentsEnabled', coalesce((bs.public_config -> 'payments' ->> 'live_card_payments_enabled')::boolean, false),
    'provider', nullif(bs.public_config -> 'payments' ->> 'provider', ''),
    'requiresProviderConfiguration', not coalesce((bs.public_config -> 'payments' ->> 'live_card_payments_enabled')::boolean, false),
    'paymentVerificationRequired', true,
    'storesProviderSecretsClientSide', false
  )
  from public.brand_settings bs
  where bs.slug = 'default'
  limit 1;
$$;

revoke all on function public.get_checkout_payment_readiness_v1() from public;
grant execute on function public.get_checkout_payment_readiness_v1() to anon, authenticated;

commit;
