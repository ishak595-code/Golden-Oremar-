alter policy storage_catalog_brand_delete_owner_or_official_v1 on storage.objects
using (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='profile'
  and exists(
    select 1 from public.producers p
    where p.id::text=(storage.foldername(name))[1]
      and p.deleted_at is null
      and (
        (p.store_kind<>'official' and p.owner_user_id=(select auth.uid()))
        or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false))
      )
  )
  and not private.catalog_public_asset_is_referenced_v1(name)
);