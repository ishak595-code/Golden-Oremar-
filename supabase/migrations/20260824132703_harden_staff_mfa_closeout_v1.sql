create table if not exists private.staff_mfa_security_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null check (state in ('enrollment_required','enforced')),
  first_required_at timestamptz not null default timezone('utc',now()),
  enforced_at timestamptz,
  transition_completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc',now())
);

revoke all on table private.staff_mfa_security_state from public,anon,authenticated;
grant select,insert,update,delete on table private.staff_mfa_security_state to service_role;

insert into private.permissions(permission_key,domain,description,is_active)
values('mfa.self_manage','mfa','Kullanıcının yalnız kendi MFA faktörlerini yönetebilmesi.',true)
on conflict(permission_key) do update set domain=excluded.domain,description=excluded.description,is_active=true,updated_at=timezone('utc',now());

insert into private.role_permissions(role,permission_key)
select role,'mfa.self_manage'
from unnest(array['support','content_editor','operations','moderator','admin','super_admin']::text[]) role
on conflict(role,permission_key) do nothing;

insert into private.staff_mfa_security_state(user_id,state,enforced_at,transition_completed_at)
select distinct ur.user_id,
  case when exists(select 1 from auth.mfa_factors f where f.user_id=ur.user_id and f.factor_type::text='totp' and f.status::text='verified') then 'enforced' else 'enrollment_required' end,
  case when exists(select 1 from auth.mfa_factors f where f.user_id=ur.user_id and f.factor_type::text='totp' and f.status::text='verified') then timezone('utc',now()) else null end,
  case when exists(select 1 from auth.mfa_factors f where f.user_id=ur.user_id and f.factor_type::text='totp' and f.status::text='verified') then timezone('utc',now()) else null end
from private.user_roles ur
where ur.role in('support','content_editor','operations','moderator','admin','super_admin')
  and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
on conflict(user_id) do nothing;

create or replace function private.staff_mfa_state_v1(p_user_id uuid)
returns text language sql stable security definer set search_path=''
as $$
  select case when p_user_id is null then null when not private.user_requires_staff_mfa_v1(p_user_id) then null
    else coalesce((select s.state from private.staff_mfa_security_state s where s.user_id=p_user_id),'enrollment_required') end;
$$;
revoke all on function private.staff_mfa_state_v1(uuid) from public,anon,authenticated;
grant execute on function private.staff_mfa_state_v1(uuid) to service_role;

create or replace function private.ensure_staff_mfa_state_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.role in('support','content_editor','operations','moderator','admin','super_admin') and (new.expires_at is null or new.expires_at>timezone('utc',now())) then
    insert into private.staff_mfa_security_state(user_id,state,enforced_at,transition_completed_at)
    values(new.user_id,
      case when exists(select 1 from auth.mfa_factors f where f.user_id=new.user_id and f.factor_type::text='totp' and f.status::text='verified') then 'enforced' else 'enrollment_required' end,
      case when exists(select 1 from auth.mfa_factors f where f.user_id=new.user_id and f.factor_type::text='totp' and f.status::text='verified') then timezone('utc',now()) else null end,
      case when exists(select 1 from auth.mfa_factors f where f.user_id=new.user_id and f.factor_type::text='totp' and f.status::text='verified') then timezone('utc',now()) else null end)
    on conflict(user_id) do update set state=case when private.staff_mfa_security_state.state='enforced' then 'enforced' else excluded.state end,
      enforced_at=coalesce(private.staff_mfa_security_state.enforced_at,excluded.enforced_at),transition_completed_at=coalesce(private.staff_mfa_security_state.transition_completed_at,excluded.transition_completed_at),updated_at=timezone('utc',now());
  end if;
  return new;
end;
$$;
revoke all on function private.ensure_staff_mfa_state_v1() from public,anon,authenticated,service_role;
drop trigger if exists ensure_staff_mfa_state_v1 on private.user_roles;
create trigger ensure_staff_mfa_state_v1 after insert or update of role,expires_at on private.user_roles for each row execute function private.ensure_staff_mfa_state_v1();

create or replace function private.guard_last_staff_totp_factor_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if old.factor_type::text='totp' and old.status::text='verified' and private.user_requires_staff_mfa_v1(old.user_id)
     and coalesce((select s.state from private.staff_mfa_security_state s where s.user_id=old.user_id),'enrollment_required')='enforced'
     and not exists(select 1 from auth.mfa_factors f where f.user_id=old.user_id and f.id<>old.id and f.factor_type::text='totp' and f.status::text='verified') then
    raise exception 'last_verified_staff_totp_required' using errcode='42501';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_last_staff_totp_factor_v1() from public,anon,authenticated,service_role;
drop trigger if exists guard_last_staff_totp_factor_v1 on auth.mfa_factors;
create trigger guard_last_staff_totp_factor_v1 before delete on auth.mfa_factors for each row execute function private.guard_last_staff_totp_factor_v1();

