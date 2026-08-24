create table if not exists private.catalog_media_verifications (
  storage_path text primary key,
  storage_object_id uuid not null,
  storage_object_version text,
  storage_updated_at timestamptz not null,
  uploader_user_id uuid not null,
  producer_id uuid not null references public.producers(id) on delete cascade,
  source_kind text not null check (source_kind in ('producer','official_admin')),
  detected_mime text not null check (detected_mime in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null default timezone('utc',now())
);

create index if not exists catalog_media_verifications_producer_idx
  on private.catalog_media_verifications(producer_id,verified_at desc);
create index if not exists catalog_media_verifications_uploader_idx
  on private.catalog_media_verifications(uploader_user_id,verified_at desc);

revoke all on table private.catalog_media_verifications from public,anon,authenticated;

create or replace function public.catalog_media_register_verification_service_v1(
  p_storage_path text,
  p_uploader_user_id uuid,
  p_storage_object_id uuid,
  p_storage_object_version text,
  p_storage_updated_at timestamptz,
  p_detected_mime text,
  p_byte_size bigint,
  p_sha256_hex text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized text:=private.verified_public_storage_path_v1('catalog-public',p_storage_path);
  parts text[];
  filename text;
  extension text;
  source_kind text;
  resolved_producer_id uuid;
  object_row storage.objects%rowtype;
  official_count integer:=0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;
  if normalized is null or p_uploader_user_id is null or p_storage_object_id is null or p_storage_updated_at is null then
    raise exception 'catalog_media_verification_input_invalid';
  end if;
  if lower(coalesce(p_detected_mime,'')) not in ('image/jpeg','image/png','image/webp','image/avif') then
    raise exception 'catalog_media_detected_mime_invalid';
  end if;
  if p_byte_size is null or p_byte_size not between 1 and 10485760 then
    raise exception 'catalog_media_size_invalid';
  end if;
  if lower(coalesce(p_sha256_hex,'')) !~ '^[0-9a-f]{64}$' then
    raise exception 'catalog_media_checksum_invalid';
  end if;

  parts:=string_to_array(normalized,'/');
  if array_length(parts,1)=3 and parts[2]='products' then
    begin
      resolved_producer_id:=parts[1]::uuid;
    exception when others then
      raise exception 'catalog_media_path_invalid';
    end;
    filename:=parts[3];
    if filename !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$' then
      raise exception 'catalog_media_path_invalid';
    end if;
    if not exists(
      select 1 from public.producers p
      where p.id=resolved_producer_id
        and p.owner_user_id=p_uploader_user_id
        and p.status='active'
        and p.deleted_at is null
    ) then
      raise exception 'catalog_media_owner_mismatch';
    end if;
    source_kind:='producer';
  elsif array_length(parts,1)=4 and parts[1]='admin' and parts[3]='official-products' then
    if parts[2]<>p_uploader_user_id::text then
      raise exception 'catalog_media_owner_mismatch';
    end if;
    filename:=parts[4];
    if filename !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$' then
      raise exception 'catalog_media_path_invalid';
    end if;
    if not private.user_has_permission_v1(p_uploader_user_id,'product.create') then
      raise exception 'catalog_media_admin_permission_required';
    end if;
    select count(*)::integer into official_count
    from public.producers p
    where p.store_kind='official'
      and p.status='active'
      and p.deleted_at is null;
    if official_count<>1 then
      raise exception 'official_store_not_ready';
    end if;
    select p.id into resolved_producer_id
    from public.producers p
    where p.store_kind='official'
      and p.status='active'
      and p.deleted_at is null
    order by p.created_at
    limit 1;
    if resolved_producer_id is null then
      raise exception 'official_store_not_ready';
    end if;
    source_kind:='official_admin';
  else
    raise exception 'catalog_media_path_invalid';
  end if;

  extension:=lower(regexp_replace(filename,'^.*\.','','g'));
  if not (
    (lower(p_detected_mime)='image/jpeg' and extension in ('jpg','jpeg'))
    or (lower(p_detected_mime)='image/png' and extension='png')
    or (lower(p_detected_mime)='image/webp' and extension='webp')
    or (lower(p_detected_mime)='image/avif' and extension='avif')
  ) then
    raise exception 'catalog_media_extension_mismatch';
  end if;

  select o.* into object_row
  from storage.objects o
  where o.bucket_id='catalog-public'
    and o.name=normalized
    and coalesce(o.is_delete_marker,false)=false
    and o.archived_at is null;
  if not found then
    raise exception 'catalog_media_object_missing';
  end if;
  if object_row.id<>p_storage_object_id
     or object_row.updated_at is distinct from p_storage_updated_at
     or object_row.version is distinct from p_storage_object_version then
    raise exception 'catalog_media_object_changed';
  end if;
  if coalesce(object_row.owner::text,object_row.owner_id,'')<>p_uploader_user_id::text then
    raise exception 'catalog_media_storage_owner_mismatch';
  end if;
  if lower(coalesce(object_row.metadata->>'mimetype',''))<>lower(p_detected_mime) then
    raise exception 'catalog_media_metadata_mime_mismatch';
  end if;
  if coalesce(object_row.metadata->>'size','') !~ '^[0-9]{1,12}$'
     or (object_row.metadata->>'size')::bigint<>p_byte_size then
    raise exception 'catalog_media_metadata_size_mismatch';
  end if;

  insert into private.catalog_media_verifications(
    storage_path,storage_object_id,storage_object_version,storage_updated_at,
    uploader_user_id,producer_id,source_kind,detected_mime,byte_size,sha256_hex,verified_at
  ) values(
    normalized,p_storage_object_id,p_storage_object_version,p_storage_updated_at,
    p_uploader_user_id,resolved_producer_id,source_kind,lower(p_detected_mime),p_byte_size,lower(p_sha256_hex),timezone('utc',now())
  )
  on conflict(storage_path) do update set
    storage_object_id=excluded.storage_object_id,
    storage_object_version=excluded.storage_object_version,
    storage_updated_at=excluded.storage_updated_at,
    uploader_user_id=excluded.uploader_user_id,
    producer_id=excluded.producer_id,
    source_kind=excluded.source_kind,
    detected_mime=excluded.detected_mime,
    byte_size=excluded.byte_size,
    sha256_hex=excluded.sha256_hex,
    verified_at=excluded.verified_at;
  return true;
end;
$$;

revoke all on function public.catalog_media_register_verification_service_v1(text,uuid,uuid,text,timestamptz,text,bigint,text) from public,anon,authenticated;
grant execute on function public.catalog_media_register_verification_service_v1(text,uuid,uuid,text,timestamptz,text,bigint,text) to service_role;

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
    join private.catalog_media_verifications v on v.storage_path=o.name
    where o.bucket_id='catalog-public'
      and o.name=normalized
      and coalesce(o.is_delete_marker,false)=false
      and o.archived_at is null
      and v.storage_object_id=o.id
      and v.storage_updated_at is not distinct from o.updated_at
      and v.storage_object_version is not distinct from o.version
      and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$'
      and v.byte_size=(o.metadata->>'size')::bigint
      and v.detected_mime=lower(coalesce(o.metadata->>'mimetype',''))
      and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif')
      and (o.metadata->>'size')::bigint between 1 and 10485760
      and (
        (v.detected_mime='image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$')
        or (v.detected_mime='image/png' and lower(normalized) ~ '\.png$')
        or (v.detected_mime='image/webp' and lower(normalized) ~ '\.webp$')
        or (v.detected_mime='image/avif' and lower(normalized) ~ '\.avif$')
      )
  ) then return normalized; end if;
  return null;
end;
$$;

create table if not exists private.product_media_integrity_state(
  singleton boolean primary key default true check(singleton),
  last_scan_at timestamptz,
  last_quarantined_count integer not null default 0,
  last_stale_verification_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc',now())
);
insert into private.product_media_integrity_state(singleton) values(true) on conflict(singleton) do nothing;
revoke all on table private.product_media_integrity_state from public,anon,authenticated;

create or replace function private.quarantine_invalid_published_product_media_v1()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  affected_count integer:=0;
  stale_count integer:=0;
begin
  delete from private.catalog_media_verifications v
  where not exists(
    select 1 from storage.objects o
    where o.bucket_id='catalog-public'
      and o.name=v.storage_path
      and coalesce(o.is_delete_marker,false)=false
      and o.archived_at is null
      and o.id=v.storage_object_id
      and o.updated_at is not distinct from v.storage_updated_at
      and o.version is not distinct from v.storage_object_version
  );
  get diagnostics stale_count=row_count;

  update public.products p
     set is_active=false
   where p.status='published'
     and p.is_active=true
     and p.deleted_at is null
     and not private.product_media_integrity_ok_v1(p.id);
  get diagnostics affected_count=row_count;

  update private.product_media_integrity_state
     set last_scan_at=timezone('utc',now()),
         last_quarantined_count=affected_count,
         last_stale_verification_count=stale_count,
         updated_at=timezone('utc',now())
   where singleton=true;
  return affected_count;
end;
$$;

create or replace function public.admin_product_media_health_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  result jsonb;
begin
  if not private.has_permission('product.moderate') then
    raise exception 'product_moderate_permission_required';
  end if;

  with image_health as (
    select i.id,i.product_id,i.storage_path,p.name as product_name,p.status,p.is_active,
      case
        when private.verified_public_storage_path_v1('catalog-public',i.storage_path) is null then 'invalid_path'
        when o.id is null then 'missing_object'
        when v.storage_path is null then 'unverified_object'
        when private.verified_catalog_product_image_path_v1(i.storage_path) is null then 'invalid_object'
        else 'healthy'
      end as health
    from public.product_images i
    join public.products p on p.id=i.product_id
    left join storage.objects o on o.bucket_id='catalog-public' and o.name=i.storage_path and coalesce(o.is_delete_marker,false)=false and o.archived_at is null
    left join private.catalog_media_verifications v on v.storage_path=i.storage_path and v.storage_object_id=o.id
  ), orphan_images as (
    select o.name
    from storage.objects o
    where o.bucket_id='catalog-public'
      and coalesce(o.is_delete_marker,false)=false
      and o.archived_at is null
      and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif')
      and not exists(select 1 from public.product_images i where i.storage_path=o.name)
  ), scan_state as (
    select last_scan_at,last_quarantined_count,last_stale_verification_count
    from private.product_media_integrity_state where singleton=true
  )
  select jsonb_build_object(
    'totalImageRows',(select count(*) from image_health),
    'healthy',(select count(*) from image_health where health='healthy'),
    'missing',(select count(*) from image_health where health='missing_object'),
    'invalid',(select count(*) from image_health where health in ('invalid_path','unverified_object','invalid_object')),
    'orphan',(select count(*) from orphan_images),
    'lastScanAt',(select last_scan_at from scan_state),
    'lastQuarantinedCount',coalesce((select last_quarantined_count from scan_state),0),
    'lastStaleVerificationCount',coalesce((select last_stale_verification_count from scan_state),0),
    'affectedProducts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId',product_id,
        'productName',product_name,
        'status',status,
        'active',is_active,
        'imageId',id,
        'storagePath',storage_path,
        'health',health
      ) order by product_name)
      from (select * from image_health where health<>'healthy' order by product_name limit 200) x
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_product_media_health_v1() from public,anon;
grant execute on function public.admin_product_media_health_v1() to authenticated;
