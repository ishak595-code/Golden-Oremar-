-- Prevent ordinary admins from changing administrator accounts and prevent
-- any administrator from changing their own role through this management flow.

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
  target_is_admin boolean;
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

  if p_user_id = caller_id then
    raise exception 'cannot_change_current_user_role' using errcode = '42501';
  end if;

  caller_is_super_admin := coalesce(private.has_role('super_admin'), false);

  select
    exists (
      select 1 from private.user_roles r
      where r.user_id = p_user_id
        and r.role = 'admin'
        and (r.expires_at is null or r.expires_at > timezone('utc', now()))
    ),
    exists (
      select 1 from private.user_roles r
      where r.user_id = p_user_id
        and r.role = 'super_admin'
        and (r.expires_at is null or r.expires_at > timezone('utc', now()))
    )
  into target_is_admin, target_is_super_admin;

  if (target_is_admin or target_is_super_admin) and not caller_is_super_admin then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;

  if normalized_role in ('admin','super_admin') and not caller_is_super_admin then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;

  if target_is_super_admin and normalized_role <> 'super_admin' then
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
    jsonb_build_object(
      'previousRoles', previous_roles,
      'nextRoles', next_roles,
      'reason', normalized_reason
    )
  );

  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (
    p_user_id,
    'system',
    'Hesap rolünüz güncellendi',
    'Hesap yetkiniz yönetim incelemesinin ardından güncellendi.',
    '/?tab=account',
    jsonb_build_object(
      'role', normalized_role,
      'reason', normalized_reason,
      'actorUserId', caller_id
    )
  );

  return jsonb_build_object(
    'id', p_user_id,
    'role', normalized_role,
    'roles', to_jsonb(next_roles)
  );
end;
$$;

revoke all on function private.admin_set_platform_user_role_v2(uuid, text, text) from public, anon, authenticated, service_role;