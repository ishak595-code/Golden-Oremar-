create or replace function private.super_admin_product_publish_readiness_v1(
  p_query text default null,
  p_state text default 'all',
  p_limit integer default 100,
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
  if auth.uid() is null or not coalesce(private.has_permission('product.health_manage'),false) then
    raise exception 'permission_required:product.health_manage' using errcode='42501';
  end if;
  if char_length(q)>120 then raise exception 'search_query_too_long' using errcode='22023'; end if;
  if p_limit not between 1 and 200 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  if state_value not in ('all','published','ready','missing_media','data_missing','media_blocked','owner_required') then raise exception 'invalid_readiness_state' using errcode='22023'; end if;

  with flags as (
    select p.id,p.name,p.slug,p.status,p.is_active,p.updated_at,pr.display_name producer_name,pr.store_kind,
      exists(select 1 from public.categories c where c.id=p.category_id and c.is_active=true) category_ok,
      exists(select 1 from public.product_variants v where v.product_id=p.id and v.is_active=true and v.price_minor>0) price_ok,
      char_length(btrim(coalesce(p.description,'')))>=20 description_ok,
      char_length(btrim(coalesce(p.story,'')))>=20 story_ok,
      exists(select 1 from public.content_entries e where e.related_product_id=p.id and e.content_type='product_health' and e.locale='tr' and e.status='published' and e.deleted_at is null) health_ok,
      coalesce(pp.origin_verified,false) origin_ok,
      (pr.id is not null and pr.status='active' and pr.is_verified=true and pr.deleted_at is null) producer_ok,
      (select count(*)::integer from public.product_images i where i.product_id=p.id) image_count,
      exists(select 1 from public.product_images i where i.product_id=p.id and i.is_primary=true) primary_image_row,
      exists(select 1 from public.product_images i where i.product_id=p.id and i.is_primary=true and private.verified_public_storage_path_v1('catalog-public',i.storage_path) is not null) primary_storage_ok,
      exists(select 1 from public.product_images i where i.product_id=p.id and i.is_primary=true and private.catalog_media_binary_verified_path_v2(i.storage_path) is not null) primary_binary_ok,
      private.product_media_integrity_ok_v1(p.id) media_ok
    from public.products p
    left join public.producers pr on pr.id=p.producer_id
    left join public.product_provenance pp on pp.product_id=p.id
    where p.deleted_at is null
  ), classified as (
    select f.*,
      (f.status='published' and f.is_active=true) published,
      (f.category_ok and f.price_ok and f.description_ok and f.story_ok and f.health_ok and f.origin_ok and f.producer_ok) mandatory_ok,
      (f.image_count=0 or not f.primary_storage_ok) missing_real_media,
      (not f.media_ok and f.image_count>0) media_blocked,
      (f.store_kind='official' and f.image_count=0 and f.media_ok) brand_fallback_allowed,
      f.media_ok media_ready,
      (f.status<>'published' or f.is_active=false) owner_required
    from flags f
  ), enriched as (
    select c.*,
      (not c.published and c.mandatory_ok and c.media_ready) ready,
      (not c.mandatory_ok) data_missing,
      coalesce((select jsonb_agg(jsonb_build_object('code',issue.code,'label',issue.label) order by issue.ord) from (
        select 10 ord,'primary_image_missing' code,'Primary image eksik' label
          where c.image_count=0 and not c.brand_fallback_allowed
        union all select 15,'primary_image_missing','Primary image eksik' where c.image_count>0 and not c.primary_image_row
        union all select 20,'storage_object_missing','Storage object bulunamadı' where c.primary_image_row and not c.primary_storage_ok
        union all select 30,'binary_verification_missing','Görsel binary doğrulaması eksik' where c.primary_storage_ok and not c.primary_binary_ok
        union all select 40,'media_integrity_failed','Media integrity kontrolü başarısız' where c.image_count>0 and c.primary_image_row and c.primary_storage_ok and c.primary_binary_ok and not c.media_ready
        union all select 50,'category_missing','Kategori eksik veya müşteriye kapalı' where not c.category_ok
        union all select 60,'price_missing','Aktif pozitif fiyatlı varyant eksik' where not c.price_ok
        union all select 70,'description_missing','Ürün açıklaması eksik veya yetersiz' where not c.description_ok
        union all select 80,'story_missing','Ürün hikayesi eksik veya yetersiz' where not c.story_ok
        union all select 90,'health_package_missing','Yayınlanmış Türkçe sağlık paketi eksik' where not c.health_ok
        union all select 100,'origin_not_verified','Ürün menşei doğrulanmamış' where not c.origin_ok
        union all select 110,'producer_not_ready','Üretici aktif ve doğrulanmış değil' where not c.producer_ok
      ) issue),'[]'::jsonb) reasons
    from classified c
  ), filtered as (
    select * from enriched e
    where (q='' or lower(e.name) like '%'||q||'%' or lower(e.slug) like '%'||q||'%' or lower(coalesce(e.producer_name,'')) like '%'||q||'%')
      and (state_value='all'
        or (state_value='published' and e.published)
        or (state_value='ready' and e.ready)
        or (state_value='missing_media' and e.missing_real_media)
        or (state_value='data_missing' and e.data_missing)
        or (state_value='media_blocked' and e.media_blocked)
        or (state_value='owner_required' and e.owner_required))
  ), page as (
    select * from filtered order by ready desc,missing_real_media desc,data_missing desc,name,id limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'scannedAt',timezone('utc',now()),
    'summary',jsonb_build_object(
      'total',(select count(*) from enriched),
      'published',(select count(*) from enriched where published),
      'readyToPublish',(select count(*) from enriched where ready),
      'missingRealMedia',(select count(*) from enriched where missing_real_media),
      'mandatoryDataMissing',(select count(*) from enriched where data_missing),
      'mediaBlocked',(select count(*) from enriched where media_blocked),
      'mediaReady',(select count(*) from enriched where media_ready),
      'brandFallbackAllowed',(select count(*) from enriched where brand_fallback_allowed),
      'ownerApprovalRequired',(select count(*) from enriched where owner_required)
    ),
    'filteredTotal',(select count(*) from filtered),
    'limit',p_limit,'offset',p_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'productId',id,'name',name,'slug',slug,'producerName',producer_name,'status',status,'active',is_active,
      'published',published,'readyToPublish',ready,'missingRealMedia',missing_real_media,'mandatoryDataMissing',data_missing,
      'mediaReady',media_ready,'brandFallbackAllowed',brand_fallback_allowed,'mediaBlocked',media_blocked,
      'ownerApprovalRequired',owner_required,'reasons',reasons,'updatedAt',updated_at
    ) order by ready desc,missing_real_media desc,data_missing desc,name,id) from page),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function private.super_admin_product_publish_readiness_v1(text,text,integer,integer) from public,anon;
grant execute on function private.super_admin_product_publish_readiness_v1(text,text,integer,integer) to authenticated,service_role;
