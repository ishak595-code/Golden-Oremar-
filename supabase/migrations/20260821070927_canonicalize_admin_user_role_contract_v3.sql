-- Canonical admin user management contract.
-- Replaces the retired UI aliases `user` / `vendor` with the database roles
-- customer / producer / support / content_editor / operations / admin / super_admin.

create or replace function private.admin_list_platform_users_v3()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  reveal_sensitive boolean;
begin
  if caller_id is null or not coalesce(private.is_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  reveal_sensitive := coalesce(private.has_role('super_admin'), false);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'displayName', nullif(btrim(p.display_name), ''),
        'email', u.email,
        'roles', role_state.roles,
        'primaryRole', role_state.primary_role,
        'status', case
          when p.status = 'active' then 'active'
          when p.status = 'deleted' then 'deleted'
          else 'blocked'
        end,
        'profileStatus', p.status,
        'joinDate', p.created_at,
        'producerId', producer.id,
        'producerStatus', producer.status,
        'producerCommissionBasisPoints', case when reveal_sensitive then producer.commission_basis_points else null end,
        'lastSeenAt', p.last_seen_at,
        'lastKnownIp', case when reveal_sensitive then latest.ip_address::text else null end,
        'knownDeviceCount', (
          select count(distinct c.device_id)
          from private.user_security_contexts c
          where c.user_id = p.id and c.device_id is not null
        ),
        'activeSecurityRuleCount', (
          select count(*)
          from private.security_block_rules r
          where r.source_user_id = p.id
            and r.active = true
            and (r.expires_at is null or r.expires_at > timezone('utc', now()))
        ),
        'fraudFlag', exists (
          select 1
          from private.security_block_rules r
          where r.source_user_id = p.id
            and r.active = true
            and r.fraud_flag = true
            and (r.expires_at is null or r.expires_at > timezone('utc', now()))
        ),
        'lastEnforcementReason', (
          select e.reason
          from private.account_enforcement_events e
          where e.user_id = p.id
          order by e.created_at desc
          limit 1
        ),
        'lastEnforcementAt', (
          select e.created_at
          from private.account_enforcement_events e
          where e.user_id = p.id
          order by e.created_at desc
          limit 1
        )
      )
      order by p.created_at desc
    )
    from public.profiles p
    join auth.users u on u.id = p.id
    left join lateral (
      select
        array_agg(
          r.role
          order by case r.role
            when 'super_admin' then 1
            when 'admin' then 2
            when 'operations' then 3
            when 'content_editor' then 4
            when 'support' then 5
            when 'producer' then 6
            when 'customer' then 7
            else 99
          end
        ) as roles,
        (
          array_agg(
            r.role
            order by case r.role
              when 'super_admin' then 1
              when 'admin' then 2
              when 'operations' then 3
              when 'content_editor' then 4
              when 'support' then 5
              when 'producer' then 6
              when 'customer' then 7
              else 99
            end
          )
        )[1] as primary_role
      from private.user_roles r
      where r.user_id = p.id
        and (r.expires_at is null or r.expires_at > timezone('utc', now()))
    ) role_state on true
    left join lateral (
      select pr.id, pr.status, pr.commission_basis_points
      from public.producers pr
      where pr.owner_user_id = p.id
        and pr.deleted_at is null
      order by pr.created_at desc
      limit 1
    ) producer on true
    left join lateral (
      select c.ip_address
      from private.user_security_contexts c
      where c.user_id = p.id
        and c.ip_address is not null
      order by c.last_seen_at desc
      limit 1
    ) latest on true
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_platform_users_v3()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_list_platform_users_v3();
$$;

