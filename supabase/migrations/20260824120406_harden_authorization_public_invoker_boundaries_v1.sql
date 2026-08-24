create or replace function private.authorization_context_core_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  profile public.profiles%rowtype;
  roles_json jsonb;
  permissions_json jsonb;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into profile from public.profiles where id=uid;
  if profile.id is null then raise exception 'profile_not_found' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(role order by priority),'[]'::jsonb) into roles_json
  from (
    select distinct ur.role,
      case ur.role when 'super_admin' then 1 when 'admin' then 2 when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 when 'producer' then 7 when 'customer' then 8 else 99 end priority
    from private.user_roles ur
    where ur.user_id=uid and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
  ) active_roles;
  if profile.status='active' and profile.deleted_at is null and not coalesce((private.platform_access_block_v1(uid)->>'blocked')::boolean,false) then
    select coalesce(jsonb_agg(permission_key order by permission_key),'[]'::jsonb) into permissions_json
    from (
      select distinct rp.permission_key
      from private.user_roles ur
      join private.role_permissions rp on rp.role=ur.role
      join private.permissions permission on permission.permission_key=rp.permission_key and permission.is_active=true
      where ur.user_id=uid and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
    ) effective_permissions;
  else
    permissions_json:='[]'::jsonb;
  end if;
  return jsonb_build_object(
    'userId',uid,
    'accountStatus',profile.status,
    'roles',roles_json,
    'permissions',permissions_json,
    'canAccessAdmin',private.has_permission('admin.access'),
    'isAdmin',private.has_role('admin') or private.has_role('super_admin'),
    'isSuperAdmin',private.has_role('super_admin')
  );
end;
$$;
revoke all on function private.authorization_context_core_v1() from public,anon,authenticated,service_role;
grant execute on function private.authorization_context_core_v1() to authenticated,service_role;

create or replace function public.authorization_context_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.authorization_context_core_v1(); $$;
revoke all on function public.authorization_context_v1() from public,anon,authenticated,service_role;
grant execute on function public.authorization_context_v1() to authenticated,service_role;

create or replace function public.authorization_has_permission_v1(p_permission_key text)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$ select private.has_permission(p_permission_key); $$;
revoke all on function public.authorization_has_permission_v1(text) from public,anon,authenticated,service_role;
grant execute on function public.authorization_has_permission_v1(text) to authenticated,service_role;

create or replace function private.admin_list_reviews_core_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.has_permission('review.read') then raise exception 'permission_required:review.read' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',review.id,'user_name',coalesce(nullif(profile.display_name,''),'Kullanıcı'),'product_name',product.name,'rating',review.rating,'title',review.title,'comment',review.body,'status',review.status,'is_verified_purchase',review.is_verified_purchase,'created_at',review.created_at,'updated_at',review.updated_at) order by review.created_at desc),'[]'::jsonb)
  into result from public.reviews review join public.profiles profile on profile.id=review.user_id join public.products product on product.id=review.product_id;
  return result;
end;
$$;
revoke all on function private.admin_list_reviews_core_v1() from public,anon,authenticated,service_role;
grant execute on function private.admin_list_reviews_core_v1() to authenticated,service_role;

create or replace function public.admin_list_reviews()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.admin_list_reviews_core_v1(); $$;
revoke all on function public.admin_list_reviews() from public,anon,authenticated,service_role;
grant execute on function public.admin_list_reviews() to authenticated,service_role;

revoke all on function public.authorization_policy_self_test_v1() from public,anon,authenticated,service_role;
grant execute on function public.authorization_policy_self_test_v1() to service_role;
revoke all on function public.authorization_enforcement_self_test_v1() from public,anon,authenticated,service_role;
grant execute on function public.authorization_enforcement_self_test_v1() to service_role;