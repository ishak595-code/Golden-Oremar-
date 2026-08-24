alter table private.staff_mfa_security_state add column if not exists recovery_authorized_until timestamptz;
alter table private.staff_mfa_security_state add column if not exists recovery_reason text;
alter table private.staff_mfa_security_state add column if not exists recovery_started_at timestamptz;
alter table private.staff_mfa_security_state add column if not exists recovery_completed_at timestamptz;

create or replace function public.begin_super_admin_mfa_recovery_for_service_v1(p_user_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare normalized_reason text:=btrim(coalesce(p_reason,'')); verified_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_user_id is null or char_length(normalized_reason) not between 20 and 1000 then raise exception 'invalid_recovery_context' using errcode='22023'; end if;
  if not exists(select 1 from private.user_roles ur join public.profiles p on p.id=ur.user_id where ur.user_id=p_user_id and ur.role='super_admin' and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and p.status='active' and p.deleted_at is null) then raise exception 'active_super_admin_required' using errcode='42501'; end if;
  select count(*)::int into verified_count from auth.mfa_factors f where f.user_id=p_user_id and f.factor_type::text='totp' and f.status::text='verified';
  if verified_count<1 then raise exception 'verified_totp_required_for_reset' using errcode='55000'; end if;
  insert into private.staff_mfa_security_state(user_id,state,enforced_at,transition_completed_at,recovery_authorized_until,recovery_reason,recovery_started_at,recovery_completed_at,updated_at)
  values(p_user_id,'enforced',timezone('utc',now()),timezone('utc',now()),timezone('utc',now())+interval '10 minutes',normalized_reason,timezone('utc',now()),null,timezone('utc',now()))
  on conflict(user_id) do update set state='enforced',recovery_authorized_until=timezone('utc',now())+interval '10 minutes',recovery_reason=normalized_reason,recovery_started_at=timezone('utc',now()),recovery_completed_at=null,updated_at=timezone('utc',now());
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(null,'mfa.break_glass_recovery_started','account_security',p_user_id::text,jsonb_build_object('windowMinutes',10,'verifiedFactorCount',verified_count,'reason',normalized_reason));
  return jsonb_build_object('ok',true,'expiresAt',(select recovery_authorized_until from private.staff_mfa_security_state where user_id=p_user_id),'state','enforced');
end;
$$;
revoke all on function public.begin_super_admin_mfa_recovery_for_service_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.begin_super_admin_mfa_recovery_for_service_v1(uuid,text) to service_role;

create or replace function private.guard_last_staff_totp_factor_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare recovery_until timestamptz;
begin
  if old.factor_type::text='totp' and old.status::text='verified' and private.user_requires_staff_mfa_v1(old.user_id)
     and coalesce((select s.state from private.staff_mfa_security_state s where s.user_id=old.user_id),'enrollment_required')='enforced'
     and not exists(select 1 from auth.mfa_factors f where f.user_id=old.user_id and f.id<>old.id and f.factor_type::text='totp' and f.status::text='verified') then
    select s.recovery_authorized_until into recovery_until from private.staff_mfa_security_state s where s.user_id=old.user_id;
    if recovery_until is null or recovery_until<=timezone('utc',now()) then raise exception 'last_verified_staff_totp_required' using errcode='42501'; end if;
  end if;
  return old;
end;
$$;
revoke all on function private.guard_last_staff_totp_factor_v1() from public,anon,authenticated,service_role;

create or replace function private.audit_staff_mfa_factor_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare uid uuid:=coalesce(new.user_id,old.user_id); changed_to_verified boolean:=false; prior_state text; recovery_until timestamptz;
begin
  if coalesce(new.factor_type,old.factor_type)::text<>'totp' then return coalesce(new,old); end if;
  if not private.user_requires_staff_mfa_v1(uid) and not exists(select 1 from private.staff_mfa_security_state s where s.user_id=uid) then return coalesce(new,old); end if;
  if tg_op='INSERT' then
    insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.enrollment_started','mfa_factor',new.id::text,jsonb_build_object('factorType','totp','status',new.status::text));
  elsif tg_op='UPDATE' then
    changed_to_verified:=old.status::text<>'verified' and new.status::text='verified';
    if changed_to_verified then
      select s.state into prior_state from private.staff_mfa_security_state s where s.user_id=uid for update;
      insert into private.staff_mfa_security_state(user_id,state,enforced_at,transition_completed_at,recovery_authorized_until,recovery_reason,recovery_completed_at,updated_at)
      values(uid,'enforced',timezone('utc',now()),timezone('utc',now()),null,null,timezone('utc',now()),timezone('utc',now()))
      on conflict(user_id) do update set state='enforced',enforced_at=coalesce(private.staff_mfa_security_state.enforced_at,excluded.enforced_at),transition_completed_at=coalesce(private.staff_mfa_security_state.transition_completed_at,excluded.transition_completed_at),recovery_authorized_until=null,recovery_reason=null,recovery_completed_at=case when private.staff_mfa_security_state.recovery_started_at is not null then timezone('utc',now()) else private.staff_mfa_security_state.recovery_completed_at end,updated_at=timezone('utc',now());
      insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.factor_verified','mfa_factor',new.id::text,jsonb_build_object('factorType','totp','status','verified'));
      if coalesce(prior_state,'enrollment_required')<>'enforced' then insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.transition_completed','account_security',uid::text,jsonb_build_object('state','enforced')); end if;
    end if;
  elsif tg_op='DELETE' and old.status::text='verified' then
    select s.recovery_authorized_until into recovery_until from private.staff_mfa_security_state s where s.user_id=uid;
    insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.factor_removed','mfa_factor',old.id::text,jsonb_build_object('factorType','totp','status','verified','breakGlass',recovery_until is not null and recovery_until>timezone('utc',now())));
    if recovery_until is not null and recovery_until>timezone('utc',now()) and not exists(select 1 from auth.mfa_factors f where f.user_id=uid and f.id<>old.id and f.factor_type::text='totp' and f.status::text='verified') then
      update private.staff_mfa_security_state set state='enforced',recovery_authorized_until=null,recovery_completed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where user_id=uid;
      insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(null,'mfa.break_glass_factor_reset','account_security',uid::text,jsonb_build_object('state','enforced','requiresNewTotp',true));
    end if;
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function private.audit_staff_mfa_factor_v1() from public,anon,authenticated,service_role;
