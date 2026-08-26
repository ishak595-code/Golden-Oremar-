alter table public.producers add column if not exists store_number text;

create sequence if not exists private.store_number_seq as bigint minvalue 1 start 1;
revoke all on sequence private.store_number_seq from public, anon, authenticated;

create or replace function private.assign_store_number_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='INSERT' then
    new.store_number:='GO-STORE-'||lpad(nextval('private.store_number_seq'::regclass)::text,8,'0');
  elsif new.store_number is distinct from old.store_number then
    raise exception 'store_number_immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.assign_store_number_v1() from public, anon, authenticated;

DO $$
declare r record;
begin
  for r in select id from public.producers where store_number is null order by created_at,id loop
    update public.producers
    set store_number='GO-STORE-'||lpad(nextval('private.store_number_seq'::regclass)::text,8,'0')
    where id=r.id;
  end loop;
end $$;

alter table public.producers alter column store_number set not null;
alter table public.producers drop constraint if exists producers_store_number_check;
alter table public.producers add constraint producers_store_number_check check (store_number ~ '^GO-STORE-[0-9]{8}$');
create unique index if not exists producers_store_number_key on public.producers(store_number);

drop trigger if exists producers_assign_store_number_v1 on public.producers;
create trigger producers_assign_store_number_v1
before insert or update of store_number on public.producers
for each row execute function private.assign_store_number_v1();

insert into private.permissions(permission_key,domain,description,is_active)
values('storefront.lifecycle_manage','storefront','Mağaza yaşam döngüsünü açma, engelleme, kapatma ve güvenli arşivleme yetkisi.',true)
on conflict(permission_key) do update set domain=excluded.domain,description=excluded.description,is_active=true,updated_at=timezone('utc',now());

delete from private.role_permissions where permission_key='storefront.lifecycle_manage';
insert into private.role_permissions(role,permission_key)
values('super_admin','storefront.lifecycle_manage');

create or replace function private.super_admin_store_directory_v1(
  p_query text default null,
  p_state text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  q text:=lower(btrim(coalesce(p_query,'')));
  state_value text:=lower(btrim(coalesce(p_state,'all')));
  result jsonb;
begin
  if auth.uid() is null or not coalesce(private.has_permission('storefront.lifecycle_manage'),false) then
    raise exception 'permission_required:storefront.lifecycle_manage' using errcode='42501';
  end if;
  if char_length(q)>160 then raise exception 'store_search_query_too_long' using errcode='22023'; end if;
  if state_value not in ('all','open','setup','blocked','closed','archived') then raise exception 'invalid_store_state_filter' using errcode='22023'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;

  with all_stores as (
    select p.*,
      case
        when p.deleted_at is not null then 'archived'
        when p.status='active' and p.storefront_status='published' then 'open'
        when p.status='suspended' then 'blocked'
        when p.status='closed' then 'closed'
        else 'setup'
      end lifecycle_state,
      (select count(*)::bigint from public.products product where product.producer_id=p.id and product.deleted_at is null) product_count,
      (select count(*)::bigint from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null) published_product_count,
      (select count(distinct item.order_id)::bigint from public.order_items item where item.producer_id=p.id) order_count
    from public.producers p
  ), filtered as (
    select * from all_stores s
    where (state_value='all' or s.lifecycle_state=state_value)
      and (
        q='' or lower(s.store_number)=q or lower(s.id::text)=q or lower(s.slug)=q
        or lower(s.display_name) like '%'||q||'%'
        or lower(coalesce(s.storefront_contact_email,'')) like '%'||q||'%'
        or lower(coalesce(s.storefront_contact_phone,'')) like '%'||q||'%'
      )
  ), page as (
    select * from filtered
    order by case when store_kind='official' then 0 else 1 end,
             case lifecycle_state when 'open' then 0 when 'setup' then 1 when 'blocked' then 2 when 'closed' then 3 else 4 end,
             updated_at desc,id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'totalStores',(select count(*)::bigint from all_stores),
      'openStores',(select count(*)::bigint from all_stores where lifecycle_state='open'),
      'setupPending',(select count(*)::bigint from all_stores where lifecycle_state='setup'),
      'blockedStores',(select count(*)::bigint from all_stores where lifecycle_state='blocked'),
      'closedStores',(select count(*)::bigint from all_stores where lifecycle_state='closed'),
      'archivedStores',(select count(*)::bigint from all_stores where lifecycle_state='archived'),
      'officialStores',(select count(*)::bigint from all_stores where store_kind='official'),
      'independentStores',(select count(*)::bigint from all_stores where store_kind='independent'),
      'totalProducts',(select coalesce(sum(product_count),0)::bigint from all_stores),
      'publishedProducts',(select coalesce(sum(published_product_count),0)::bigint from all_stores),
      'totalOrders',(select coalesce(sum(order_count),0)::bigint from all_stores)
    ),
    'total',(select count(*)::bigint from filtered),
    'limit',p_limit,
    'offset',p_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'storeNumber',store_number,'slug',slug,'name',display_name,'storeKind',store_kind,
      'producerStatus',status,'storefrontStatus',storefront_status,'state',lifecycle_state,
      'verified',is_verified,'originVerified',origin_verified,
      'contactEmail',storefront_contact_email,'contactPhone',storefront_contact_phone,
      'location',coalesce(nullif(concat_ws(', ',nullif(storefront_city,''),nullif(storefront_region,''),nullif(storefront_country_code,'')),''),production_location),
      'productCount',product_count,'publishedProductCount',published_product_count,'orderCount',order_count,
      'updatedAt',updated_at,'createdAt',created_at,'archivedAt',deleted_at
    ) order by case when store_kind='official' then 0 else 1 end,updated_at desc,id) from page),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function private.super_admin_store_directory_v1(text,text,integer,integer) from public, anon, authenticated;

