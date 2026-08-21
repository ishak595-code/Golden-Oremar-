create or replace function public.get_checkout_payment_readiness_v3()
returns jsonb
language sql
stable
set search_path='public'
as $$
  select jsonb_build_object(
    'mode',coalesce(nullif(bs.public_config->'payments'->>'mode',''),'manual_confirmation'),
    'liveCardPaymentsEnabled',coalesce((bs.public_config->'payments'->>'live_card_payments_enabled')::boolean,false),
    'provider',nullif(lower(btrim(bs.public_config->'payments'->>'provider')),''),
    'savedPaymentMethodsSupported',coalesce((bs.public_config->'payments'->>'saved_payment_methods_enabled')::boolean,false),
    'cardEnrollmentEnabled',
      coalesce((bs.public_config->'payments'->>'card_enrollment_enabled')::boolean,false)
      and nullif(lower(btrim(bs.public_config->'payments'->>'provider')),'') is not null,
    'cardEnrollmentMode',case
      when lower(coalesce(bs.public_config->'payments'->>'provider',''))='iyzico' then 'provider_card_storage_api'
      else 'provider_tokenization'
    end,
    'vaultEdgeFunction','payment-method-vault',
    'providerHostedCardEntryRequired',false,
    'requiresProviderConfiguration',
      nullif(lower(btrim(bs.public_config->'payments'->>'provider')),'') is null
      or not coalesce((bs.public_config->'payments'->>'live_card_payments_enabled')::boolean,false),
    'paymentVerificationRequired',true,
    'storesProviderSecretsClientSide',false,
    'storesRawCardData',false,
    'storesCvv',false
  )
  from public.brand_settings bs
  where bs.slug='golden-oremar'
  limit 1;
$$;
revoke all on function public.get_checkout_payment_readiness_v3() from public;
grant execute on function public.get_checkout_payment_readiness_v3() to anon,authenticated;