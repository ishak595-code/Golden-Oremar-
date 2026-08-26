-- Keep the generic catalog reference helper private. Storage RLS gets one
-- narrowly scoped callable that binds caller authorization to the deletion
-- decision, avoiding a generic reference-oracle EXECUTE grant.

create or replace function private.can_delete_catalog_brand_asset_v1(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized text := private.verified_public_storage_path_v1('catalog-public', p_path);
  producer_id uuid;
begin
  if caller_id is null or normalized is null then
    return false;
  end if;

  if normalized !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/profile/(logo|cover)-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$' then
    return false;
  end if;

  begin
    producer_id := split_part(normalized, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if not exists (
    select 1
    from public.producers p
    where p.id = producer_id
      and p.deleted_at is null
      and (
        p.owner_user_id = caller_id
        or (
          p.store_kind = 'official'
          and coalesce(private.has_permission('product.publish'), false)
        )
      )
  ) then
    return false;
  end if;

  return not private.catalog_public_asset_is_referenced_v1(normalized);
end;
$$;

revoke all on function private.can_delete_catalog_brand_asset_v1(text) from public, anon, service_role;
grant execute on function private.can_delete_catalog_brand_asset_v1(text) to authenticated;

revoke all on function private.catalog_public_asset_is_referenced_v1(text) from public, anon, authenticated, service_role;

drop policy if exists storage_catalog_brand_delete_owner_or_official_v1 on storage.objects;
create policy storage_catalog_brand_delete_owner_or_official_v1
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'catalog-public'
  and private.can_delete_catalog_brand_asset_v1(name)
);