create or replace function public.super_admin_store_directory_v1(
  p_query text default null,
  p_state text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
stable
set search_path=''
as $$ select private.super_admin_store_directory_v1(p_query,p_state,p_limit,p_offset); $$;
revoke all on function public.super_admin_store_directory_v1(text,text,integer,integer) from public, anon;
grant execute on function public.super_admin_store_directory_v1(text,text,integer,integer) to authenticated;

create or replace function private.super_admin_store_detail_v1(p_store_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  ref text:=btrim(coalesce(p_store_reference,''));
  p public.producers%rowtype;
  readiness jsonb;
  application jsonb:=null;
begin
  if auth.uid() is null or not coalesce(private.has_permission('storefront.lifecycle_manage'),false) then
    raise exception 'permission_required:storefront.lifecycle_manage' using errcode='42501';
  end if;
  if char_length(ref) not between 1 and 220 then raise exception 'invalid_store_reference' using errcode='22023'; end if;
  select * into p from public.producers x
  where lower(x.store_number)=lower(ref) or lower(x.slug)=lower(ref) or x.id::text=lower(ref)
  order by case when lower(x.store_number)=lower(ref) then 0 when x.id::text=lower(ref) then 1 else 2 end
  limit 1;
  if p.id is null then raise exception 'store_not_found' using errcode='P0002'; end if;
  readiness:=case when p.deleted_at is null then private.storefront_readiness_v1(p.id) else jsonb_build_object('ready',false,'missing',jsonb_build_array('store_archived'),'steps','[]'::jsonb) end;
  if p.application_id is not null then
    select jsonb_build_object('id',a.id,'status',a.status,'sellerClassification',a.seller_classification,'foodComplianceStatus',a.food_compliance_status,'submittedAt',a.submitted_at,'reviewedAt',a.reviewed_at)
      into application from public.producer_applications a where a.id=p.application_id;
  end if;
  return jsonb_build_object(
    'id',p.id,'storeNumber',p.store_number,'slug',p.slug,'name',p.display_name,'description',p.description,'story',p.story,
    'storeKind',p.store_kind,'producerStatus',p.status,'storefrontStatus',p.storefront_status,'publishedAt',p.storefront_published_at,
    'verified',p.is_verified,'originVerified',p.origin_verified,'trustBadgeActive',case when p.store_kind='official' then true else coalesce(private.is_producer_trust_badge_active_v1(p.id),false) end,
    'logoPath',private.verified_public_storage_path_v1('catalog-public',p.logo_path),'coverPath',private.verified_public_storage_path_v1('catalog-public',p.cover_path),
    'contact',jsonb_build_object('email',p.storefront_contact_email,'phone',p.storefront_contact_phone,'website',p.storefront_website),
    'address',jsonb_build_object('line1',p.storefront_address_line1,'line2',p.storefront_address_line2,'postalCode',p.storefront_postal_code,'city',p.storefront_city,'region',p.storefront_region,'countryCode',p.storefront_country_code,'visibility',p.storefront_address_visibility),
    'business',jsonb_build_object('type',p.storefront_business_identity_type,'name',p.storefront_business_name,'reference',p.storefront_business_reference,'verifiedAt',p.storefront_business_verified_at),
    'readiness',readiness,'application',application,
    'metrics',jsonb_build_object(
      'products',(select count(*)::bigint from public.products product where product.producer_id=p.id and product.deleted_at is null),
      'publishedProducts',(select count(*)::bigint from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null),
      'orders',(select count(distinct item.order_id)::bigint from public.order_items item where item.producer_id=p.id),
      'customers',(select count(distinct o.user_id)::bigint from public.order_items item join public.orders o on o.id=item.order_id where item.producer_id=p.id and o.status not in ('draft','cancelled')),
      'followers',(select count(*)::bigint from private.producer_follows f where f.producer_id=p.id)
    ),
    'createdAt',p.created_at,'updatedAt',p.updated_at,'archivedAt',p.deleted_at,
    'officialProtected',p.store_kind='official'
  );
end;
$$;
revoke all on function private.super_admin_store_detail_v1(text) from public, anon, authenticated;

create or replace function public.super_admin_store_detail_v1(p_store_reference text)
returns jsonb
language sql
stable
set search_path=''
as $$ select private.super_admin_store_detail_v1(p_store_reference); $$;
revoke all on function public.super_admin_store_detail_v1(text) from public, anon;
grant execute on function public.super_admin_store_detail_v1(text) to authenticated;

create or replace function private.super_admin_set_store_state_v1(p_store_reference text,p_action text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  ref text:=btrim(coalesce(p_store_reference,''));
  action_value text:=lower(btrim(coalesce(p_action,'')));
  reason_value text:=btrim(coalesce(p_reason,''));
  p public.producers%rowtype;
  readiness jsonb;
  before_status text;
  before_deleted_at timestamptz;
begin
  if caller_id is null or not coalesce(private.has_permission('storefront.lifecycle_manage'),false) then
    raise exception 'permission_required:storefront.lifecycle_manage' using errcode='42501';
  end if;
  if char_length(ref) not between 1 and 220 then raise exception 'invalid_store_reference' using errcode='22023'; end if;
  if action_value not in ('open','block','close','archive','restore') then raise exception 'invalid_store_lifecycle_action' using errcode='22023'; end if;
  if action_value in ('block','close','archive') and char_length(reason_value) not between 10 and 1000 then raise exception 'store_lifecycle_reason_required' using errcode='22023'; end if;

  select * into p from public.producers x
  where lower(x.store_number)=lower(ref) or lower(x.slug)=lower(ref) or x.id::text=lower(ref)
  order by case when lower(x.store_number)=lower(ref) then 0 when x.id::text=lower(ref) then 1 else 2 end
  limit 1 for update;
  if p.id is null then raise exception 'store_not_found' using errcode='P0002'; end if;
  if p.store_kind='official' then raise exception 'official_store_state_protected' using errcode='42501'; end if;
  before_status:=p.status; before_deleted_at:=p.deleted_at;

  if action_value='open' then
    if p.deleted_at is not null then raise exception 'store_restore_required' using errcode='55000'; end if;
    if p.storefront_status<>'published' then raise exception 'storefront_publish_required' using errcode='55000'; end if;
    readiness:=private.storefront_readiness_v1(p.id);
    if not coalesce((readiness->>'ready')::boolean,false) then raise exception 'storefront_readiness_required' using errcode='55000'; end if;
    if not p.is_verified or not p.origin_verified then raise exception 'store_verification_required' using errcode='55000'; end if;
    if not coalesce(private.is_producer_trust_badge_active_v1(p.id),false) then raise exception 'active_producer_trust_badge_required' using errcode='55000'; end if;
    update public.producers set status='active',updated_at=timezone('utc',now()) where id=p.id;
  elsif action_value='block' then
    if p.deleted_at is not null then raise exception 'store_archived' using errcode='55000'; end if;
    update public.producers set status='suspended',
      trust_badge_status=case when trust_badge_status='active' then 'revoked' else trust_badge_status end,
      trust_badge_revoked_at=case when trust_badge_status='active' then timezone('utc',now()) else trust_badge_revoked_at end,
      trust_badge_reason=case when trust_badge_status='active' then 'Mağaza Super Admin tarafından engellendi: '||reason_value else trust_badge_reason end,
      updated_at=timezone('utc',now()) where id=p.id;
    if p.trust_badge_status='active' then
      insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
      values(p.id,caller_id,'auto_revoked','Mağaza Super Admin tarafından engellendi: '||reason_value,p.trust_badge_review_due_at);
    end if;
  elsif action_value='close' then
    if p.deleted_at is not null then raise exception 'store_archived' using errcode='55000'; end if;
    update public.producers set status='closed',updated_at=timezone('utc',now()) where id=p.id;
  elsif action_value='archive' then
    if p.deleted_at is not null then raise exception 'store_already_archived' using errcode='55000'; end if;
    update public.producers set status='closed',deleted_at=timezone('utc',now()),
      trust_badge_status=case when trust_badge_status='active' then 'revoked' else trust_badge_status end,
      trust_badge_revoked_at=case when trust_badge_status='active' then timezone('utc',now()) else trust_badge_revoked_at end,
      trust_badge_reason=case when trust_badge_status='active' then 'Mağaza güvenli arşive alındı: '||reason_value else trust_badge_reason end,
      updated_at=timezone('utc',now()) where id=p.id;
    if p.trust_badge_status='active' then
      insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
      values(p.id,caller_id,'auto_revoked','Mağaza güvenli arşive alındı: '||reason_value,p.trust_badge_review_due_at);
    end if;
  else
    if p.deleted_at is null then raise exception 'store_not_archived' using errcode='55000'; end if;
    update public.producers set deleted_at=null,status='pending',updated_at=timezone('utc',now()) where id=p.id;
  end if;

  if p.owner_user_id is not null then
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(p.owner_user_id,'producer',
      case action_value when 'open' then 'Mağazanız yeniden açıldı' when 'block' then 'Mağazanız engellendi' when 'close' then 'Mağazanız kapatıldı' when 'archive' then 'Mağazanız arşive alındı' else 'Mağazanız arşivden çıkarıldı' end,
      case when reason_value<>'' then reason_value else 'Mağaza durumunuz Golden Oremar yönetimi tarafından güncellendi.' end,
      '/?tab=account',jsonb_build_object('producer_id',p.id,'store_number',p.store_number,'action',action_value));
  end if;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'storefront.lifecycle.'||action_value,'producer',p.id::text,jsonb_build_object(
    'storeNumber',p.store_number,'reason',nullif(reason_value,''),'beforeStatus',before_status,'beforeArchivedAt',before_deleted_at
  ));

  select * into p from public.producers where id=p.id;
  return jsonb_build_object('ok',true,'id',p.id,'storeNumber',p.store_number,'status',p.status,'storefrontStatus',p.storefront_status,'archivedAt',p.deleted_at,'action',action_value);
end;
$$;
revoke all on function private.super_admin_set_store_state_v1(text,text,text) from public, anon, authenticated;

create or replace function public.super_admin_set_store_state_v1(p_store_reference text,p_action text,p_reason text default null)
returns jsonb
language sql
set search_path=''
as $$ select private.super_admin_set_store_state_v1(p_store_reference,p_action,p_reason); $$;
revoke all on function public.super_admin_set_store_state_v1(text,text,text) from public, anon;
grant execute on function public.super_admin_set_store_state_v1(text,text,text) to authenticated;

-- Retire the legacy cross-store media write path. Official branding now uses the shared binary-verified store branding API.
create or replace function private.super_admin_update_storefront_media_v1(p_producer_id uuid,p_logo_path text,p_cover_path text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not coalesce(private.has_permission('product.publish'),false) then raise exception 'permission_required:product.publish' using errcode='42501'; end if;
  if not exists(select 1 from public.producers p where p.id=p_producer_id and p.store_kind='official' and p.deleted_at is null) then raise exception 'official_store_only' using errcode='42501'; end if;
  raise exception 'storefront_media_legacy_retired' using errcode='55000';
end;
$$;

create or replace function private.super_admin_update_storefront_presentation_v1(p_producer_id uuid,p_launch_audience_count bigint,p_launch_audience_label text,p_storefront_tier text,p_storefront_theme text,p_headline text,p_subheadline text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid(); row public.producers%rowtype; label_value text:=btrim(coalesce(p_launch_audience_label,'')); headline_value text:=nullif(btrim(coalesce(p_headline,'')),''); subheadline_value text:=nullif(btrim(coalesce(p_subheadline,'')),'');
begin
  if caller_id is null or not coalesce(private.has_permission('product.publish'),false) then raise exception 'permission_required:product.publish' using errcode='42501'; end if;
  if p_launch_audience_count is null or p_launch_audience_count<0 or p_launch_audience_count>1000000000 then raise exception 'invalid_launch_audience_count' using errcode='22023'; end if;
  if char_length(label_value) not between 2 and 60 then raise exception 'invalid_launch_audience_label' using errcode='22023'; end if;
  if p_storefront_tier not in ('standard','verified','signature') then raise exception 'invalid_storefront_tier' using errcode='22023'; end if;
  if p_storefront_theme not in ('heritage','emerald','midnight','ivory') then raise exception 'invalid_storefront_theme' using errcode='22023'; end if;
  if headline_value is not null and char_length(headline_value) not between 2 and 140 then raise exception 'invalid_storefront_headline' using errcode='22023'; end if;
  if subheadline_value is not null and char_length(subheadline_value) not between 2 and 320 then raise exception 'invalid_storefront_subheadline' using errcode='22023'; end if;
  update public.producers set launch_audience_count=p_launch_audience_count,launch_audience_label=label_value,storefront_tier=p_storefront_tier,storefront_theme=p_storefront_theme,storefront_headline=headline_value,storefront_subheadline=subheadline_value,updated_at=timezone('utc',now())
  where id=p_producer_id and store_kind='official' and deleted_at is null returning * into row;
  if row.id is null then raise exception 'official_store_only' using errcode='42501'; end if;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'storefront.presentation_updated','producer',row.id::text,jsonb_build_object('storeKind',row.store_kind,'tier',row.storefront_tier,'theme',row.storefront_theme,'launchAudienceCount',row.launch_audience_count,'launchAudienceLabel',row.launch_audience_label));
  return jsonb_build_object('id',row.id,'tier',row.storefront_tier,'theme',row.storefront_theme,'launchAudienceCount',row.launch_audience_count,'launchAudienceLabel',row.launch_audience_label,'headline',row.storefront_headline,'subheadline',row.storefront_subheadline,'updatedAt',row.updated_at);
end;
$$;
