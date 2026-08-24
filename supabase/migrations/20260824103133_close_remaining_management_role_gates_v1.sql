do $$
declare r record; fn_oid oid; old_def text; new_def text; hp text;
begin
  for r in select * from (values
    ('private.admin_get_message_moderation_v1()','security.read'),
    ('private.admin_update_message_moderation_v1(jsonb)','security.manage'),
    ('private.admin_list_accounting_periods_v1()','finance.read'),
    ('private.admin_list_producer_event_submissions_v1()','event.moderate'),
    ('private.admin_list_system_errors_v1(date,date)','system.read'),
    ('private.admin_set_producer_commission_v1(uuid,integer)','finance.manage'),
    ('private.admin_set_store_follow_simulation_v1(uuid,integer)','system.configure'),
    ('private.get_store_follow_simulation_v1()','system.read'),
    ('private.admin_update_event_spotlight_v1(jsonb)','event.manage'),
    ('private.admin_update_home_interface_v1(jsonb)','content.update')
  ) m(regproc_name,permission_key)
  loop
    fn_oid:=to_regprocedure(r.regproc_name); old_def:=pg_get_functiondef(fn_oid); hp:=format('private.has_permission(%L)',r.permission_key);
    new_def:=replace(old_def,$q$coalesce(private.has_role('super_admin'),false)$q$,format('coalesce(%s,false)',hp));
    new_def:=replace(new_def,$q$coalesce(private.has_role('super_admin'), false)$q$,format('coalesce(%s,false)',hp));
    new_def:=replace(new_def,$q$private.has_role('super_admin')$q$,hp);
    if new_def=old_def then raise exception 'remaining management guard not found: %',r.regproc_name; end if;
    execute new_def;
  end loop;
end $$;

-- Event submission moderation can be performed by event moderators, but commission overrides remain financial administration.
do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_review_producer_event_submission_v1(uuid,text,text,integer)'::regprocedure);
  new_def:=replace(old_def,$old$if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;$old$,$new$if caller_id is null or not private.has_permission('event.moderate') then raise exception 'permission_required:event.moderate' using errcode='42501'; end if; if p_commission_basis_points is not null and not private.has_permission('finance.manage') then raise exception 'permission_required:finance.manage' using errcode='42501'; end if;$new$);
  if new_def=old_def then raise exception 'event moderation capability rewrite failed'; end if;
  execute new_def;
end $$;

-- Manual payment recording is a finance mutation, not a general admin operation.
do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_record_manual_payment_v1(uuid,text,text,text)'::regprocedure);
  new_def:=replace(old_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''finance.manage''),false)');
  new_def:=replace(new_def,'private.is_admin()','private.has_permission(''finance.manage'')');
  if new_def=old_def then raise exception 'manual payment capability rewrite failed'; end if;
  execute new_def;
end $$;

-- Shared product archive retains producer ownership and requires product.archive for every caller.
do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.management_archive_product_v1(text)'::regprocedure);
  new_def:=replace(old_def,'caller_is_admin := coalesce(private.is_admin(), false);','caller_is_admin := coalesce(private.has_permission(''admin.access''),false);');
  new_def:=replace(new_def,
    $old$if caller_id is null or v_product_id is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;$old$,
    $new$if caller_id is null or v_product_id is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not private.has_permission('product.archive') then raise exception 'permission_required:product.archive' using errcode='42501'; end if;$new$);
  if new_def=old_def then raise exception 'product archive capability rewrite failed'; end if;
  execute new_def;
end $$;

-- Rich product management requires product.update, and direct publication requires product.approve.
do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.management_upsert_product_v2(text,jsonb)'::regprocedure);
  new_def:=replace(old_def,'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;','if caller_id is null or not private.has_permission(''product.update'') then raise exception ''permission_required:product.update'' using errcode=''42501''; end if;');
  new_def:=replace(new_def,'requested_publish:=coalesce((p_payload->>''is_approved'')::boolean,false);','requested_publish:=coalesce((p_payload->>''is_approved'')::boolean,false); if requested_publish and not private.has_permission(''product.approve'') then raise exception ''permission_required:product.approve'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'product v2 capability rewrite failed'; end if;
  execute new_def;
end $$;