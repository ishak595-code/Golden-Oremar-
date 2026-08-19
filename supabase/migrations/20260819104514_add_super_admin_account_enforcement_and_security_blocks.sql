create table if not exists private.user_security_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid,
  ip_address inet,
  user_agent_hash text,
  first_seen_at timestamptz not null default timezone('utc',now()),
  last_seen_at timestamptz not null default timezone('utc',now()),
  check (device_id is not null or ip_address is not null),
  check (user_agent_hash is null or user_agent_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists user_security_contexts_user_last_seen_idx on private.user_security_contexts(user_id,last_seen_at desc);
create index if not exists user_security_contexts_ip_idx on private.user_security_contexts(ip_address) where ip_address is not null;
create index if not exists user_security_contexts_device_idx on private.user_security_contexts(device_id) where device_id is not null;

create table if not exists private.security_block_rules (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','ip','device')),
  user_id uuid references public.profiles(id) on delete cascade,
  ip_network cidr,
  device_id uuid,
  source_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 8 and 1000),
  fraud_flag boolean not null default false,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (
    (subject_type='user' and user_id is not null and ip_network is null and device_id is null)
    or (subject_type='ip' and user_id is null and ip_network is not null and device_id is null)
    or (subject_type='device' and user_id is null and ip_network is null and device_id is not null)
  ),
  check (expires_at is null or expires_at>created_at)
);
create index if not exists security_block_rules_user_active_idx on private.security_block_rules(user_id) where active=true and subject_type='user';
create index if not exists security_block_rules_ip_active_idx on private.security_block_rules(ip_network) where active=true and subject_type='ip';
create index if not exists security_block_rules_device_active_idx on private.security_block_rules(device_id) where active=true and subject_type='device';
create index if not exists security_block_rules_source_user_idx on private.security_block_rules(source_user_id,created_at desc);

create table if not exists private.account_enforcement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('blocked','unblocked','closed','ip_blocked','device_blocked','rule_revoked','fraud_flagged')),
  reason text not null check (char_length(reason) between 8 and 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default timezone('utc',now())
);
create index if not exists account_enforcement_events_user_created_idx on private.account_enforcement_events(user_id,created_at desc);

create or replace function private.current_request_ip_v1()
returns inet language plpgsql stable security definer set search_path=''
as $$
declare headers jsonb; raw text;
begin
  begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then return null; end;
  if headers is null then return null; end if;
  raw:=coalesce(nullif(btrim(headers->>'cf-connecting-ip'),''),nullif(btrim(headers->>'x-real-ip'),''),nullif(btrim(split_part(coalesce(headers->>'x-forwarded-for',''),',',1)),''));
  if raw is null then return null; end if;
  begin return raw::inet; exception when others then return null; end;
end;
$$;

create or replace function private.current_request_device_id_v1()
returns uuid language plpgsql stable security definer set search_path=''
as $$
declare headers jsonb; raw text;
begin
  begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then return null; end;
  raw:=nullif(btrim(coalesce(headers->>'x-golden-device-id','')),'');
  if raw is null or raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return raw::uuid;
end;
$$;

create or replace function private.current_request_user_agent_hash_v1()
returns text language plpgsql stable security definer set search_path=''
as $$
declare headers jsonb; raw text;
begin
  begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then return null; end;
  raw:=left(coalesce(headers->>'user-agent',''),1000);
  if raw='' then return null; end if;
  return encode(extensions.digest(convert_to(raw,'UTF8'),'sha256'),'hex');
end;
$$;

create or replace function private.record_current_security_context_v1(p_user_id uuid default auth.uid())
returns void language plpgsql security definer set search_path=''
as $$
declare ip inet:=private.current_request_ip_v1(); device uuid:=private.current_request_device_id_v1(); ua text:=private.current_request_user_agent_hash_v1(); context_id uuid;
begin
  if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id) then return; end if;
  if ip is null and device is null then return; end if;
  select id into context_id from private.user_security_contexts c
  where c.user_id=p_user_id and c.device_id is not distinct from device and c.ip_address is not distinct from ip
  order by c.last_seen_at desc limit 1;
  if context_id is null then
    insert into private.user_security_contexts(user_id,device_id,ip_address,user_agent_hash) values(p_user_id,device,ip,ua);
  else
    update private.user_security_contexts set last_seen_at=timezone('utc',now()),user_agent_hash=coalesce(ua,user_agent_hash) where id=context_id;
  end if;
