do $$
declare r record; fn_oid oid; old_def text; new_def text; hp text;
begin
  for r in select * from (values
    ('private.super_admin_add_platform_expense_v1(date,text,text,bigint,text,text,text)','finance.manage'),
    ('private.super_admin_anonymize_closed_user_v1(uuid,text)','user.erase'),
    ('private.super_admin_cleanup_operational_history_v1(uuid)','finance.manage'),
    ('private.super_admin_close_accounting_period_v1(date,date,text)','finance.manage'),
    ('private.super_admin_delete_release_origin_v1(uuid)','system.configure'),
    ('private.super_admin_get_brand_appearance_v1()','system.read'),
    ('private.super_admin_get_business_identity_v2()','system.read'),
    ('private.super_admin_get_integration_secret_status_v1()','system.read'),
    ('private.super_admin_get_payment_control_v1()','payment.read'),
    ('private.super_admin_get_product_health_editor_v1(uuid)','product.read'),
    ('private.super_admin_get_production_readiness_snapshot_v1()','system.read'),
    ('private.super_admin_get_release_setup_v2()','system.read'),
    ('private.super_admin_list_legal_documents_v1()','system.read'),
    ('private.super_admin_list_product_health_changes_v1()','content.moderate'),
    ('private.super_admin_list_release_origins_v1()','system.read'),
    ('private.super_admin_list_shipping_weight_readiness_v1()','shipping.read'),
    ('private.super_admin_list_storefronts_v1()','storefront.read'),
    ('private.super_admin_list_transactional_email_jobs_v1(text,integer)','notification.read'),
    ('private.super_admin_publish_product_health_v1(uuid,jsonb,text,uuid)','content.publish'),
    ('private.super_admin_reject_product_health_change_v1(uuid,text)','content.moderate'),
    ('private.super_admin_remove_product_v1(uuid,text)','product.remove'),
    ('private.super_admin_reopen_closed_user_v1(uuid,text,boolean)','user.restore'),
    ('private.super_admin_retry_transactional_email_job_v1(bigint)','notification.manage'),
    ('private.super_admin_set_integration_secret_v1(text,text)','system.configure'),
    ('private.super_admin_set_iyzico_environment_v1(text)','payment.manage'),
    ('private.super_admin_set_producer_payment_provider_type_v1(uuid,text)','payment.manage'),
    ('private.super_admin_update_brand_appearance_v1(jsonb)','system.configure'),
    ('private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean)','system.configure'),
    ('private.super_admin_update_payment_control_v1(jsonb)','payment.manage'),
    ('private.super_admin_update_release_setup_v2(text,text,text,text,text,text,text,boolean)','system.configure'),
    ('private.super_admin_update_storefront_media_v1(uuid,text,text)','storefront.manage'),
    ('private.super_admin_update_storefront_presentation_v1(uuid,bigint,text,text,text,text,text)','storefront.manage'),
    ('private.super_admin_update_variant_shipping_weight_v1(uuid,integer,timestamp with time zone,text)','shipping.manage'),
    ('private.super_admin_upsert_legal_document_v1(text,text,text,text,text,text)','system.configure'),
    ('private.super_admin_upsert_release_origin_v1(text,boolean,boolean)','system.configure'),
    ('private.super_admin_void_platform_expense_v1(uuid,text)','finance.manage')
  ) m(regproc_name,permission_key)
  loop
    fn_oid:=to_regprocedure(r.regproc_name);
    if fn_oid is null then raise exception 'super admin mapping function missing: %',r.regproc_name; end if;
    old_def:=pg_get_functiondef(fn_oid);
    hp:=format('private.has_permission(%L)',r.permission_key);
    new_def:=replace(old_def,$q$coalesce(private.is_super_admin(),false)$q$,format('coalesce(%s,false)',hp));
    new_def:=replace(new_def,$q$coalesce(private.is_super_admin(), false)$q$,format('coalesce(%s,false)',hp));
    new_def:=replace(new_def,$q$private.is_super_admin()$q$,hp);
    new_def:=replace(new_def,$q$coalesce(private.has_role('super_admin'),false)$q$,format('coalesce(%s,false)',hp));
    new_def:=replace(new_def,$q$coalesce(private.has_role('super_admin'), false)$q$,format('coalesce(%s,false)',hp));
    new_def:=replace(new_def,$q$private.has_role('super_admin')$q$,hp);
    new_def:=regexp_replace(new_def,'private\.is_super_admin_user_v1\([^\)]*\)',hp,'g');
    if new_def=old_def then raise exception 'super admin capability guard not found: %',r.regproc_name; end if;
    execute new_def;
  end loop;
end $$;