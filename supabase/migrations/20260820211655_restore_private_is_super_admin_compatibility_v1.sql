create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.is_super_admin_user_v1((select auth.uid()));
$$;

revoke all on function private.is_super_admin() from public, anon, authenticated;
grant execute on function private.is_super_admin() to service_role;
