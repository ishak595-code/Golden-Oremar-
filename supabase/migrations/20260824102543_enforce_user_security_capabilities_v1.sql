do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_enforce_platform_user_v1(uuid,text,text,boolean,boolean,boolean,timestamp with time zone)'::regprocedure);
  new_def:=replace(old_def,'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;','if caller_id is null then raise exception ''authentication_required'' using errcode=''42501''; end if; if action_value=''block'' and not private.has_permission(''user.suspend'') then raise exception ''permission_required:user.suspend'' using errcode=''42501''; elsif action_value=''unblock'' and not private.has_permission(''user.restore'') then raise exception ''permission_required:user.restore'' using errcode=''42501''; elsif action_value=''close'' and not private.has_permission(''user.erase'') then raise exception ''permission_required:user.erase'' using errcode=''42501''; end if;');
  new_def:=replace(new_def,$old$caller_super:=coalesce(private.has_role('super_admin'),false);$old$,$new$caller_super:=coalesce(private.has_permission('security.manage'),false);$new$);
  if new_def=old_def then raise exception 'user enforcement capability rewrite failed'; end if;
  execute new_def;
end $$;

do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_set_platform_user_status_v1(uuid,text,text)'::regprocedure);
  new_def:=replace(old_def,'coalesce(private.is_admin(),false)','coalesce(private.has_permission(''user.manage''),false)');
  new_def:=replace(new_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''user.manage''),false)');
  new_def:=replace(new_def,'private.is_admin()','private.has_permission(''user.manage'')');
  if new_def=old_def then raise exception 'user status capability rewrite failed'; end if;
  execute new_def;
end $$;

do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_list_platform_users_v3()'::regprocedure);
  new_def:=replace(old_def,$old$reveal_sensitive:=coalesce(private.has_role('super_admin'),false);$old$,$new$reveal_sensitive:=coalesce(private.has_permission('security.read'),false);$new$);
  new_def:=replace(new_def,$old$when 'operations' then 3 when 'content_editor' then 4 when 'support' then 5 when 'producer' then 6 when 'customer' then 7$old$,$new$when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 when 'producer' then 7 when 'customer' then 8$new$);
  if new_def=old_def then raise exception 'platform user sensitive field rewrite failed'; end if;
  execute new_def;
end $$;