end;
$$;

create or replace function private.platform_access_block_v1(p_user_id uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare ip inet:=private.current_request_ip_v1(); device uuid:=private.current_request_device_id_v1(); profile_status text; rule private.security_block_rules%rowtype;
begin
  if p_user_id is null then return jsonb_build_object('blocked',false); end if;
  select status into profile_status from public.profiles where id=p_user_id and deleted_at is null;
  if profile_status is null then return jsonb_build_object('blocked',true,'code','account_closed','reason','Hesap kapalı.'); end if;
  if profile_status<>'active' then return jsonb_build_object('blocked',true,'code','profile_'||profile_status,'reason','Hesap erişimi kısıtlı.'); end if;
  select * into rule from private.security_block_rules r where r.active=true and (r.expires_at is null or r.expires_at>timezone('utc',now())) and (
    (r.subject_type='user' and r.user_id=p_user_id)
    or (r.subject_type='ip' and ip is not null and ip <<= r.ip_network)
    or (r.subject_type='device' and device is not null and r.device_id=device)
  ) order by case r.subject_type when 'user' then 1 when 'device' then 2 else 3 end,r.created_at desc limit 1;
  if rule.id is not null then return jsonb_build_object('blocked',true,'code','security_'||rule.subject_type||'_blocked','reason',rule.reason,'fraudFlag',rule.fraud_flag,'ruleId',rule.id); end if;
  return jsonb_build_object('blocked',false);
end;
$$;

create or replace function private.assert_platform_access_v1(p_user_id uuid default auth.uid())
returns void language plpgsql stable security definer set search_path=''
as $$
declare block jsonb:=private.platform_access_block_v1(p_user_id);
begin
  if coalesce((block->>'blocked')::boolean,false) then raise exception 'platform_access_blocked:%',coalesce(block->>'code','blocked') using errcode='42501'; end if;
end;
$$;

create or replace function private.has_role(required_role text)
returns boolean language sql stable set search_path=''
as $$
  select exists(
    select 1 from private.user_roles ur join public.profiles p on p.id=ur.user_id
    where ur.user_id=(select auth.uid()) and ur.role=required_role
      and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
      and p.status='active' and p.deleted_at is null
      and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false)
  );
$$;

create or replace function public.customer_session_status()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); profile public.profiles%rowtype; block jsonb; roles jsonb;
begin
  if caller_id is null then return null; end if;
  perform private.record_current_security_context_v1(caller_id);
  select * into profile from public.profiles where id=caller_id;
  if profile.id is null then return null; end if;
  block:=private.platform_access_block_v1(caller_id);
  select coalesce(jsonb_agg(r.role order by r.role),'[]'::jsonb) into roles from private.user_roles r where r.user_id=caller_id and (r.expires_at is null or r.expires_at>timezone('utc',now()));
  return jsonb_build_object(
    'is_authenticated',true,'user_id',profile.id,'email',coalesce(auth.jwt()->>'email',''),'display_name',profile.display_name,'phone',profile.phone,'locale',profile.locale,
    'status',case when coalesce((block->>'blocked')::boolean,false) then 'blocked' else profile.status end,'roles',roles,
    'access_code',block->>'code','access_reason',block->>'reason','fraud_flag',coalesce((block->>'fraudFlag')::boolean,false)
  );
end;
$$;

