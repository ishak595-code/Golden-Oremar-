create or replace function private.bootstrap_super_admin_v1(p_user_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  reason_value text:=btrim(coalesce(p_reason,''));
  target public.profiles%rowtype;
  active_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_user_id is null then raise exception 'bootstrap_target_required' using errcode='22023'; end if;
  if char_length(reason_value) not between 20 and 500 then raise exception 'bootstrap_reason_required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtext('golden-oremar:super-admin-bootstrap'));
  select count(*) into active_count
  from private.user_roles ur
  join public.profiles p on p.id=ur.user_id
  where ur.role='super_admin'
    and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
    and p.status='active' and p.deleted_at is null
    and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false);
  if active_count<>0 then raise exception 'super_admin_already_configured' using errcode='42501'; end if;

  select * into target from public.profiles where id=p_user_id for update;
  if target.id is null or target.status<>'active' or target.deleted_at is not null then raise exception 'bootstrap_target_not_active' using errcode='42501'; end if;
  if coalesce((private.platform_access_block_v1(p_user_id)->>'blocked')::boolean,false) then raise exception 'bootstrap_target_blocked' using errcode='42501'; end if;

  insert into private.user_roles(user_id,role,granted_by)
  values(p_user_id,'customer',null)
  on conflict(user_id,role) do update set granted_at=timezone('utc',now()),expires_at=null;
  insert into private.user_roles(user_id,role,granted_by)
  values(p_user_id,'super_admin',null)
  on conflict(user_id,role) do update set granted_at=timezone('utc',now()),expires_at=null;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details,correlation_id,before_state,after_state)
  values(null,'authorization.break_glass_super_admin_bootstrap','user',p_user_id::text,
    jsonb_build_object('reason',reason_value,'executionRole','service_role','automaticAssignment',false),
    gen_random_uuid(),jsonb_build_object('activeSuperAdmins',0),jsonb_build_object('roles',jsonb_build_array('customer','super_admin')));

  return jsonb_build_object('ok',true,'userId',p_user_id,'role','super_admin','breakGlass',true);
end;
$$;
revoke all on function private.bootstrap_super_admin_v1(uuid,text) from public,anon,authenticated;
grant execute on function private.bootstrap_super_admin_v1(uuid,text) to service_role;

create or replace function private.active_super_admin_count_v1()
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select count(*)::integer
  from private.user_roles ur
  join public.profiles p on p.id=ur.user_id
  where ur.role='super_admin'
    and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
    and p.status='active' and p.deleted_at is null
    and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false);
$$;
revoke all on function private.active_super_admin_count_v1() from public,anon,authenticated;
grant execute on function private.active_super_admin_count_v1() to service_role;