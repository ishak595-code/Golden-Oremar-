do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_record_manual_refund_v1(uuid,uuid,text,bigint,text)'::regprocedure);
  new_def:=replace(old_def,'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;','if caller_id is null or not private.has_permission(''refund.execute'') then raise exception ''permission_required:refund.execute'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'manual refund capability rewrite failed'; end if; execute new_def;

  old_def:=pg_get_functiondef('private.admin_update_return_v2(uuid,text,text,text,boolean)'::regprocedure);
  new_def:=replace(old_def,'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;','if caller_id is null or not private.has_permission(''refund.approve'') then raise exception ''permission_required:refund.approve'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'return v2 capability rewrite failed'; end if; execute new_def;

  old_def:=pg_get_functiondef('private.admin_set_return_status_v1(uuid,text,text)'::regprocedure);
  new_def:=replace(old_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''refund.approve''),false)');
  new_def:=replace(new_def,'private.is_admin()','private.has_permission(''refund.approve'')');
  if new_def=old_def then raise exception 'return status capability rewrite failed'; end if; execute new_def;
end $$;

do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_schedule_producer_payout_v1(uuid,text,bigint,text)'::regprocedure);
  new_def:=replace(old_def,'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;','if caller_id is null or not private.has_permission(''payout.review'') then raise exception ''permission_required:payout.review'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'payout schedule capability rewrite failed'; end if; execute new_def;

  old_def:=pg_get_functiondef('private.admin_update_producer_payout_v1(uuid,text,text,text,text)'::regprocedure);
  new_def:=replace(old_def,'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;','if caller_id is null then raise exception ''authentication_required'' using errcode=''42501''; end if; if next_status=''paid'' and not private.has_permission(''payout.release'') then raise exception ''permission_required:payout.release'' using errcode=''42501''; end if; if next_status<>''paid'' and not private.has_permission(''payout.review'') then raise exception ''permission_required:payout.review'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'payout update capability rewrite failed'; end if; execute new_def;
end $$;

do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.super_admin_list_producer_payouts_v2(text,integer,integer)'::regprocedure);
  new_def:=replace(old_def,$old$if uid is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;$old$,$new$if uid is null or not coalesce(private.has_permission('payout.read'),false) then raise exception 'permission_required:payout.read' using errcode='42501'; end if;$new$);
  if new_def=old_def then raise exception 'payout list capability rewrite failed'; end if; execute new_def;

  old_def:=pg_get_functiondef('private.super_admin_update_producer_payout_v2(uuid,text,text,text)'::regprocedure);
  new_def:=replace(old_def,$old$if uid is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;$old$,$new$if uid is null or not coalesce(private.has_permission('payout.release'),false) then raise exception 'permission_required:payout.release' using errcode='42501'; end if;$new$);
  if new_def=old_def then raise exception 'payout release capability rewrite failed'; end if; execute new_def;
end $$;
