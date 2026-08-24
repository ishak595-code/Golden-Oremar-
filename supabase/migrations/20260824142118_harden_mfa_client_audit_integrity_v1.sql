create or replace function private.record_mfa_client_event_v1(p_event text,p_factor_id uuid default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  event_key text:=lower(btrim(coalesce(p_event,'')));
  aal text;
  recent_failures integer:=0;
  factor_status text;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  if not private.user_requires_staff_mfa_v1(uid) then
    raise exception 'staff_mfa_event_required' using errcode='42501';
  end if;

  if event_key not in('mfa.challenge_failed','mfa.privileged_session_established') then
    raise exception 'unsupported_mfa_event' using errcode='22023';
  end if;

  if p_factor_id is null then
    raise exception 'mfa_factor_required' using errcode='22023';
  end if;

  select f.status::text
    into factor_status
  from auth.mfa_factors f
  where f.id=p_factor_id
    and f.user_id=uid
    and f.factor_type::text='totp';

  if factor_status is null then
    raise exception 'mfa_factor_not_owned' using errcode='42501';
  end if;

  aal:=private.current_authenticator_assurance_level_v1();

  if event_key='mfa.privileged_session_established' then
    if factor_status<>'verified' or aal<>'aal2' then
      raise exception 'aal2_verified_factor_required' using errcode='42501';
    end if;
  else
    select count(*)::int
      into recent_failures
    from private.admin_audit_logs l
    where l.actor_user_id=uid
      and l.action='mfa.challenge_failed'
      and l.created_at>=timezone('utc',now())-interval '1 minute';

    if recent_failures>=30 then
      raise exception 'mfa_audit_rate_limited' using errcode='42900';
    end if;
  end if;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(
    uid,
    event_key,
    'mfa_factor',
    p_factor_id::text,
    jsonb_build_object(
      'aal',aal,
      'factorType','totp',
      'evidenceSource',case when event_key='mfa.challenge_failed' then 'client_observed' else 'client_confirmed_after_auth_verify' end
    )
  );
end;
$$;

revoke all on function private.record_mfa_client_event_v1(text,uuid) from public,anon;
grant execute on function private.record_mfa_client_event_v1(text,uuid) to authenticated,service_role;

create or replace function public.mfa_record_self_event_v1(p_event text,p_factor_id uuid default null)
returns void
language sql
security invoker
set search_path=''
as $$ select private.record_mfa_client_event_v1(p_event,p_factor_id); $$;

revoke all on function public.mfa_record_self_event_v1(text,uuid) from public,anon;
grant execute on function public.mfa_record_self_event_v1(text,uuid) to authenticated,service_role;
