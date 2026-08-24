create or replace function public.ci_get_e2e_mfa_audit_for_service_v1(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare u auth.users%rowtype; result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  select * into u from auth.users where id=p_user_id;
  if u.id is null or coalesce(u.raw_user_meta_data->>'source','')<>'github-actions-e2e' or coalesce(u.raw_user_meta_data->>'e2e_run_id','') !~ '^[0-9]{1,24}$' then raise exception 'ci_user_required' using errcode='42501'; end if;
  select coalesce(jsonb_object_agg(action,event_count),'{}'::jsonb) into result
  from(select l.action,count(*)::int event_count from private.admin_audit_logs l where l.actor_user_id=p_user_id or l.target_id=p_user_id::text group by l.action) x;
  return result;
end;
$$;
revoke all on function public.ci_get_e2e_mfa_audit_for_service_v1(uuid) from public,anon,authenticated;
grant execute on function public.ci_get_e2e_mfa_audit_for_service_v1(uuid) to service_role;
