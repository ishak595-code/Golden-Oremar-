create or replace function private.admin_list_producers_v2()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $function$
declare base jsonb; result jsonb; reveal_commission boolean;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  reveal_commission:=coalesce(private.has_role('super_admin'),false);
  base:=private.admin_list_producers_v1();
  select coalesce(jsonb_agg((item-'commission_basis_points')||jsonb_build_object(
    'commission_basis_points',case when reveal_commission then p.commission_basis_points else null end,
    'activity_types',p.activity_types,
    'approved_category_slugs',p.approved_category_slugs,
    'trust_badge_status',p.trust_badge_status,
    'trust_badge_active',private.is_producer_trust_badge_active_v1(p.id),
    'trust_badge_granted_at',p.trust_badge_granted_at,
    'trust_badge_review_due_at',p.trust_badge_review_due_at,
    'trust_badge_revoked_at',p.trust_badge_revoked_at,
    'trust_badge_reason',p.trust_badge_reason
  ) order by ordinality),'[]'::jsonb) into result
  from jsonb_array_elements(base) with ordinality rows(item,ordinality)
  join public.producers p on p.id=(item->>'id')::uuid;
  return result;
end;
$function$;

create or replace function private.admin_list_platform_users_v2()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); reveal_sensitive boolean;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  reveal_sensitive:=coalesce(private.has_role('super_admin'),false);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',coalesce(nullif(p.display_name,''),split_part(u.email,'@',1),'Kullanıcı'),'email',coalesce(u.email,''),
    'role',case when roles.has_super_admin then 'super_admin' when roles.has_admin then 'admin' when roles.has_producer then 'vendor' else 'user' end,
    'status',case when p.status='active' then 'active' when p.status='deleted' then 'deleted' else 'blocked' end,
    'profileStatus',p.status,'joinDate',p.created_at,'vendor_id',producer.id,'producerStatus',producer.status,
    'producerCommissionBasisPoints',case when reveal_sensitive then producer.commission_basis_points else null end,
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
$function$;
