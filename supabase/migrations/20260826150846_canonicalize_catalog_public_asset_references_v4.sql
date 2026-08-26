-- Keep catalog-media orphan detection scoped to truly unreferenced Storage
-- objects. Official storefront identity assets and any other canonical public
-- catalog references must never be reported as orphan product media.
create or replace function private.catalog_public_asset_is_referenced_v1(p_path text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  with target as (
    select private.verified_public_storage_path_v1('catalog-public',p_path) path
  )
  select coalesce((select path is not null and (
    exists(select 1 from public.product_images i where private.verified_public_storage_path_v1('catalog-public',i.storage_path)=target.path)
    or exists(select 1 from public.producers p where p.deleted_at is null and (
      private.verified_public_storage_path_v1('catalog-public',p.logo_path)=target.path
      or private.verified_public_storage_path_v1('catalog-public',p.cover_path)=target.path
    ))
    or exists(select 1 from public.categories c where private.verified_public_storage_path_v1('catalog-public',c.image_path)=target.path)
    or exists(select 1 from public.content_entries ce where ce.deleted_at is null and private.verified_public_storage_path_v1('catalog-public',ce.hero_image_path)=target.path)
    or exists(select 1 from public.events e where private.verified_public_storage_path_v1('catalog-public',e.image_path)=target.path)
    or exists(select 1 from public.order_items oi where private.verified_public_storage_path_v1('catalog-public',oi.image_path)=target.path)
  ) from target),false);
$function$;

revoke all on function private.catalog_public_asset_is_referenced_v1(text) from public,anon,authenticated;

create or replace function private.super_admin_catalog_media_health_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare result jsonb; begin
  if auth.uid() is null or not coalesce(private.has_permission('product.health_manage'),false) then raise exception 'permission_required:product.health_manage' using errcode='42501'; end if;
  with image_rows as (
    select i.id image_id,i.product_id,p.name product_name,i.storage_path,private.verified_public_storage_path_v1('catalog-public',i.storage_path) normalized_path,o.id object_id,o.metadata,
      case when private.verified_public_storage_path_v1('catalog-public',i.storage_path) is null then 'invalid_path' when o.id is null then 'missing_object' when lower(coalesce(o.metadata->>'mimetype','')) not in ('image/jpeg','image/png','image/webp','image/avif') then 'invalid_mime' when coalesce(o.metadata->>'size','') !~ '^[0-9]{1,12}$' or (o.metadata->>'size')::bigint not between 1 and 10485760 then 'invalid_size' when private.catalog_media_binary_verified_path_v2(i.storage_path) is null then 'unverified_binary' else 'healthy' end status
    from public.product_images i join public.products p on p.id=i.product_id left join storage.objects o on o.bucket_id='catalog-public' and o.name=private.verified_public_storage_path_v1('catalog-public',i.storage_path) and coalesce(o.is_delete_marker,false)=false and o.archived_at is null
  ), orphan_rows as (
    select null::uuid image_id,null::uuid product_id,null::text product_name,o.name storage_path,o.name normalized_path,o.id object_id,o.metadata,'orphan_object'::text status
    from storage.objects o
    where o.bucket_id='catalog-public'
      and coalesce(o.is_delete_marker,false)=false
      and o.archived_at is null
      and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif')
      and not private.catalog_public_asset_is_referenced_v1(o.name)
  ), all_rows as (select * from image_rows union all select * from orphan_rows), summary as (
    select count(*) filter(where status='healthy')::integer healthy,count(*) filter(where status='missing_object')::integer missing,count(*) filter(where status='orphan_object')::integer orphan,count(*) filter(where status in ('invalid_path','invalid_mime','invalid_size','unverified_binary'))::integer invalid,count(*)::integer total from all_rows
  )
  select jsonb_build_object('scannedAt',timezone('utc',now()),'lastScheduledScanAt',(select s.last_scanned_at from private.catalog_media_integrity_state_v2 s where s.singleton=true),'lastQuarantinedCount',coalesce((select s.last_quarantined_count from private.catalog_media_integrity_state_v2 s where s.singleton=true),0),'summary',jsonb_build_object('total',summary.total,'healthy',summary.healthy,'missing',summary.missing,'orphan',summary.orphan,'invalid',summary.invalid),'items',coalesce((select jsonb_agg(jsonb_build_object('status',r.status,'productId',r.product_id,'productName',r.product_name,'imageId',r.image_id,'path',r.storage_path) order by r.status,r.product_name nulls last,r.storage_path) from all_rows r where r.status<>'healthy'),'[]'::jsonb)) into result from summary;
  return result;
end;$function$;
