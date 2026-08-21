create schema if not exists api_internal;
revoke all on schema api_internal from public;
grant usage on schema api_internal to anon,authenticated,service_role;

do $$
declare
  r record;
  definition text;
  call_args text;
  volatility text;
  wrapper_sql text;
begin
  for r in
    select p.oid,p.proname,p.pronargs,p.proargnames,p.provolatile,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           pg_get_function_arguments(p.oid) as full_args,
           pg_get_function_result(p.oid) as result_type
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
    definition:=replace(definition,'FUNCTION public.'||quote_ident(r.proname),'FUNCTION api_internal.'||quote_ident(r.proname));
    execute definition;
    execute format('alter function api_internal.%I(%s) security definer',r.proname,r.identity_args);
    execute format('revoke all on function api_internal.%I(%s) from public',r.proname,r.identity_args);
    execute format('grant execute on function api_internal.%I(%s) to anon,authenticated,service_role',r.proname,r.identity_args);

    select string_agg(format('%I',arg_name),', ' order by ordinality)
      into call_args
    from unnest(coalesce(r.proargnames[1:r.pronargs],array[]::text[])) with ordinality as args(arg_name,ordinality);
    call_args:=coalesce(call_args,'');
    volatility:=case r.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end;
    wrapper_sql:=format(
      'create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path to '''' as $fn$ select api_internal.%I(%s); $fn$;',
      r.proname,r.full_args,r.result_type,volatility,r.proname,call_args
    );
    execute wrapper_sql;
  end loop;
end;
$$;

revoke execute on all functions in schema private from anon;
revoke usage on schema private from anon;

revoke all on all functions in schema api_internal from public;
grant execute on all functions in schema api_internal to anon,authenticated,service_role;
