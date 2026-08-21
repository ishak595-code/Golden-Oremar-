alter table public.producers add column if not exists storefront_tier text not null default 'standard';
alter table public.producers add column if not exists storefront_theme text not null default 'heritage';
alter table public.producers add column if not exists storefront_headline text;
alter table public.producers add column if not exists storefront_subheadline text;
alter table public.producers add column if not exists launch_audience_count bigint not null default 0;
alter table public.producers add column if not exists launch_audience_label text not null default 'Lansman topluluğu';

alter table public.producers drop constraint if exists producers_storefront_tier_check;
alter table public.producers add constraint producers_storefront_tier_check check (storefront_tier in ('standard','verified','signature'));
alter table public.producers drop constraint if exists producers_storefront_theme_check;
alter table public.producers add constraint producers_storefront_theme_check check (storefront_theme in ('heritage','emerald','midnight','ivory'));
alter table public.producers drop constraint if exists producers_storefront_headline_check;
alter table public.producers add constraint producers_storefront_headline_check check (storefront_headline is null or char_length(storefront_headline) between 2 and 140);
alter table public.producers drop constraint if exists producers_storefront_subheadline_check;
alter table public.producers add constraint producers_storefront_subheadline_check check (storefront_subheadline is null or char_length(storefront_subheadline) between 2 and 320);
alter table public.producers drop constraint if exists producers_launch_audience_count_check;
alter table public.producers add constraint producers_launch_audience_count_check check (launch_audience_count between 0 and 1000000000);
alter table public.producers drop constraint if exists producers_launch_audience_label_check;
alter table public.producers add constraint producers_launch_audience_label_check check (char_length(launch_audience_label) between 2 and 60);

update public.producers
set storefront_tier='signature',storefront_theme='emerald',
    storefront_headline='Zagros’un yüksek yaylalarından seçilmiş köy ürünleri',
    storefront_subheadline='Golden Oremar Resmi Mağazası - Yeşiltaş ve Dağlıca kökenli ürünlerde doğrulanabilir menşe, gerçek stok ve izlenebilirlik.',
    launch_audience_label='Lansman topluluğu',updated_at=timezone('utc',now())
where store_kind='official' and slug='golden-oremar' and deleted_at is null;

update public.producers
set storefront_tier='verified',storefront_theme='heritage',updated_at=timezone('utc',now())
where store_kind='independent' and status='active' and is_verified=true and deleted_at is null and storefront_tier='standard';

create or replace function private.get_public_producer_profile_v4(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  base jsonb:=private.get_public_producer_profile_v3(p_reference);
  producer_id uuid;
  producer_row public.producers%rowtype;
  badge_active boolean;
  badges jsonb;
  categories jsonb;
  real_followers bigint:=0;
begin
  begin producer_id:=(base->>'id')::uuid; exception when others then raise exception 'producer_profile_invalid' using errcode='55000'; end;
  select * into producer_row from public.producers p where p.id=producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
  if producer_row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  badge_active:=private.is_producer_trust_badge_active_v1(producer_id);
  select count(*)::bigint into real_followers from private.producer_follows f where f.producer_id=producer_id;

  if producer_row.store_kind='official' then
    badges:=jsonb_build_array(
      jsonb_build_object('key','official_store','label','Golden Oremar Resmi Mağazası','active',true,'tone','emerald'),
      jsonb_build_object('key','verified_origin','label','Menşe doğrulandı','active',producer_row.origin_verified,'tone','emerald')
    );
  else
    badges:=jsonb_build_array(
      jsonb_build_object('key','verified_producer','label','Golden Oremar Doğrulanmış Üretici','active',badge_active,'tone','blue'),
      jsonb_build_object('key','verified_origin','label','Menşe ve üretim yeri doğrulandı','active',producer_row.origin_verified and badge_active,'tone','blue')
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('slug',x.slug,'name',x.name,'productCount',x.product_count) order by x.product_count desc,x.name),'[]'::jsonb)
  into categories
  from (
    select c.slug,c.name,count(*)::bigint product_count
    from public.products p join public.categories c on c.id=p.category_id
    where p.producer_id=producer_id and p.status='published' and p.is_active=true and p.deleted_at is null and c.is_active=true
    group by c.slug,c.name
    order by count(*) desc,c.name
    limit 16
  ) x;

  return (base-'badges') || jsonb_build_object(
    'store_kind',producer_row.store_kind,
    'storefront_tier',producer_row.storefront_tier,
    'storefront_theme',producer_row.storefront_theme,
    'storefront_headline',producer_row.storefront_headline,
    'storefront_subheadline',producer_row.storefront_subheadline,
    'badges',badges,
    'categories',categories,
    'follower_count',real_followers,
    'social_proof',jsonb_build_object(
      'realFollowerCount',real_followers,
      'launchAudience',jsonb_build_object('count',producer_row.launch_audience_count,'label',producer_row.launch_audience_label,'kind','promotional_audience')
    )
  );
end;
$$;

create or replace function public.get_public_producer_profile_v3(p_reference text)
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_producer_profile_v4(p_reference); $$;

create or replace function private.super_admin_list_storefronts_v1()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.display_name,'slug',p.slug,'storeKind',p.store_kind,'status',p.status,'verified',p.is_verified,
    'tier',p.storefront_tier,'theme',p.storefront_theme,'headline',p.storefront_headline,'subheadline',p.storefront_subheadline,
    'realFollowerCount',(select count(*)::bigint from private.producer_follows f where f.producer_id=p.id),
    'launchAudienceCount',p.launch_audience_count,'launchAudienceLabel',p.launch_audience_label,
    'logoPath',private.verified_public_storage_path_v1('catalog-public',p.logo_path),
    'coverPath',private.verified_public_storage_path_v1('catalog-public',p.cover_path),
    'logoReady',private.verified_public_storage_path_v1('catalog-public',p.logo_path) is not null,
    'coverReady',private.verified_public_storage_path_v1('catalog-public',p.cover_path) is not null,
    'location',p.production_location
  ) order by case when p.store_kind='official' then 0 else 1 end,p.display_name),'[]'::jsonb) into result
  from public.producers p
  where p.deleted_at is null and p.status in ('active','suspended') and (p.store_kind='official' or p.owner_user_id is not null);
  return result;
