create or replace function private.verified_catalog_product_image_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  normalized text:=private.verified_public_storage_path_v1('catalog-public',p_path);
begin
  if normalized is null then return null; end if;
  if exists(
    select 1
    from storage.objects o
    where o.bucket_id='catalog-public'
      and o.name=normalized
      and coalesce(o.is_delete_marker,false)=false
      and o.archived_at is null
      and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif')
      and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$'
      and (o.metadata->>'size')::bigint between 1 and 10485760
      and (
        (lower(o.metadata->>'mimetype')='image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$')
        or (lower(o.metadata->>'mimetype')='image/png' and lower(normalized) ~ '\.png$')
        or (lower(o.metadata->>'mimetype')='image/webp' and lower(normalized) ~ '\.webp$')
        or (lower(o.metadata->>'mimetype')='image/avif' and lower(normalized) ~ '\.avif$')
      )
  ) then return normalized; end if;
  return null;
end;
$$;
revoke all on function private.verified_catalog_product_image_path_v1(text) from public,anon,authenticated;

create or replace function private.product_media_integrity_ok_v1(p_product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  image_count integer:=0;
  primary_count integer:=0;
  all_valid boolean:=false;
begin
  if p_product_id is null then return false; end if;
  select count(*)::integer,
         count(*) filter(where i.is_primary)::integer,
         coalesce(bool_and(private.verified_catalog_product_image_path_v1(i.storage_path) is not null),false)
    into image_count,primary_count,all_valid
  from public.product_images i
  where i.product_id=p_product_id;
  return image_count between 1 and 10 and primary_count=1 and all_valid;
end;
$$;
revoke all on function private.product_media_integrity_ok_v1(uuid) from public,anon,authenticated;

create or replace function private.enforce_product_image_storage_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  producer_row public.producers%rowtype;
  path_value text;
  caller_is_admin boolean:=false;
begin
  path_value:=private.verified_catalog_product_image_path_v1(new.storage_path);
  if path_value is null then
    raise exception 'verified_catalog_product_image_required' using errcode='22023';
  end if;
  new.storage_path:=path_value;

  select producer.* into producer_row
  from public.products product
  join public.producers producer on producer.id=product.producer_id
  where product.id=new.product_id and product.deleted_at is null;
  if producer_row.id is null then
    raise exception 'product_image_product_not_found' using errcode='P0002';
  end if;

  if caller_id is null then return new; end if;
  caller_is_admin:=coalesce(private.has_permission('admin.access'),false)
                   and coalesce(private.has_permission('product.update'),false);
  if caller_is_admin then return new; end if;

  if producer_row.owner_user_id is distinct from caller_id then
    raise exception 'product_image_access_denied' using errcode='42501';
  end if;
  if split_part(path_value,'/',1)<>producer_row.id::text
     or split_part(path_value,'/',2)<>'products'
     or split_part(path_value,'/',3)=''
     or split_part(path_value,'/',4)<>'' then
    raise exception 'product_image_must_use_owned_producer_catalog_path' using errcode='22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_product_image_storage_v1 on public.product_images;
create trigger enforce_product_image_storage_v1
before insert or update of product_id,storage_path
on public.product_images
for each row execute function private.enforce_product_image_storage_v1();

create or replace function private.assert_published_product_media_integrity_v1(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1 from public.products p
    where p.id=p_product_id
      and p.status='published'
      and p.is_active=true
      and p.deleted_at is null
  ) and not private.product_media_integrity_ok_v1(p_product_id) then
    raise exception 'published_product_requires_verified_media' using errcode='23514';
  end if;
end;
$$;
revoke all on function private.assert_published_product_media_integrity_v1(uuid) from public,anon,authenticated;

create or replace function private.enforce_product_publish_media_integrity_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.assert_published_product_media_integrity_v1(new.id);
  return new;
end;
$$;

create or replace function private.enforce_product_image_parent_media_integrity_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op<>'DELETE' then
    perform private.assert_published_product_media_integrity_v1(new.product_id);
  end if;
  if tg_op<>'INSERT' and (tg_op='DELETE' or old.product_id is distinct from new.product_id) then
    perform private.assert_published_product_media_integrity_v1(old.product_id);
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists product_media_integrity_product_v1 on public.products;
create constraint trigger product_media_integrity_product_v1
after insert or update on public.products
deferrable initially deferred
for each row execute function private.enforce_product_publish_media_integrity_v1();

drop trigger if exists product_media_integrity_images_v1 on public.product_images;
create constraint trigger product_media_integrity_images_v1
after insert or update or delete on public.product_images
deferrable initially deferred
for each row execute function private.enforce_product_image_parent_media_integrity_v1();

drop policy if exists storage_admin_public_assets_delete_v1 on storage.objects;
drop policy if exists storage_admin_public_assets_delete_v2 on storage.objects;
create policy storage_admin_public_assets_delete_v2
on storage.objects
for delete
to authenticated
using (
  bucket_id=any(array['catalog-public'::text,'content-public'::text])
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or not exists(
      select 1 from public.product_images image
      where image.storage_path=storage.objects.name
    )
  )
);

drop policy if exists storage_admin_public_assets_update_v1 on storage.objects;
drop policy if exists storage_admin_public_assets_update_v2 on storage.objects;
create policy storage_admin_public_assets_update_v2
on storage.objects
for update
to authenticated
using (
  bucket_id=any(array['catalog-public'::text,'content-public'::text])
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or not exists(
      select 1 from public.product_images image
      where image.storage_path=storage.objects.name
    )
  )
)
with check (
  bucket_id=any(array['catalog-public'::text,'content-public'::text])
  and (storage.foldername(name))[1]='admin'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.is_admin())
  and (
    bucket_id<>'catalog-public'
    or not exists(
      select 1 from public.product_images image
      where image.storage_path=storage.objects.name
    )
  )
);

update public.products p
set is_active=false
where p.status='published'
  and p.is_active=true
  and p.deleted_at is null
  and not private.product_media_integrity_ok_v1(p.id);
