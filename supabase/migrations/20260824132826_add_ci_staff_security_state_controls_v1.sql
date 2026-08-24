create or replace function public.ci_set_e2e_account_block_for_service_v1(p_user_id uuid,p_blocked boolean)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare u auth.users%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  select * into u from auth.users where id=p_user_id;
  if u.id is null or coalesce(u.raw_user_meta_data->>'source','')<>'github-actions-e2e' or coalesce(u.raw_user_meta_data->>'e2e_run_id','') !~ '^[0-9]{1,24}$' then raise exception 'ci_user_required' using errcode='42501'; end if;
  if coalesce(p_blocked,false) then
    if not exists(select 1 from private.security_block_rules r where r.subject_type='user' and r.user_id=u.id and r.active=true and r.revoked_at is null) then
      insert into private.security_block_rules(subject_type,user_id,reason,fraud_flag,active,expires_at,created_by)
      values('user',u.id,'CI MFA session downgrade security-block test',false,true,timezone('utc',now())+interval '15 minutes',null);
    end if;
  else
    update private.security_block_rules set active=false,revoked_at=timezone('utc',now()),revoked_by=null
    where subject_type='user' and user_id=u.id and active=true and reason='CI MFA session downgrade security-block test';
  end if;
end;
$$;
revoke all on function public.ci_set_e2e_account_block_for_service_v1(uuid,boolean) from public,anon,authenticated;
grant execute on function public.ci_set_e2e_account_block_for_service_v1(uuid,boolean) to service_role;
