create or replace function private.current_authenticator_assurance_level_v1()
returns text
language sql
stable
security invoker
set search_path=''
as $$
  select case when coalesce((select auth.jwt()->>'aal'),'aal1')='aal2' then 'aal2' else 'aal1' end;
$$;
revoke all on function private.current_authenticator_assurance_level_v1() from public,anon,authenticated,service_role;

create or replace function private.user_requires_staff_mfa_v1(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_user_id is not null and exists(
    select 1
    from private.user_roles ur
    join public.profiles profile on profile.id=ur.user_id
    where ur.user_id=p_user_id
      and ur.role in ('support','content_editor','operations','moderator','admin','super_admin')
      and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
      and profile.status='active'
      and profile.deleted_at is null
      and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false)
  );
$$;
revoke all on function private.user_requires_staff_mfa_v1(uuid) from public,anon,authenticated,service_role;

create or replace function private.user_has_verified_totp_factor_v1(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_user_id is not null and exists(
    select 1
    from auth.mfa_factors factor
    where factor.user_id=p_user_id
      and factor.status::text='verified'
      and factor.factor_type::text='totp'
  );
$$;
revoke all on function private.user_has_verified_totp_factor_v1(uuid) from public,anon,authenticated,service_role;

create or replace function private.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.user_has_permission_v1((select auth.uid()),p_permission_key)
    and (
      not private.user_requires_staff_mfa_v1((select auth.uid()))
      or not private.user_has_verified_totp_factor_v1((select auth.uid()))
      or private.current_authenticator_assurance_level_v1()='aal2'
    );
$$;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.has_permission(text) to authenticated,service_role;

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
  staff_mfa_required boolean;
  mfa_factor_enrolled boolean;
  aal text;
  mfa_satisfied boolean;
  mfa_enforcement_active boolean;
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

  staff_mfa_required:=private.user_requires_staff_mfa_v1(uid);
  mfa_factor_enrolled:=private.user_has_verified_totp_factor_v1(uid);
  aal:=private.current_authenticator_assurance_level_v1();
  mfa_satisfied:=not staff_mfa_required or (mfa_factor_enrolled and aal='aal2');
  mfa_enforcement_active:=staff_mfa_required and mfa_factor_enrolled;

  if profile.status='active'
     and profile.deleted_at is null
     and not coalesce((private.platform_access_block_v1(uid)->>'blocked')::boolean,false)
     and (not mfa_enforcement_active or aal='aal2') then
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
    'isSuperAdmin',private.has_role('super_admin'),
    'staffMfaRequired',staff_mfa_required,
    'mfaFactorEnrolled',mfa_factor_enrolled,
    'mfaSatisfied',mfa_satisfied,
    'mfaEnforcementActive',mfa_enforcement_active,
    'authenticatorAssuranceLevel',aal
  );
end;
$$;
revoke all on function private.authorization_context_core_v1() from public,anon;
grant execute on function private.authorization_context_core_v1() to authenticated,service_role;

create or replace function private.admin_session_status_impl_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  roles jsonb;
  baseline_allowed boolean;
  has_legacy_admin_marker boolean;
  staff_mfa_required boolean;
  mfa_factor_enrolled boolean;
  aal text;
begin
  if caller_id is null then return jsonb_build_object('is_admin',false,'roles','[]'::jsonb,'capabilityBased',true,'staffMfaRequired',false,'mfaFactorEnrolled',false,'mfaSatisfied',true,'authenticatorAssuranceLevel','aal1'); end if;
  perform private.record_current_security_context_v1(caller_id);
  baseline_allowed:=coalesce(private.user_has_permission_v1(caller_id,'admin.access'),false);
  staff_mfa_required:=private.user_requires_staff_mfa_v1(caller_id);
  mfa_factor_enrolled:=private.user_has_verified_totp_factor_v1(caller_id);
  aal:=private.current_authenticator_assurance_level_v1();

  select coalesce(jsonb_agg(r.role order by case r.role when 'super_admin' then 1 when 'admin' then 2 when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 else 99 end,r.role),'[]'::jsonb)
  into roles
  from private.user_roles r
  where r.user_id=caller_id
    and r.role in ('support','content_editor','operations','moderator','admin','super_admin')
    and (r.expires_at is null or r.expires_at>timezone('utc',now()));

  has_legacy_admin_marker:=roles ? 'admin' or roles ? 'super_admin';
  if baseline_allowed and not has_legacy_admin_marker then roles:=roles||jsonb_build_array('admin'); end if;

  return jsonb_build_object(
    'is_admin',baseline_allowed,
    'roles',case when baseline_allowed then roles else '[]'::jsonb end,
    'capabilityBased',true,
    'legacyAdminShellMarker',baseline_allowed and not has_legacy_admin_marker,
    'staffMfaRequired',staff_mfa_required,
    'mfaFactorEnrolled',mfa_factor_enrolled,
    'mfaSatisfied',not staff_mfa_required or (mfa_factor_enrolled and aal='aal2'),
    'mfaEnforcementActive',staff_mfa_required and mfa_factor_enrolled,
    'authenticatorAssuranceLevel',aal
  );
end;
$$;
revoke all on function private.admin_session_status_impl_v1() from public,anon;
grant execute on function private.admin_session_status_impl_v1() to authenticated,service_role;
