-- Retire obsolete user/vendor alias RPC entrypoints.
-- Public canonical wrappers execute the private audited cores as SECURITY DEFINER,
-- while direct private execution remains inaccessible to client roles.

create or replace function public.admin_list_platform_users_v3()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_list_platform_users_v3();
$$;

create or replace function public.admin_set_platform_user_role_v2(
  p_user_id uuid,
  p_role text,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_set_platform_user_role_v2(p_user_id, p_role, p_reason);
$$;

revoke all on function public.admin_list_platform_users_v3() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_platform_users_v3() to authenticated;

revoke all on function public.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_platform_user_role_v2(uuid, text, text) to authenticated;

revoke all on function private.admin_list_platform_users_v3() from public, anon, authenticated, service_role;
revoke all on function private.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;

-- Dependency scan confirmed these retired entrypoints have no runtime dependants.
drop function if exists public.admin_list_platform_users_v1();
drop function if exists public.admin_list_platform_users_v2();
drop function if exists public.admin_set_platform_user_role_v1(uuid, text, text);
drop function if exists private.admin_list_platform_users_v1();
drop function if exists private.admin_list_platform_users_v2();
drop function if exists private.admin_set_platform_user_role_v1(uuid, text, text);