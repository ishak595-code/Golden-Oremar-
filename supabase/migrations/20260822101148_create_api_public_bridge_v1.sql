create schema if not exists api_public_bridge;
revoke all on schema api_public_bridge from public;
grant usage on schema api_public_bridge to anon,authenticated,service_role;

do $$
declare
  r record;
  definition text;
begin
  for r in
    select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='api_internal'
      and p.proname=any(array[
        'cancel_stock_alert_by_token_v1','catalog_search_suggestions_v1','check_product_export_eligibility_v1','confirm_newsletter_v1',
        'get_account_help_content_v1','get_checkout_payment_capabilities_v2','get_checkout_payment_readiness_v3','get_product_reviews_v1',
        'get_public_brand_appearance_v1','get_public_contact_config_v1','get_public_content_entry_v3','get_public_home_catalog_v3',
        'get_public_producer_follow_metrics_v1','get_public_producer_profile_v3','get_public_product_detail_v6','get_public_product_handling_profiles_v1',
        'get_public_product_safety_v3','get_public_storefront_config_v2','list_public_categories_v2','list_public_content_v1','list_public_events_v1',
        'list_public_faq_v1','list_public_producers_v1','list_public_production_locations_v1','report_client_error_v1','search_catalog_v3',
        'submit_contact_message','submit_event_reservation','subscribe_newsletter_v1','subscribe_stock_alert_v1','unsubscribe_newsletter_v1'
      ]::text[])
    order by p.proname,pg_get_function_identity_arguments(p.oid)
  loop
    definition:=pg_get_functiondef(r.oid);
    definition:=replace(definition,'FUNCTION api_internal.'||quote_ident(r.proname),'FUNCTION api_public_bridge.'||quote_ident(r.proname));
    execute definition;
    execute format('alter function api_public_bridge.%I(%s) security definer',r.proname,r.identity_args);
    execute format('revoke all on function api_public_bridge.%I(%s) from public',r.proname,r.identity_args);
    execute format('grant execute on function api_public_bridge.%I(%s) to anon,authenticated,service_role',r.proname,r.identity_args);
  end loop;
end;
$$;

do $$
declare
  r record;
  definition text;
begin
  for r in
    select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname=any(array[
        'cancel_stock_alert_by_token_v1','catalog_search_suggestions_v1','check_product_export_eligibility_v1','confirm_newsletter_v1',
        'get_account_help_content_v1','get_checkout_payment_capabilities_v2','get_checkout_payment_readiness_v3','get_product_reviews_v1',
        'get_public_brand_appearance_v1','get_public_contact_config_v1','get_public_content_entry_v3','get_public_home_catalog_v3',
        'get_public_producer_follow_metrics_v1','get_public_producer_profile_v3','get_public_product_detail_v6','get_public_product_handling_profiles_v1',
        'get_public_product_safety_v3','get_public_storefront_config_v2','list_public_categories_v2','list_public_content_v1','list_public_events_v1',
        'list_public_faq_v1','list_public_producers_v1','list_public_production_locations_v1','report_client_error_v1','search_catalog_v3',
        'submit_contact_message','submit_event_reservation','subscribe_newsletter_v1','subscribe_stock_alert_v1','unsubscribe_newsletter_v1'
      ]::text[])
    order by p.proname,pg_get_function_identity_arguments(p.oid)
  loop
    definition:=pg_get_functiondef(r.oid);
    definition:=replace(definition,'api_internal.','api_public_bridge.');
    execute definition;
    execute format('alter function public.%I(%s) security invoker',r.proname,r.identity_args);
  end loop;
end;
$$;

revoke all on all functions in schema api_internal from anon,authenticated;
revoke usage on schema api_internal from anon,authenticated;
grant usage on schema api_internal to service_role;
grant execute on all functions in schema api_internal to service_role;
