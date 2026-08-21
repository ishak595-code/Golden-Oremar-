grant usage on schema private to anon, authenticated, service_role;

create or replace function private.get_checkout_payment_capabilities_v2()
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'provider','iyzico',
    'hostedCheckout',coalesce((cfg->>'checkout_form_enabled')::boolean,false),
    'savedCardPayment',coalesce((cfg->>'live_card_payments_enabled')::boolean,false),
    'cardEnrollment',coalesce((cfg->>'card_enrollment_enabled')::boolean,false)
  )
  from (
    select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) cfg
    from public.brand_settings bs where bs.slug='golden-oremar'
  ) s;
$$;

create or replace function private.get_checkout_payment_readiness_v3()
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'mode','provider_checkout',
    'liveCardPaymentsEnabled',coalesce((cfg->>'live_card_payments_enabled')::boolean,false),
    'provider','iyzico',
    'savedPaymentMethodsSupported',coalesce((cfg->>'live_card_payments_enabled')::boolean,false),
    'cardEnrollmentEnabled',coalesce((cfg->>'card_enrollment_enabled')::boolean,false),
    'cardEnrollmentMode','provider_card_storage_api',
    'vaultEdgeFunction','payment-method-vault',
    'providerHostedCardEntryRequired',false,
    'requiresProviderConfiguration',not (coalesce((cfg->>'checkout_form_enabled')::boolean,false) or coalesce((cfg->>'live_card_payments_enabled')::boolean,false)),
    'paymentVerificationRequired',true,
    'storesProviderSecretsClientSide',false,
    'storesRawCardData',false,
    'storesCvv',false
  )
  from (
    select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) cfg
    from public.brand_settings bs where bs.slug='golden-oremar'
  ) s;
$$;

revoke all on function private.get_checkout_payment_capabilities_v2() from public;
revoke all on function private.get_checkout_payment_readiness_v3() from public;
grant execute on function private.get_checkout_payment_capabilities_v2() to anon,authenticated,service_role;
grant execute on function private.get_checkout_payment_readiness_v3() to anon,authenticated,service_role;

create or replace function public.get_checkout_payment_capabilities_v2()
returns jsonb
language sql
stable security invoker
set search_path to ''
as $$ select private.get_checkout_payment_capabilities_v2(); $$;

create or replace function public.get_checkout_payment_readiness_v3()
returns jsonb
language sql
stable security invoker
set search_path to ''
as $$ select private.get_checkout_payment_readiness_v3(); $$;

alter function public.cancel_stock_alert_by_token_v1(text) security invoker;
alter function public.catalog_search_suggestions_v1(text,integer) security invoker;
alter function public.check_product_export_eligibility_v1(uuid,text) security invoker;
alter function public.confirm_newsletter_v1(text) security invoker;
alter function public.get_account_help_content_v1(text) security invoker;
alter function public.get_product_reviews_v1(uuid,integer,integer) security invoker;
alter function public.get_public_brand_appearance_v1() security invoker;
alter function public.get_public_contact_config_v1() security invoker;
alter function public.get_public_content_entry_v3(text,text) security invoker;
alter function public.get_public_home_catalog_v3() security invoker;
alter function public.get_public_producer_follow_metrics_v1(uuid[]) security invoker;
alter function public.get_public_producer_profile_v3(text) security invoker;
alter function public.get_public_product_detail_v6(text) security invoker;
alter function public.get_public_product_handling_profiles_v1(uuid[]) security invoker;
alter function public.get_public_product_safety_v3(text,text) security invoker;
alter function public.get_public_storefront_config_v2(text) security invoker;
alter function public.list_public_categories_v2() security invoker;
alter function public.list_public_content_v1(text,text,integer,integer) security invoker;
alter function public.list_public_events_v1(boolean) security invoker;
alter function public.list_public_faq_v1(text) security invoker;
alter function public.list_public_producers_v1(text,text,text,text,integer,integer) security invoker;
alter function public.list_public_production_locations_v1(text,text,text,integer) security invoker;
alter function public.report_client_error_v1(text,text,text,text,text,jsonb) security invoker;
alter function public.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) security invoker;
alter function public.submit_contact_message(text,text,text,text,text,text,text,text,text,text,text) security invoker;
alter function public.submit_event_reservation(text,text,text,text,text,text,integer,text,text) security invoker;
alter function public.subscribe_newsletter_v1(text,text,text,text) security invoker;
alter function public.subscribe_stock_alert_v1(uuid,text,text) security invoker;
alter function public.unsubscribe_newsletter_v1(text) security invoker;

