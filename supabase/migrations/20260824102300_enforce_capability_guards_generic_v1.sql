do $$
declare
  r record;
  fn_oid oid;
  old_def text;
  new_def text;
  replacement text;
begin
  for r in select * from (values
    ('private.admin_archive_platform_user_v1(uuid,text)','user.erase'),
    ('private.admin_broadcast_notification_v1(text,uuid,text,text,text,text)','notification.send'),
    ('private.admin_create_platform_notification_v1(uuid,text,text,text,text)','notification.send'),
    ('private.admin_finance_report_v2(date,date,text)','finance.read'),
    ('private.admin_get_brand_configuration_v1()','system.read'),
    ('private.admin_get_product_certifications_v1(uuid)','product.read'),
    ('private.admin_get_return_detail_v1(uuid)','refund.read'),
    ('private.admin_list_categories_v1()','content.read'),
    ('private.admin_list_content_reports_v1(text,integer,integer)','report.read'),
    ('private.admin_list_content_v1()','content.read'),
    ('private.admin_list_coupons_v1()','campaign.read'),
    ('private.admin_list_events_v1()','event.read'),
    ('private.admin_list_inventory_v1()','inventory.read'),
    ('private.admin_list_pending_product_changes_v1()','product.read'),
    ('private.admin_list_platform_expenses_v1(date,date,text)','finance.read'),
    ('private.admin_list_platform_users_v3()','user.read'),
    ('private.admin_list_producer_balances_v1(text)','finance.read'),
    ('private.admin_list_producers_v1()','seller.read'),
    ('private.admin_list_producers_v2()','seller.read'),
    ('private.admin_list_product_editorial_reviews_v1()','product.read'),
    ('private.admin_list_products_v1()','product.read'),
    ('private.admin_list_products_v2()','product.read'),
    ('private.admin_list_products_v3()','product.read'),
    ('private.admin_list_returns_v1()','refund.read'),
    ('private.admin_notification_audience_count_v1(text,uuid)','notification.read'),
    ('private.admin_operations_overview_v1()','finance.read'),
    ('private.admin_operations_overview_v2()','finance.read'),
    ('private.admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text)','product.moderate'),
    ('private.admin_review_producer_location_change_v1(uuid,boolean,text)','seller.review'),
    ('private.admin_review_product_batch_v1(uuid,text,text)','product.moderate'),
    ('private.admin_revoke_product_certification_v1(uuid,text)','product.moderate'),
    ('private.admin_set_content_report_status_v1(uuid,text)','report.moderate'),
    ('private.admin_set_producer_document_status(uuid,text)','seller.review'),
    ('private.admin_set_producer_origin_verified_v1(uuid,boolean,text)','seller.review'),
    ('private.admin_set_producer_phone_verified(uuid,boolean)','seller.review'),
    ('private.admin_set_producer_trust_badge_v1(uuid,boolean,text,timestamp with time zone)','seller.review'),
    ('private.admin_update_account_closure_v1(uuid,text,text)','user.manage'),
    ('private.admin_update_brand_configuration_v1(text,jsonb)','system.configure'),
    ('private.admin_update_product_export_profile_v1(uuid,text,text,text,text,boolean,boolean,integer)','product.update'),
    ('private.admin_upsert_campaign_v2(uuid,text,text,text,text,text,integer,text,bigint,integer,integer,timestamp with time zone,timestamp with time zone,text,text,uuid[],text,integer,bigint)','campaign.manage'),
    ('private.admin_upsert_coupon_v1(uuid,uuid,text,text,timestamp with time zone,timestamp with time zone,integer,integer)','campaign.manage'),
    ('private.admin_upsert_product_export_rule_v1(uuid,uuid,text,text,text,text)','product.update'),
    ('private.get_product_editorial_editor_v1(text)','product.read'),
    ('private.management_archive_category_v1(text)','content.update'),
    ('private.management_archive_content_v1(text)','content.update'),
    ('private.management_archive_event_v1(text)','event.manage'),
    ('private.management_cancel_event_reservation_v1(uuid)','event.manage'),
    ('private.management_catalog_snapshot_v1()','product.read'),
    ('private.management_orders_snapshot_v2()','order.read'),
    ('private.management_orders_snapshot_v4()','order.read'),
    ('private.management_update_order_status_v1(uuid,text,text,text)','order.manage'),
    ('private.management_upsert_category_v1(text,jsonb)','content.update'),
    ('private.management_upsert_content_v1(text,text,jsonb)','content.update'),
    ('private.management_upsert_event_v2(text,jsonb)','event.manage'),
    ('private.review_product_editorial_with_product_v1(uuid,boolean,text,uuid)','product.moderate'),
    ('private.save_product_editorial_v1(text,jsonb,text,text)','content.update')
  ) as m(regproc_name,permission_key)
  loop
    fn_oid:=to_regprocedure(r.regproc_name);
    if fn_oid is null then raise exception 'authorization migration function missing: %',r.regproc_name; end if;
    old_def:=pg_get_functiondef(fn_oid);
    replacement:=format('coalesce(private.has_permission(%L),false)',r.permission_key);
    new_def:=replace(old_def,'coalesce(private.is_admin(), false)',replacement);
    new_def:=replace(new_def,'coalesce(private.is_admin(),false)',replacement);
    new_def:=replace(new_def,'private.is_admin()',format('private.has_permission(%L)',r.permission_key));
    if new_def=old_def then raise exception 'authorization guard not found: %',r.regproc_name; end if;
    execute new_def;
  end loop;
