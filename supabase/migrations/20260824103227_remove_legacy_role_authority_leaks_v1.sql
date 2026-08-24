do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_archive_platform_user_v1(uuid,text)'::regprocedure);
  new_def:=replace(old_def,$old$caller_is_super_admin := coalesce(private.has_role('super_admin'), false);$old$,$new$caller_is_super_admin := coalesce(private.has_permission('role.manage'), false);$new$);
  if new_def=old_def then raise exception 'archive user super-admin target guard rewrite failed'; end if;
  execute new_def;

  old_def:=pg_get_functiondef('private.admin_list_producers_v2()'::regprocedure);
  new_def:=replace(old_def,$old$reveal_commission:=coalesce(private.has_role('super_admin'),false);$old$,$new$reveal_commission:=coalesce(private.has_permission('finance.read'),false);$new$);
  if new_def=old_def then raise exception 'producer commission visibility capability rewrite failed'; end if;
  execute new_def;

  old_def:=pg_get_functiondef('private.get_my_producer_dashboard_v2()'::regprocedure);
  new_def:=replace(old_def,$old$if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;$old$,$new$if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if not private.has_permission('product.read') or not private.has_permission('finance.read') then raise exception 'permission_required:producer.dashboard' using errcode='42501'; end if;$new$);
  new_def:=replace(new_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''admin.access''), false)');
  if new_def=old_def then raise exception 'producer dashboard capability rewrite failed'; end if;
  execute new_def;

  old_def:=pg_get_functiondef('private.management_orders_snapshot_v4()'::regprocedure);
  new_def:=replace(old_def,$old$caller_can_release boolean:=coalesce(private.has_role('super_admin'),false);$old$,$new$caller_can_release boolean:=coalesce(private.has_permission('payout.release'),false);$new$);
  if new_def=old_def then raise exception 'settlement release visibility capability rewrite failed'; end if;
  execute new_def;

  old_def:=pg_get_functiondef('private.request_my_producer_payout_v2(text,bigint,text)'::regprocedure);
  new_def:=replace(old_def,$old$for admin_user in select distinct ur.user_id from private.user_roles ur join public.profiles pr on pr.id=ur.user_id where ur.role='super_admin' and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and pr.status='active' and pr.deleted_at is null loop$old$,$new$for admin_user in select distinct ur.user_id from private.user_roles ur join public.profiles pr on pr.id=ur.user_id where (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and pr.status='active' and pr.deleted_at is null and private.user_has_permission_v1(ur.user_id,'payout.review') loop$new$);
  if new_def=old_def then raise exception 'payout notification capability routing rewrite failed'; end if;
  execute new_def;
end $$;

-- Deprecated direct review-status mutation is no longer a client authorization path.
revoke execute on function public.admin_set_review_status(uuid,text) from authenticated;
grant execute on function public.admin_set_review_status(uuid,text) to service_role;