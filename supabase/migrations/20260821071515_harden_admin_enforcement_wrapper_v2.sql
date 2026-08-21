-- Keep privileged account enforcement behind one authenticated public RPC.
-- Direct execution of the private core remains unavailable to client roles.

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
security definer
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

revoke all on function public.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) to authenticated;

revoke all on function private.admin_enforce_platform_user_v1(uuid, text, text, boolean, boolean, boolean, timestamptz) from public, anon, authenticated, service_role;