create or replace function private.audit_staff_mfa_factor_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare uid uuid:=coalesce(new.user_id,old.user_id); changed_to_verified boolean:=false; prior_state text;
begin
  if coalesce(new.factor_type,old.factor_type)::text<>'totp' then return coalesce(new,old); end if;
  if not private.user_requires_staff_mfa_v1(uid) and not exists(select 1 from private.staff_mfa_security_state s where s.user_id=uid) then return coalesce(new,old); end if;
  if tg_op='INSERT' then
    insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.enrollment_started','mfa_factor',new.id::text,jsonb_build_object('factorType','totp','status',new.status::text));
  elsif tg_op='UPDATE' then
    changed_to_verified:=old.status::text<>'verified' and new.status::text='verified';
    if changed_to_verified then
      select s.state into prior_state from private.staff_mfa_security_state s where s.user_id=uid for update;
      insert into private.staff_mfa_security_state(user_id,state,enforced_at,transition_completed_at) values(uid,'enforced',timezone('utc',now()),timezone('utc',now()))
      on conflict(user_id) do update set state='enforced',enforced_at=coalesce(private.staff_mfa_security_state.enforced_at,excluded.enforced_at),transition_completed_at=coalesce(private.staff_mfa_security_state.transition_completed_at,excluded.transition_completed_at),updated_at=timezone('utc',now());
      insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.factor_verified','mfa_factor',new.id::text,jsonb_build_object('factorType','totp','status','verified'));
      if coalesce(prior_state,'enrollment_required')<>'enforced' then insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.transition_completed','account_security',uid::text,jsonb_build_object('state','enforced')); end if;
    end if;
  elsif tg_op='DELETE' and old.status::text='verified' then
    insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.factor_removed','mfa_factor',old.id::text,jsonb_build_object('factorType','totp','status','verified'));
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function private.audit_staff_mfa_factor_v1() from public,anon,authenticated,service_role;
drop trigger if exists audit_staff_mfa_factor_v1 on auth.mfa_factors;
create trigger audit_staff_mfa_factor_v1 after insert or update of status or delete on auth.mfa_factors for each row execute function private.audit_staff_mfa_factor_v1();

create or replace function private.audit_staff_mfa_challenge_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare uid uuid;
begin
  select f.user_id into uid from auth.mfa_factors f where f.id=coalesce(new.factor_id,old.factor_id) and f.factor_type::text='totp';
  if uid is null or not private.user_requires_staff_mfa_v1(uid) then return coalesce(new,old); end if;
  if tg_op='INSERT' then insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.challenge_started','mfa_challenge',new.id::text,jsonb_build_object('factorId',new.factor_id::text));
  elsif tg_op='UPDATE' and old.verified_at is null and new.verified_at is not null then insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,'mfa.challenge_succeeded','mfa_challenge',new.id::text,jsonb_build_object('factorId',new.factor_id::text)); end if;
  return coalesce(new,old);
end;
$$;
revoke all on function private.audit_staff_mfa_challenge_v1() from public,anon,authenticated,service_role;
drop trigger if exists audit_staff_mfa_challenge_v1 on auth.mfa_challenges;
create trigger audit_staff_mfa_challenge_v1 after insert or update of verified_at on auth.mfa_challenges for each row execute function private.audit_staff_mfa_challenge_v1();

create or replace function private.record_mfa_client_event_v1(p_event text,p_factor_id uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); event_key text:=lower(btrim(coalesce(p_event,'')));
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if event_key not in('mfa.challenge_failed','mfa.privileged_session_established') then raise exception 'unsupported_mfa_event' using errcode='22023'; end if;
  if p_factor_id is not null and not exists(select 1 from auth.mfa_factors f where f.id=p_factor_id and f.user_id=uid and f.factor_type::text='totp') then raise exception 'mfa_factor_not_owned' using errcode='42501'; end if;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(uid,event_key,case when p_factor_id is null then 'account_security' else 'mfa_factor' end,coalesce(p_factor_id::text,uid::text),jsonb_build_object('aal',private.current_authenticator_assurance_level_v1()));
end;
$$;
revoke all on function private.record_mfa_client_event_v1(text,uuid) from public,anon;
grant execute on function private.record_mfa_client_event_v1(text,uuid) to authenticated,service_role;
create or replace function public.mfa_record_self_event_v1(p_event text,p_factor_id uuid default null) returns void language sql security invoker set search_path='' as $$ select private.record_mfa_client_event_v1(p_event,p_factor_id); $$;
revoke all on function public.mfa_record_self_event_v1(text,uuid) from public,anon;
grant execute on function public.mfa_record_self_event_v1(text,uuid) to authenticated,service_role;

