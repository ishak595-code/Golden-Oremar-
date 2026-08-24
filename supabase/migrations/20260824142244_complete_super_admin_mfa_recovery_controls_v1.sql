create or replace function public.cancel_super_admin_mfa_recovery_for_service_v1(p_user_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_reason text:=btrim(coalesce(p_reason,''));
  had_active_window boolean:=false;
begin
  if auth.role()<>'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if p_user_id is null or char_length(normalized_reason) not between 20 and 1000 then
    raise exception 'invalid_recovery_context' using errcode='22023';
  end if;

  select coalesce(s.recovery_authorized_until>timezone('utc',now()),false)
    into had_active_window
  from private.staff_mfa_security_state s
  where s.user_id=p_user_id;

  update private.staff_mfa_security_state
     set recovery_authorized_until=null,
         recovery_reason=null,
         recovery_completed_at=case when recovery_started_at is not null then timezone('utc',now()) else recovery_completed_at end,
         updated_at=timezone('utc',now())
   where user_id=p_user_id;

  if had_active_window then
    insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
    values(null,'mfa.break_glass_recovery_cancelled','account_security',p_user_id::text,jsonb_build_object('reason',normalized_reason));
  end if;

  return jsonb_build_object('ok',true,'cancelled',had_active_window,'state',coalesce((select state from private.staff_mfa_security_state where user_id=p_user_id),'unknown'));
end;
$$;
revoke all on function public.cancel_super_admin_mfa_recovery_for_service_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_super_admin_mfa_recovery_for_service_v1(uuid,text) to service_role;

create or replace function public.get_super_admin_mfa_recovery_status_for_service_v1(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  state_row private.staff_mfa_security_state%rowtype;
  verified_count integer:=0;
begin
  if auth.role()<>'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if p_user_id is null then
    raise exception 'user_id_required' using errcode='22023';
  end if;

  select * into state_row from private.staff_mfa_security_state where user_id=p_user_id;
  select count(*)::int into verified_count
  from auth.mfa_factors f
  where f.user_id=p_user_id and f.factor_type::text='totp' and f.status::text='verified';

  return jsonb_build_object(
    'ok',true,
    'state',coalesce(state_row.state,'unknown'),
    'active',coalesce(state_row.recovery_authorized_until>timezone('utc',now()),false),
    'expiresAt',state_row.recovery_authorized_until,
    'verifiedTotpFactorCount',verified_count,
    'recoveryStartedAt',state_row.recovery_started_at,
    'recoveryCompletedAt',state_row.recovery_completed_at
  );
end;
$$;
revoke all on function public.get_super_admin_mfa_recovery_status_for_service_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_super_admin_mfa_recovery_status_for_service_v1(uuid) to service_role;