create or replace function private.admin_set_platform_user_role_v2(
  p_user_id uuid,
  p_role text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_role text := lower(btrim(coalesce(p_role, '')));
  normalized_reason text := btrim(coalesce(p_reason, ''));
  caller_is_super_admin boolean;
  target_is_super_admin boolean;
  active_super_admin_count integer;
  previous_roles text[];
  next_roles text[];
begin
  if caller_id is null or not coalesce(private.is_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_user_id is null or normalized_role not in ('customer','producer','support','content_editor','operations','admin','super_admin') then
    raise exception 'invalid_user_role' using errcode = '22023';
  end if;

  if char_length(normalized_reason) not between 8 and 500 then
    raise exception 'role_reason_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.status <> 'deleted'
  ) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  caller_is_super_admin := coalesce(private.has_role('super_admin'), false);

  select exists (
    select 1 from private.user_roles r
    where r.user_id = p_user_id
      and r.role = 'super_admin'
      and (r.expires_at is null or r.expires_at > timezone('utc', now()))
  ) into target_is_super_admin;

  if normalized_role in ('admin','super_admin') and not caller_is_super_admin then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;

  if target_is_super_admin and normalized_role <> 'super_admin' then
    if not caller_is_super_admin then
      raise exception 'super_admin_required' using errcode = '42501';
    end if;

    if p_user_id = caller_id then
      raise exception 'cannot_demote_current_super_admin' using errcode = '42501';
    end if;

    select count(*) into active_super_admin_count
    from private.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.role = 'super_admin'
      and (r.expires_at is null or r.expires_at > timezone('utc', now()))
      and p.status = 'active';

    if active_super_admin_count <= 1 then
      raise exception 'last_super_admin_cannot_be_demoted' using errcode = '42501';
    end if;
  end if;

  if normalized_role = 'producer' and not exists (
    select 1 from public.producers pr
    where pr.owner_user_id = p_user_id
      and pr.deleted_at is null
      and pr.status in ('active','suspended')
  ) then
    raise exception 'producer_profile_required' using errcode = '22023';
  end if;

  select coalesce(array_agg(r.role order by r.role), '{}'::text[])
  into previous_roles
  from private.user_roles r
  where r.user_id = p_user_id
    and (r.expires_at is null or r.expires_at > timezone('utc', now()));

  delete from private.user_roles
  where user_id = p_user_id
    and role in ('customer','producer','support','content_editor','operations','admin','super_admin');

  insert into private.user_roles(user_id, role, granted_by)
  values (p_user_id, 'customer', caller_id)
  on conflict (user_id, role) do update
  set granted_by = excluded.granted_by,
      granted_at = timezone('utc', now()),
      expires_at = null;

  if normalized_role <> 'customer' then
    insert into private.user_roles(user_id, role, granted_by)
    values (p_user_id, normalized_role, caller_id)
    on conflict (user_id, role) do update
    set granted_by = excluded.granted_by,
        granted_at = timezone('utc', now()),
        expires_at = null;
  end if;

  next_roles := case
    when normalized_role = 'customer' then array['customer']::text[]
    else array[normalized_role, 'customer']::text[]
  end;

  insert into private.admin_audit_logs(actor_user_id, action, target_type, target_id, details)
  values (
    caller_id,
    'user.role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object('previousRoles', previous_roles, 'nextRoles', next_roles, 'reason', normalized_reason)
  );

  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (
    p_user_id,
    'system',
    'Hesap rolünüz güncellendi',
    'Hesap yetkiniz yönetim incelemesinin ardından güncellendi.',
    '/?tab=account',
    jsonb_build_object('role', normalized_role, 'reason', normalized_reason, 'actorUserId', caller_id)
  );

  return jsonb_build_object('id', p_user_id, 'role', normalized_role, 'roles', to_jsonb(next_roles));
end;
$$;

create or replace function public.admin_set_platform_user_role_v2(
  p_user_id uuid,
  p_role text,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_set_platform_user_role_v2(p_user_id, p_role, p_reason);
$$;

revoke all on function public.admin_list_platform_users_v3() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_platform_users_v3() to authenticated;

revoke all on function public.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_platform_user_role_v2(uuid, text, text) to authenticated;

revoke all on function private.admin_list_platform_users_v3() from public, anon, authenticated, service_role;
revoke all on function private.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;

revoke execute on function public.admin_list_platform_users_v1() from anon, authenticated;
revoke execute on function public.admin_list_platform_users_v2() from anon, authenticated;
revoke execute on function public.admin_set_platform_user_role_v1(uuid, text, text) from anon, authenticated;