create or replace function private.has_permission(p_permission_key text)
returns boolean language sql stable security definer set search_path=''
as $$
  select private.user_has_permission_v1((select auth.uid()),p_permission_key)
    and (not private.user_requires_staff_mfa_v1((select auth.uid())) or p_permission_key='mfa.self_manage'
      or (private.staff_mfa_state_v1((select auth.uid()))='enforced' and private.user_has_verified_totp_factor_v1((select auth.uid())) and private.current_authenticator_assurance_level_v1()='aal2'));
$$;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.has_permission(text) to authenticated,service_role;

create or replace function private.authorization_context_core_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); profile public.profiles%rowtype; roles_json jsonb; permissions_json jsonb; staff_mfa_required boolean; mfa_factor_enrolled boolean; aal text; mfa_satisfied boolean; mfa_state text; mfa_transition_pending boolean;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into profile from public.profiles where id=uid; if profile.id is null then raise exception 'profile_not_found' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(role order by priority),'[]'::jsonb) into roles_json from(select distinct ur.role,case ur.role when 'super_admin' then 1 when 'admin' then 2 when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 when 'producer' then 7 when 'customer' then 8 else 99 end priority from private.user_roles ur where ur.user_id=uid and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))) active_roles;
  staff_mfa_required:=private.user_requires_staff_mfa_v1(uid); mfa_factor_enrolled:=private.user_has_verified_totp_factor_v1(uid); aal:=private.current_authenticator_assurance_level_v1(); mfa_state:=private.staff_mfa_state_v1(uid); mfa_transition_pending:=staff_mfa_required and coalesce(mfa_state,'enrollment_required')='enrollment_required'; mfa_satisfied:=not staff_mfa_required or (mfa_state='enforced' and mfa_factor_enrolled and aal='aal2');
  if profile.status='active' and profile.deleted_at is null and not coalesce((private.platform_access_block_v1(uid)->>'blocked')::boolean,false) then
    select coalesce(jsonb_agg(permission_key order by permission_key),'[]'::jsonb) into permissions_json from(select distinct rp.permission_key from private.user_roles ur join private.role_permissions rp on rp.role=ur.role join private.permissions p on p.permission_key=rp.permission_key and p.is_active=true where ur.user_id=uid and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and (not staff_mfa_required or rp.permission_key='mfa.self_manage' or mfa_satisfied)) effective_permissions;
  else permissions_json:='[]'::jsonb; end if;
  return jsonb_build_object('userId',uid,'accountStatus',profile.status,'roles',roles_json,'permissions',permissions_json,'canAccessAdmin',private.has_permission('admin.access'),'isAdmin',private.has_role('admin') or private.has_role('super_admin'),'isSuperAdmin',private.has_role('super_admin'),'staffMfaRequired',staff_mfa_required,'mfaFactorEnrolled',mfa_factor_enrolled,'mfaSatisfied',mfa_satisfied,'mfaEnforcementActive',staff_mfa_required,'staffMfaState',mfa_state,'staffMfaTransitionPending',mfa_transition_pending,'authenticatorAssuranceLevel',aal);
end;
$$;
revoke all on function private.authorization_context_core_v1() from public,anon;
grant execute on function private.authorization_context_core_v1() to authenticated,service_role;

create or replace function private.admin_session_status_impl_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); roles jsonb; baseline_allowed boolean; has_legacy_admin_marker boolean; staff_mfa_required boolean; mfa_factor_enrolled boolean; aal text; mfa_state text; mfa_satisfied boolean;
begin
  if caller_id is null then return jsonb_build_object('is_admin',false,'roles','[]'::jsonb,'capabilityBased',true,'staffMfaRequired',false,'mfaFactorEnrolled',false,'mfaSatisfied',true,'mfaEnforcementActive',false,'staffMfaState',null,'staffMfaTransitionPending',false,'authenticatorAssuranceLevel','aal1'); end if;
  perform private.record_current_security_context_v1(caller_id); baseline_allowed:=coalesce(private.user_has_permission_v1(caller_id,'admin.access'),false); staff_mfa_required:=private.user_requires_staff_mfa_v1(caller_id); mfa_factor_enrolled:=private.user_has_verified_totp_factor_v1(caller_id); aal:=private.current_authenticator_assurance_level_v1(); mfa_state:=private.staff_mfa_state_v1(caller_id); mfa_satisfied:=not staff_mfa_required or (mfa_state='enforced' and mfa_factor_enrolled and aal='aal2');
  select coalesce(jsonb_agg(r.role order by case r.role when 'super_admin' then 1 when 'admin' then 2 when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 else 99 end,r.role),'[]'::jsonb) into roles from private.user_roles r where r.user_id=caller_id and r.role in('support','content_editor','operations','moderator','admin','super_admin') and (r.expires_at is null or r.expires_at>timezone('utc',now()));
  has_legacy_admin_marker:=roles?'admin' or roles?'super_admin'; if baseline_allowed and not has_legacy_admin_marker then roles:=roles||jsonb_build_array('admin'); end if;
  return jsonb_build_object('is_admin',baseline_allowed,'roles',case when baseline_allowed then roles else '[]'::jsonb end,'capabilityBased',true,'legacyAdminShellMarker',baseline_allowed and not has_legacy_admin_marker,'staffMfaRequired',staff_mfa_required,'mfaFactorEnrolled',mfa_factor_enrolled,'mfaSatisfied',mfa_satisfied,'mfaEnforcementActive',staff_mfa_required,'staffMfaState',mfa_state,'staffMfaTransitionPending',staff_mfa_required and coalesce(mfa_state,'enrollment_required')='enrollment_required','authenticatorAssuranceLevel',aal);