end;
$$;

create or replace function public.super_admin_list_storefronts_v1()
returns jsonb language sql stable set search_path to '' as $$ select private.super_admin_list_storefronts_v1(); $$;
revoke all on function public.super_admin_list_storefronts_v1() from public,anon;
grant execute on function public.super_admin_list_storefronts_v1() to authenticated;

create or replace function private.super_admin_update_storefront_presentation_v1(
  p_producer_id uuid,p_launch_audience_count bigint,p_launch_audience_label text,p_storefront_tier text,p_storefront_theme text,p_headline text,p_subheadline text
)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); row public.producers%rowtype; label_value text:=btrim(coalesce(p_launch_audience_label,'')); headline_value text:=nullif(btrim(coalesce(p_headline,'')),''); subheadline_value text:=nullif(btrim(coalesce(p_subheadline,'')),'');
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_producer_id is null then raise exception 'producer_required' using errcode='22023'; end if;
  if p_launch_audience_count is null or p_launch_audience_count<0 or p_launch_audience_count>1000000000 then raise exception 'invalid_launch_audience_count' using errcode='22023'; end if;
  if char_length(label_value) not between 2 and 60 then raise exception 'invalid_launch_audience_label' using errcode='22023'; end if;
  if p_storefront_tier not in ('standard','verified','signature') then raise exception 'invalid_storefront_tier' using errcode='22023'; end if;
  if p_storefront_theme not in ('heritage','emerald','midnight','ivory') then raise exception 'invalid_storefront_theme' using errcode='22023'; end if;
  if headline_value is not null and char_length(headline_value) not between 2 and 140 then raise exception 'invalid_storefront_headline' using errcode='22023'; end if;
  if subheadline_value is not null and char_length(subheadline_value) not between 2 and 320 then raise exception 'invalid_storefront_subheadline' using errcode='22023'; end if;
  update public.producers set launch_audience_count=p_launch_audience_count,launch_audience_label=label_value,storefront_tier=p_storefront_tier,storefront_theme=p_storefront_theme,storefront_headline=headline_value,storefront_subheadline=subheadline_value,updated_at=timezone('utc',now())
  where id=p_producer_id and deleted_at is null returning * into row;
  if row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'storefront.presentation_updated','producer',row.id::text,jsonb_build_object('storeKind',row.store_kind,'tier',row.storefront_tier,'theme',row.storefront_theme,'launchAudienceCount',row.launch_audience_count,'launchAudienceLabel',row.launch_audience_label));
  return jsonb_build_object('id',row.id,'tier',row.storefront_tier,'theme',row.storefront_theme,'launchAudienceCount',row.launch_audience_count,'launchAudienceLabel',row.launch_audience_label,'headline',row.storefront_headline,'subheadline',row.storefront_subheadline,'updatedAt',row.updated_at);
end;
$$;

create or replace function public.super_admin_update_storefront_presentation_v1(p_producer_id uuid,p_launch_audience_count bigint,p_launch_audience_label text,p_storefront_tier text,p_storefront_theme text,p_headline text,p_subheadline text)
returns jsonb language sql set search_path to '' as $$ select private.super_admin_update_storefront_presentation_v1(p_producer_id,p_launch_audience_count,p_launch_audience_label,p_storefront_tier,p_storefront_theme,p_headline,p_subheadline); $$;
revoke all on function public.super_admin_update_storefront_presentation_v1(uuid,bigint,text,text,text,text,text) from public,anon;
grant execute on function public.super_admin_update_storefront_presentation_v1(uuid,bigint,text,text,text,text,text) to authenticated;

create or replace function private.super_admin_update_storefront_media_v1(p_producer_id uuid,p_logo_path text,p_cover_path text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); logo_value text:=nullif(btrim(coalesce(p_logo_path,'')),''); cover_value text:=nullif(btrim(coalesce(p_cover_path,'')),''); row public.producers%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_producer_id is null then raise exception 'producer_required' using errcode='22023'; end if;
  if logo_value is not null and private.verified_public_storage_path_v1('catalog-public',logo_value) is null then raise exception 'storefront_logo_storage_object_required' using errcode='55000'; end if;
  if cover_value is not null and private.verified_public_storage_path_v1('catalog-public',cover_value) is null then raise exception 'storefront_cover_storage_object_required' using errcode='55000'; end if;
  update public.producers set logo_path=logo_value,cover_path=cover_value,updated_at=timezone('utc',now()) where id=p_producer_id and deleted_at is null returning * into row;
  if row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'storefront.media_updated','producer',row.id::text,jsonb_build_object('logoConfigured',logo_value is not null,'coverConfigured',cover_value is not null));
  return jsonb_build_object('id',row.id,'logoPath',row.logo_path,'coverPath',row.cover_path,'updatedAt',row.updated_at);
end;
$$;

create or replace function public.super_admin_update_storefront_media_v1(p_producer_id uuid,p_logo_path text,p_cover_path text)
returns jsonb language sql set search_path to '' as $$ select private.super_admin_update_storefront_media_v1(p_producer_id,p_logo_path,p_cover_path); $$;
revoke all on function public.super_admin_update_storefront_media_v1(uuid,text,text) from public,anon;
grant execute on function public.super_admin_update_storefront_media_v1(uuid,text,text) to authenticated;
