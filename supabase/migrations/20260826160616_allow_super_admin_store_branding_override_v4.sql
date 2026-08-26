create or replace function private.store_branding_can_edit_v1(p_producer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.producers p
    where p.id=p_producer_id
      and p.deleted_at is null
      and p.status='active'
      and p.is_verified=true
      and (
        (p.store_kind<>'official' and p.owner_user_id=(select auth.uid()))
        or coalesce(private.has_permission('product.publish'),false)
      )
  );
$$;

create or replace function private.get_store_branding_editor_v1(p_producer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  p public.producers%rowtype;
  can_edit boolean:=false;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not (
    (p.store_kind<>'official' and p.owner_user_id=caller_id and p.status in ('active','suspended'))
    or coalesce(private.has_permission('product.publish'),false)
  ) then raise exception 'store_branding_access_required' using errcode='42501'; end if;
  can_edit:=private.store_branding_can_edit_v1(p.id);
  return jsonb_build_object(
    'producerId',p.id,'displayName',p.display_name,'storeKind',p.store_kind,'status',p.status,'verified',p.is_verified,
    'logoPath',p.logo_path,'coverPath',p.cover_path,'canEdit',can_edit,
    'logoBinaryVerified',private.catalog_media_binary_verified_path_v2(p.logo_path) is not null,
    'coverBinaryVerified',private.catalog_media_binary_verified_path_v2(p.cover_path) is not null
  );
end;
$$;

drop policy if exists storage_catalog_brand_insert_owner_or_official_v1 on storage.objects;
create policy storage_catalog_brand_insert_owner_or_official_v1
on storage.objects for insert to authenticated
with check (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='profile'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/profile/(logo|cover)-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
  and exists(
    select 1 from public.producers p
    where p.id::text=(storage.foldername(name))[1]
      and p.deleted_at is null
      and p.status='active'
      and p.is_verified=true
      and (
        (p.store_kind<>'official' and p.owner_user_id=(select auth.uid()))
        or coalesce(private.has_permission('product.publish'),false)
      )
  )
);

drop policy if exists storage_catalog_brand_delete_owner_or_official_v1 on storage.objects;
create policy storage_catalog_brand_delete_owner_or_official_v1
on storage.objects for delete to authenticated
using (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='profile'
  and exists(
    select 1 from public.producers p
    where p.id::text=(storage.foldername(name))[1]
      and p.deleted_at is null
      and (
        (p.store_kind<>'official' and p.owner_user_id=(select auth.uid()))
        or coalesce(private.has_permission('product.publish'),false)
      )
  )
  and not private.catalog_public_asset_is_referenced_v1(name)
);