revoke all on function private.cancel_stock_alert_by_token_v1(text) from public;
revoke all on function private.catalog_search_suggestions_v1(text,integer) from public;
revoke all on function private.check_product_export_eligibility_v1(uuid,text) from public;
revoke all on function private.confirm_newsletter_v1(text) from public;
revoke all on function private.get_account_help_content_v1(text) from public;
revoke all on function private.get_product_reviews_v1(uuid,integer,integer) from public;
revoke all on function private.get_public_brand_appearance_v1() from public;
revoke all on function private.get_public_contact_config_v1() from public;
revoke all on function private.get_public_content_entry_v3(text,text) from public;
revoke all on function private.get_public_home_catalog_v3() from public;
revoke all on function private.get_public_producer_follow_metrics_v1(uuid[]) from public;
revoke all on function private.get_public_producer_profile_v5(text) from public;
revoke all on function private.get_public_product_detail_v7(text) from public;
revoke all on function private.get_public_product_handling_profiles_v1(uuid[]) from public;
revoke all on function private.get_public_product_safety_v3(text,text) from public;
revoke all on function private.get_public_storefront_config_v2(text) from public;
revoke all on function private.list_public_categories_v2() from public;
revoke all on function private.list_public_content_v2(text,text,integer,integer) from public;
revoke all on function private.list_public_events_v2(boolean) from public;
revoke all on function private.list_public_faq_v1(text) from public;
revoke all on function private.list_public_producers_v1(text,text,text,text,integer,integer) from public;
revoke all on function private.list_public_production_locations_v1(text,text,text,integer) from public;
revoke all on function private.report_client_error_v1(text,text,text,text,text,jsonb) from public;
revoke all on function private.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public;
revoke all on function private.submit_contact_message(text,text,text,text,text,text,text,text,text,text,text) from public;
revoke all on function private.submit_event_reservation(text,text,text,text,text,text,integer,text,text) from public;
revoke all on function private.subscribe_newsletter_v1(text,text,text,text) from public;
revoke all on function private.subscribe_stock_alert_v1(uuid,text,text) from public;
revoke all on function private.unsubscribe_newsletter_v1(text) from public;

grant execute on function private.cancel_stock_alert_by_token_v1(text) to anon,authenticated,service_role;
grant execute on function private.catalog_search_suggestions_v1(text,integer) to anon,authenticated,service_role;
grant execute on function private.check_product_export_eligibility_v1(uuid,text) to anon,authenticated,service_role;
grant execute on function private.confirm_newsletter_v1(text) to anon,authenticated,service_role;
grant execute on function private.get_account_help_content_v1(text) to anon,authenticated,service_role;
grant execute on function private.get_product_reviews_v1(uuid,integer,integer) to anon,authenticated,service_role;
grant execute on function private.get_public_brand_appearance_v1() to anon,authenticated,service_role;
grant execute on function private.get_public_contact_config_v1() to anon,authenticated,service_role;
grant execute on function private.get_public_content_entry_v3(text,text) to anon,authenticated,service_role;
grant execute on function private.get_public_home_catalog_v3() to anon,authenticated,service_role;
grant execute on function private.get_public_producer_follow_metrics_v1(uuid[]) to anon,authenticated,service_role;
grant execute on function private.get_public_producer_profile_v5(text) to anon,authenticated,service_role;
grant execute on function private.get_public_product_detail_v7(text) to anon,authenticated,service_role;
grant execute on function private.get_public_product_handling_profiles_v1(uuid[]) to anon,authenticated,service_role;
grant execute on function private.get_public_product_safety_v3(text,text) to anon,authenticated,service_role;
grant execute on function private.get_public_storefront_config_v2(text) to anon,authenticated,service_role;
grant execute on function private.list_public_categories_v2() to anon,authenticated,service_role;
grant execute on function private.list_public_content_v2(text,text,integer,integer) to anon,authenticated,service_role;
grant execute on function private.list_public_events_v2(boolean) to anon,authenticated,service_role;
grant execute on function private.list_public_faq_v1(text) to anon,authenticated,service_role;
grant execute on function private.list_public_producers_v1(text,text,text,text,integer,integer) to anon,authenticated,service_role;
grant execute on function private.list_public_production_locations_v1(text,text,text,integer) to anon,authenticated,service_role;
grant execute on function private.report_client_error_v1(text,text,text,text,text,jsonb) to anon,authenticated,service_role;
grant execute on function private.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to anon,authenticated,service_role;
grant execute on function private.submit_contact_message(text,text,text,text,text,text,text,text,text,text,text) to anon,authenticated,service_role;
grant execute on function private.submit_event_reservation(text,text,text,text,text,text,integer,text,text) to anon,authenticated,service_role;
grant execute on function private.subscribe_newsletter_v1(text,text,text,text) to anon,authenticated,service_role;
grant execute on function private.subscribe_stock_alert_v1(uuid,text,text) to anon,authenticated,service_role;
grant execute on function private.unsubscribe_newsletter_v1(text) to anon,authenticated,service_role;

revoke all on function public.get_checkout_payment_capabilities_v2() from public;
revoke all on function public.get_checkout_payment_readiness_v3() from public;
grant execute on function public.get_checkout_payment_capabilities_v2() to anon,authenticated,service_role;
grant execute on function public.get_checkout_payment_readiness_v3() to anon,authenticated,service_role;