end $$;

do $$
declare r record; fn_oid oid; old_def text; new_def text; replacement text;
begin
  for r in select * from (values
    ('public.admin_finance_report(date,date)','finance.read'),
    ('public.admin_list_campaigns()','campaign.read'),
    ('public.admin_list_producer_applications()','seller.read'),
    ('public.admin_list_producer_applications_v2()','seller.read'),
    ('public.admin_upsert_campaign(uuid,text,text,text,text,text,integer,text,bigint,integer,integer,timestamp with time zone,timestamp with time zone,text,text,uuid[])','campaign.manage'),
    ('public.management_archive_product_v1(text)','product.archive'),
    ('public.management_upsert_product_v2(text,jsonb)','product.update')
  ) as m(regproc_name,permission_key)
  loop
    fn_oid:=to_regprocedure(r.regproc_name);
    if fn_oid is null then continue; end if;
    old_def:=pg_get_functiondef(fn_oid);
    replacement:=format('coalesce(private.has_permission(%L),false)',r.permission_key);
    new_def:=replace(old_def,'coalesce(private.is_admin(), false)',replacement);
    new_def:=replace(new_def,'coalesce(private.is_admin(),false)',replacement);
    new_def:=replace(new_def,'private.is_admin()',format('private.has_permission(%L)',r.permission_key));
    if new_def<>old_def then execute new_def; end if;
  end loop;
end $$;

-- Preserve producer resource ownership in shared product mutation while requiring capability.
do $$
declare old_def text; core_def text; updated_def text;
begin
  old_def:=pg_get_functiondef('private.management_upsert_product_v1(text,jsonb)'::regprocedure);
  core_def:=replace(old_def,'FUNCTION private.management_upsert_product_v1','FUNCTION private.management_upsert_product_core_v1');
  core_def:=replace(core_def,'caller_is_admin := coalesce(private.is_admin(), false);','caller_is_admin := true;');
  if core_def=old_def or core_def not like '%caller_is_admin := true;%' then raise exception 'product core clone guard mismatch'; end if;
  execute core_def;
  execute 'REVOKE ALL ON FUNCTION private.management_upsert_product_core_v1(text,jsonb) FROM PUBLIC, anon, authenticated';
  execute 'GRANT EXECUTE ON FUNCTION private.management_upsert_product_core_v1(text,jsonb) TO service_role';

  updated_def:=replace(old_def,'caller_is_admin := coalesce(private.is_admin(), false);','caller_is_admin := coalesce(private.has_permission(''admin.access''),false) and coalesce(private.has_permission(''product.update''),false);');
  updated_def:=replace(updated_def,'if not caller_is_admin and caller_producer_id is null then','if not caller_is_admin and (caller_producer_id is null or not coalesce(private.has_permission(''product.update''),false)) then');
  if updated_def=old_def then raise exception 'management product permission rewrite failed'; end if;
  execute updated_def;
end $$;

-- Basic product archive for producer/admin must require capability while retaining ownership checks.
do $$
declare r text; fn_oid oid; old_def text; new_def text;
begin
  foreach r in array array['private.producer_archive_product_v1(text)','private.producer_upsert_product_v1(text,jsonb)'] loop
    fn_oid:=to_regprocedure(r); old_def:=pg_get_functiondef(fn_oid);
    new_def:=replace(old_def,'coalesce(private.is_admin(),false)','coalesce(private.has_permission(''admin.access''),false)');
    new_def:=replace(new_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''admin.access''),false)');
    new_def:=replace(new_def,'private.is_admin()','private.has_permission(''admin.access'')');
    if r like '%archive%' then
      new_def:=replace(new_def,'if caller_id is null then','if caller_id is null then');
    end if;
    if new_def<>old_def then execute new_def; end if;
  end loop;
end $$;