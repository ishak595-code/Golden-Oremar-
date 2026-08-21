drop policy if exists storage_catalog_insert_producer on storage.objects;
drop policy if exists storage_catalog_delete_producer on storage.objects;
drop policy if exists storage_catalog_update_producer on storage.objects;

create policy storage_catalog_insert_verified_producer_v2
on storage.objects
for insert
to authenticated
with check (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='products'
  and exists(
    select 1
    from public.producers producer
    where producer.id::text=(storage.foldername(name))[1]
      and producer.owner_user_id=(select auth.uid())
      and producer.status='active'
      and producer.is_verified=true
      and producer.deleted_at is null
  )
);

create policy storage_catalog_delete_verified_producer_unreferenced_v2
on storage.objects
for delete
to authenticated
using (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='products'
  and exists(
    select 1
    from public.producers producer
    where producer.id::text=(storage.foldername(name))[1]
      and producer.owner_user_id=(select auth.uid())
      and producer.status='active'
      and producer.is_verified=true
      and producer.deleted_at is null
  )
  and not exists(
    select 1
    from public.product_images image
    where image.storage_path=storage.objects.name
  )
);
