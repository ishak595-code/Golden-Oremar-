drop policy if exists storage_admin_public_assets_insert_v1 on storage.objects;
create policy storage_admin_public_assets_insert_v2
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('catalog-public','content-public')
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or coalesce((storage.foldername(name))[3],'')<>'official-products'
    or coalesce(private.has_permission('product.publish'),false)
  )
);

drop policy if exists storage_admin_public_assets_update_v2 on storage.objects;
create policy storage_admin_public_assets_update_v3
on storage.objects
for update
to authenticated
using (
  bucket_id in ('catalog-public','content-public')
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or coalesce((storage.foldername(name))[3],'')<>'official-products'
    or coalesce(private.has_permission('product.publish'),false)
  )
  and (
    bucket_id<>'catalog-public'
    or not exists(select 1 from public.product_images image where image.storage_path=storage.objects.name)
  )
)
with check (
  bucket_id in ('catalog-public','content-public')
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or coalesce((storage.foldername(name))[3],'')<>'official-products'
    or coalesce(private.has_permission('product.publish'),false)
  )
  and (
    bucket_id<>'catalog-public'
    or not exists(select 1 from public.product_images image where image.storage_path=storage.objects.name)
  )
);

drop policy if exists storage_admin_public_assets_delete_v2 on storage.objects;
create policy storage_admin_public_assets_delete_v3
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('catalog-public','content-public')
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or coalesce((storage.foldername(name))[3],'')<>'official-products'
    or coalesce(private.has_permission('product.publish'),false)
  )
  and (
    bucket_id<>'catalog-public'
    or not exists(select 1 from public.product_images image where image.storage_path=storage.objects.name)
  )
);