create or replace function public.admin_session_status()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); roles jsonb; allowed boolean;
begin
  if caller_id is null then return jsonb_build_object('is_admin',false,'roles','[]'::jsonb); end if;
  perform private.record_current_security_context_v1(caller_id);
  allowed:=coalesce(private.is_admin(),false);
  select coalesce(jsonb_agg(r.role order by r.role),'[]'::jsonb) into roles from private.user_roles r where r.user_id=caller_id and r.role in ('admin','super_admin') and (r.expires_at is null or r.expires_at>timezone('utc',now()));
  return jsonb_build_object('is_admin',allowed,'roles',case when allowed then roles else '[]'::jsonb end);
end;
$$;

create or replace function private.admin_list_platform_users_v2()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); reveal_sensitive boolean;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  reveal_sensitive:=coalesce(private.has_role('super_admin'),false);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',coalesce(nullif(p.display_name,''),split_part(u.email,'@',1),'Kullanıcı'),'email',coalesce(u.email,''),
    'role',case when roles.has_super_admin then 'super_admin' when roles.has_admin then 'admin' when roles.has_producer then 'vendor' else 'user' end,
    'status',case when p.status='active' then 'active' when p.status='deleted' then 'deleted' else 'blocked' end,
    'profileStatus',p.status,'joinDate',p.created_at,'vendor_id',producer.id,'producerStatus',producer.status,'producerCommissionBasisPoints',producer.commission_basis_points,
    'lastSeenAt',p.last_seen_at,'lastKnownIp',case when reveal_sensitive then latest.ip_address::text else null end,
    'knownDeviceCount',(select count(distinct c.device_id) from private.user_security_contexts c where c.user_id=p.id and c.device_id is not null),
    'activeSecurityRuleCount',(select count(*) from private.security_block_rules r where r.source_user_id=p.id and r.active=true and (r.expires_at is null or r.expires_at>timezone('utc',now()))),
    'fraudFlag',exists(select 1 from private.security_block_rules r where r.source_user_id=p.id and r.active=true and r.fraud_flag=true and (r.expires_at is null or r.expires_at>timezone('utc',now()))),
    'lastEnforcementReason',(select e.reason from private.account_enforcement_events e where e.user_id=p.id order by e.created_at desc limit 1),
    'lastEnforcementAt',(select e.created_at from private.account_enforcement_events e where e.user_id=p.id order by e.created_at desc limit 1)
  ) order by p.created_at desc) from public.profiles p join auth.users u on u.id=p.id
  left join lateral(select bool_or(r.role='super_admin') has_super_admin,bool_or(r.role='admin') has_admin,bool_or(r.role='producer') has_producer from private.user_roles r where r.user_id=p.id and (r.expires_at is null or r.expires_at>timezone('utc',now()))) roles on true
  left join lateral(select pr.id,pr.status,pr.commission_basis_points from public.producers pr where pr.owner_user_id=p.id and pr.deleted_at is null order by pr.created_at desc limit 1) producer on true
  left join lateral(select c.ip_address from private.user_security_contexts c where c.user_id=p.id and c.ip_address is not null order by c.last_seen_at desc limit 1) latest on true),'[]'::jsonb);
end;
$$;
create or replace function public.admin_list_platform_users_v2() returns jsonb language sql set search_path='' as $$select private.admin_list_platform_users_v2();$$;
revoke all on function public.admin_list_platform_users_v2() from public,anon;
grant execute on function public.admin_list_platform_users_v2() to authenticated;

