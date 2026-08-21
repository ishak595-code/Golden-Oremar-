-- Public authenticated RPCs remain SECURITY INVOKER so the exposed API surface
-- does not contain signed-in executable SECURITY DEFINER functions.
-- Privileged implementation stays inside the non-exposed private schema and keeps
-- its own auth/role checks.

create or replace function public.admin_list_platform_users_v3()
returns jsonb
language sql
security invoker
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
security invoker
set search_path = ''
as $$
  select private.admin_set_platform_user_role_v2(p_user_id, p_role, p_reason);
$$;

create or replace function public.admin_enforce_platform_user_v1(
  p_user_id uuid,
  p_action text,
  p_reason text,
  p_block_known_ips boolean default false,
  p_block_known_devices boolean default false,
  p_fraud_flag boolean default false,
  p_expires_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_enforce_platform_user_v1(
    p_user_id,
    p_action,
    p_reason,
    p_block_known_ips,
    p_block_known_devices,
    p_fraud_flag,
    p_expires_at
  );
$$;

revoke all on function public.admin_list_platform_users_v3() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_platform_users_v3() to authenticated;
revoke all on function private.admin_list_platform_users_v3() from public, anon, authenticated, service_role;
grant execute on function private.admin_list_platform_users_v3() to authenticated;

revoke all on function public.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_platform_user_role_v2(uuid, text, text) to authenticated;
revoke all on function private.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function private.admin_set_platform_user_role_v2(uuid, text, text) to authenticated;

revoke all on function public.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) to authenticated;
revoke all on function private.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) from public, anon, authenticated, service_role;
grant execute on function private.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) to authenticated;