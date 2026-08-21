do $$
declare
  sig text;
  public_signatures text[] := array[
    'public.cancel_stock_alert_by_token_v1(text)',
    'public.catalog_search_suggestions_v1(text,integer)',
    'public.check_product_export_eligibility_v1(uuid,text)',
    'public.confirm_newsletter_v1(text)',
    'public.get_account_help_content_v1(text)',
    'public.get_checkout_payment_capabilities_v2()',
    'public.get_checkout_payment_readiness_v3()',
    'public.get_product_reviews_v1(uuid,integer,integer)',
    'public.get_public_brand_appearance_v1()',
    'public.get_public_contact_config_v1()',
    'public.get_public_content_entry_v3(text,text)',
    'public.get_public_home_catalog_v3()',
    'public.get_public_producer_follow_metrics_v1(uuid[])',
    'public.get_public_producer_profile_v3(text)',
    'public.get_public_product_detail_v6(text)',
    'public.get_public_product_handling_profiles_v1(uuid[])',
    'public.get_public_product_safety_v3(text,text)',
    'public.get_public_storefront_config_v2(text)',
    'public.list_public_categories_v2()',
    'public.list_public_content_v1(text,text,integer,integer)',
    'public.list_public_events_v1(boolean)',
    'public.list_public_faq_v1(text)',
    'public.list_public_producers_v1(text,text,text,text,integer,integer)',
    'public.list_public_production_locations_v1(text,text,text,integer)',
    'public.report_client_error_v1(text,text,text,text,text,jsonb)',
    'public.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer)',
    'public.submit_contact_message(text,text,text,text,text,text,text,text,text,text,text)',
    'public.submit_event_reservation(text,text,text,text,text,text,integer,text,text)',
    'public.subscribe_newsletter_v1(text,text,text,text)',
    'public.subscribe_stock_alert_v1(uuid,text,text)',
    'public.unsubscribe_newsletter_v1(text)'
  ];
  authenticated_signatures text[] := array[
    'public.admin_get_message_moderation_v1()',
    'public.admin_get_product_certifications_v1(uuid)',
    'public.admin_list_product_editorial_reviews_v1()',
    'public.admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text)',
    'public.admin_revoke_product_certification_v1(uuid,text)',
    'public.admin_update_message_moderation_v1(jsonb)',
    'public.get_my_message_policy_v1()',
    'public.get_product_editorial_editor_v1(text)',
    'public.list_my_producer_conversations_v1(integer,integer)',
    'public.management_upsert_product_v2(text,jsonb)',
    'public.producer_upsert_product_v2(text,jsonb)',
    'public.save_product_editorial_v1(text,jsonb,text,text)'
  ];
begin
  foreach sig in array public_signatures loop
    if to_regprocedure(sig) is null then
      raise exception 'required_public_rpc_missing:%', sig;
    end if;
    execute format('alter function %s security definer', to_regprocedure(sig));
    execute format('alter function %s set search_path to %L', to_regprocedure(sig), '');
    execute format('revoke all on function %s from public', to_regprocedure(sig));
    execute format('grant execute on function %s to anon, authenticated, service_role', to_regprocedure(sig));
  end loop;

  foreach sig in array authenticated_signatures loop
    if to_regprocedure(sig) is null then
      raise exception 'required_authenticated_rpc_missing:%', sig;
    end if;
    execute format('alter function %s security invoker', to_regprocedure(sig));
    execute format('alter function %s set search_path to %L', to_regprocedure(sig), '');
    execute format('revoke all on function %s from public, anon', to_regprocedure(sig));
    execute format('grant execute on function %s to authenticated, service_role', to_regprocedure(sig));
  end loop;
end;
$$;

-- Defense in depth: management/account surfaces must never inherit anonymous EXECUTE.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (
        p.proname like 'admin\_%' escape '\'
        or p.proname like 'management\_%' escape '\'
        or p.proname like 'producer\_%' escape '\'
        or p.proname like 'get\_my\_%' escape '\'
        or p.proname like 'list\_my\_%' escape '\'
      )
  loop
    execute format('revoke execute on function %s from public, anon', r.signature);
  end loop;
end;
$$;