create or replace function private.admin_enforce_platform_user_v1(
  p_user_id uuid,p_action text,p_reason text,p_block_known_ips boolean default false,p_block_known_devices boolean default false,p_fraud_flag boolean default false,p_expires_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); action_value text:=lower(btrim(coalesce(p_action,''))); reason_value text:=btrim(coalesce(p_reason,'')); caller_super boolean; target_super boolean; target_admin boolean; target public.profiles%rowtype; producer public.producers%rowtype; rule_count integer:=0; ctx record;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if action_value not in ('block','unblock','close') then raise exception 'invalid_enforcement_action' using errcode='22023'; end if;
  if char_length(reason_value) not between 8 and 1000 then raise exception 'enforcement_reason_required' using errcode='22023'; end if;
  if p_user_id=caller_id and action_value in ('block','close') then raise exception 'cannot_enforce_current_user' using errcode='42501'; end if;
  caller_super:=coalesce(private.has_role('super_admin'),false);
  select exists(select 1 from private.user_roles where user_id=p_user_id and role='super_admin' and (expires_at is null or expires_at>timezone('utc',now()))),exists(select 1 from private.user_roles where user_id=p_user_id and role='admin' and (expires_at is null or expires_at>timezone('utc',now()))) into target_super,target_admin;
  if (target_super or target_admin or action_value='close' or p_block_known_ips or p_block_known_devices or p_fraud_flag) and not caller_super then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into target from public.profiles where id=p_user_id for update;
  if target.id is null then raise exception 'user_not_found' using errcode='P0002'; end if;
  if p_expires_at is not null and p_expires_at<=timezone('utc',now()) then raise exception 'invalid_block_expiry' using errcode='22023'; end if;

  if action_value='block' then
    update public.profiles set status='blocked',deleted_at=null where id=p_user_id;
    update public.producers set status=case when status='closed' then status else 'suspended' end,
      trust_badge_status=case when trust_badge_status='active' then 'revoked' else trust_badge_status end,
      trust_badge_revoked_at=case when trust_badge_status='active' then timezone('utc',now()) else trust_badge_revoked_at end,
      trust_badge_reason=case when trust_badge_status='active' then 'Hesap güvenlik nedeniyle engellendi: '||reason_value else trust_badge_reason end,
      updated_at=timezone('utc',now()) where owner_user_id=p_user_id and deleted_at is null returning * into producer;
    update private.device_push_tokens set disabled_at=coalesce(disabled_at,timezone('utc',now())),updated_at=timezone('utc',now()) where user_id=p_user_id;
    insert into private.security_block_rules(subject_type,user_id,source_user_id,reason,fraud_flag,expires_at,created_by) values('user',p_user_id,p_user_id,reason_value,p_fraud_flag,p_expires_at,caller_id);
    rule_count:=rule_count+1;
    if p_block_known_ips then
      for ctx in select distinct ip_address from private.user_security_contexts where user_id=p_user_id and ip_address is not null loop
        if not exists(select 1 from private.security_block_rules r where r.subject_type='ip' and r.ip_network=host(ctx.ip_address)::cidr and r.active=true and (r.expires_at is null or r.expires_at>timezone('utc',now()))) then
          insert into private.security_block_rules(subject_type,ip_network,source_user_id,reason,fraud_flag,expires_at,created_by) values('ip',host(ctx.ip_address)::cidr,p_user_id,reason_value,p_fraud_flag,p_expires_at,caller_id); rule_count:=rule_count+1;
        end if;
      end loop;
    end if;
    if p_block_known_devices then
      for ctx in select distinct device_id from private.user_security_contexts where user_id=p_user_id and device_id is not null loop
        if not exists(select 1 from private.security_block_rules r where r.subject_type='device' and r.device_id=ctx.device_id and r.active=true and (r.expires_at is null or r.expires_at>timezone('utc',now()))) then
          insert into private.security_block_rules(subject_type,device_id,source_user_id,reason,fraud_flag,expires_at,created_by) values('device',ctx.device_id,p_user_id,reason_value,p_fraud_flag,p_expires_at,caller_id); rule_count:=rule_count+1;
        end if;
      end loop;
    end if;
    insert into private.account_enforcement_events(user_id,actor_user_id,action,reason,metadata) values(p_user_id,caller_id,'blocked',reason_value,jsonb_build_object('blockKnownIps',p_block_known_ips,'blockKnownDevices',p_block_known_devices,'fraudFlag',p_fraud_flag,'ruleCount',rule_count,'expiresAt',p_expires_at));
    if p_fraud_flag then insert into private.account_enforcement_events(user_id,actor_user_id,action,reason,metadata) values(p_user_id,caller_id,'fraud_flagged',reason_value,jsonb_build_object('ruleCount',rule_count)); end if;
  elsif action_value='unblock' then
    update public.profiles set status='active',deleted_at=null where id=p_user_id;
    update private.security_block_rules set active=false,revoked_by=caller_id,revoked_at=timezone('utc',now()) where source_user_id=p_user_id and active=true;
    insert into private.account_enforcement_events(user_id,actor_user_id,action,reason,metadata) values(p_user_id,caller_id,'unblocked',reason_value,jsonb_build_object('producerRequiresSeparateReactivation',true));
  else
    if target_super then raise exception 'super_admin_account_cannot_be_closed_here' using errcode='42501'; end if;
    update public.profiles set status='deleted',deleted_at=timezone('utc',now()),marketing_consent=false,marketing_consent_at=null where id=p_user_id;
    update public.producers set status='closed',trust_badge_status=case when trust_badge_status='active' then 'revoked' else trust_badge_status end,trust_badge_revoked_at=case when trust_badge_status='active' then timezone('utc',now()) else trust_badge_revoked_at end,trust_badge_reason='Hesap kalıcı olarak kapatıldı: '||reason_value,updated_at=timezone('utc',now()) where owner_user_id=p_user_id and deleted_at is null returning * into producer;
    if producer.id is not null then
      update public.products set status='archived',is_active=false,updated_at=timezone('utc',now()) where producer_id=producer.id and deleted_at is null and status<>'archived';
      update public.product_change_requests set status='withdrawn',updated_at=timezone('utc',now()) where producer_id=producer.id and status='pending';
    end if;
    delete from private.user_roles where user_id=p_user_id and role<>'customer';
    update private.device_push_tokens set disabled_at=coalesce(disabled_at,timezone('utc',now())),updated_at=timezone('utc',now()) where user_id=p_user_id;
    insert into private.security_block_rules(subject_type,user_id,source_user_id,reason,fraud_flag,created_by) values('user',p_user_id,p_user_id,reason_value,p_fraud_flag,caller_id);
    if p_block_known_ips then for ctx in select distinct ip_address from private.user_security_contexts where user_id=p_user_id and ip_address is not null loop insert into private.security_block_rules(subject_type,ip_network,source_user_id,reason,fraud_flag,created_by) values('ip',host(ctx.ip_address)::cidr,p_user_id,reason_value,p_fraud_flag,caller_id); end loop; end if;
    if p_block_known_devices then for ctx in select distinct device_id from private.user_security_contexts where user_id=p_user_id and device_id is not null loop insert into private.security_block_rules(subject_type,device_id,source_user_id,reason,fraud_flag,created_by) values('device',ctx.device_id,p_user_id,reason_value,p_fraud_flag,caller_id); end loop; end if;
    insert into private.account_enforcement_events(user_id,actor_user_id,action,reason,metadata) values(p_user_id,caller_id,'closed',reason_value,jsonb_build_object('fraudFlag',p_fraud_flag,'blockKnownIps',p_block_known_ips,'blockKnownDevices',p_block_known_devices));
  end if;
  return jsonb_build_object('id',p_user_id,'action',action_value,'status',(select status from public.profiles where id=p_user_id),'producerStatus',(select status from public.producers where owner_user_id=p_user_id and deleted_at is null limit 1),'securityRuleCount',(select count(*) from private.security_block_rules where source_user_id=p_user_id and active=true),'fraudFlag',exists(select 1 from private.security_block_rules where source_user_id=p_user_id and active=true and fraud_flag=true));
end;
$$;

create or replace function public.admin_enforce_platform_user_v1(p_user_id uuid,p_action text,p_reason text,p_block_known_ips boolean default false,p_block_known_devices boolean default false,p_fraud_flag boolean default false,p_expires_at timestamptz default null)
returns jsonb language sql set search_path='' as $$select private.admin_enforce_platform_user_v1(p_user_id,p_action,p_reason,p_block_known_ips,p_block_known_devices,p_fraud_flag,p_expires_at);$$;
revoke all on function public.admin_enforce_platform_user_v1(uuid,text,text,boolean,boolean,boolean,timestamptz) from public,anon;
grant execute on function public.admin_enforce_platform_user_v1(uuid,text,text,boolean,boolean,boolean,timestamptz) to authenticated;
