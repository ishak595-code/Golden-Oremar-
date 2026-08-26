create or replace function private.ci_orphan_catalog_media_cleanup_candidates_for_service_v1()
returns text[]
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(array_agg(o.name order by o.name),'{}'::text[])
  from storage.objects o
  where o.bucket_id='catalog-public'
    and coalesce(o.is_delete_marker,false)=false
    and o.archived_at is null
    and o.name ~ '^admin/[0-9a-f-]{36}/official-products/[0-9a-f-]{36}\\.(png|jpe?g|webp|avif)$'
    and o.owner_id is not null
    and not exists(select 1 from auth.users u where u.id::text=o.owner_id)
    and not exists(select 1 from public.product_images pi where private.verified_public_storage_path_v1('catalog-public',pi.storage_path)=o.name);
$$;
revoke all on function private.ci_orphan_catalog_media_cleanup_candidates_for_service_v1() from public,anon,authenticated;
grant execute on function private.ci_orphan_catalog_media_cleanup_candidates_for_service_v1() to service_role;