end;
$$;
revoke all on function private.admin_session_status_impl_v1() from public,anon;
grant execute on function private.admin_session_status_impl_v1() to authenticated,service_role;

create or replace function public.ci_set_e2e_staff_role_for_service_v1(p_user_id uuid,p_role text,p_slot text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare u auth.users%rowtype; normalized_role text:=lower(btrim(coalesce(p_role,''))); normalized_slot text:=lower(btrim(coalesce(p_slot,'')));
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if normalized_role not in('moderator','admin','super_admin') then raise exception 'ci_staff_role_not_allowed' using errcode='22023'; end if;
  if normalized_slot<>'' and normalized_slot !~ '^[a-z0-9-]{1,24}$' then raise exception 'invalid_ci_slot' using errcode='22023'; end if;
  select * into u from auth.users where id=p_user_id;
  if u.id is null or coalesce(u.raw_user_meta_data->>'source','')<>'github-actions-e2e' or coalesce(u.raw_user_meta_data->>'e2e_run_id','') !~ '^[0-9]{1,24}$' then raise exception 'ci_user_required' using errcode='42501'; end if;
  insert into private.user_roles(user_id,role,granted_by,expires_at) values(u.id,normalized_role,null,timezone('utc',now())+interval '15 minutes') on conflict(user_id,role) do update set expires_at=excluded.expires_at;
end;
$$;
revoke all on function public.ci_set_e2e_staff_role_for_service_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ci_set_e2e_staff_role_for_service_v1(uuid,text,text) to service_role;

create or replace function public.ci_remove_e2e_staff_roles_for_service_v1(p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare u auth.users%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  select * into u from auth.users where id=p_user_id; if u.id is null or coalesce(u.raw_user_meta_data->>'source','')<>'github-actions-e2e' then raise exception 'ci_user_required' using errcode='42501'; end if;
  delete from private.user_roles where user_id=u.id and role in('support','content_editor','operations','moderator','admin','super_admin');
end;
$$;
revoke all on function public.ci_remove_e2e_staff_roles_for_service_v1(uuid) from public,anon,authenticated;
grant execute on function public.ci_remove_e2e_staff_roles_for_service_v1(uuid) to service_role;

create or replace function private.cleanup_stale_ci_e2e_users_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare target record;candidate_count integer:=0;deleted_count integer:=0;skipped_count integer:=0;deleted_one integer:=0;
begin
  for target in select u.id from auth.users u where u.created_at<timezone('utc',now())-interval '6 hours' and coalesce(u.raw_user_meta_data->>'source','')='github-actions-e2e' and coalesce(u.raw_user_meta_data->>'e2e_run_id','')~'^[0-9]{1,24}$' and lower(coalesce(u.email,'')) ~ '^goldenoremar\+ci-e2e-[0-9]{1,24}(-[a-z0-9-]{1,24})?@gmail\.com$' order by u.created_at limit 100
  loop candidate_count:=candidate_count+1; begin delete from auth.users where id=target.id; get diagnostics deleted_one=row_count;deleted_count:=deleted_count+deleted_one;exception when foreign_key_violation then skipped_count:=skipped_count+1;end; end loop;
  if candidate_count>0 then insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details,correlation_id,before_state,after_state) values(null,'ci.e2e_stale_user_gc','automation',null,jsonb_build_object('candidateCount',candidate_count,'deletedCount',deleted_count,'skippedForeignKeyCount',skipped_count,'minimumAgeHours',6,'batchLimit',100),gen_random_uuid(),null,jsonb_build_object('candidateCount',candidate_count,'deletedCount',deleted_count,'skippedForeignKeyCount',skipped_count)); end if;
  return jsonb_build_object('ok',true,'candidateCount',candidate_count,'deletedCount',deleted_count,'skippedForeignKeyCount',skipped_count);
end;
$$;
revoke all on function private.cleanup_stale_ci_e2e_users_v1() from public,anon,authenticated;
grant execute on function private.cleanup_stale_ci_e2e_users_v1() to service_role;
