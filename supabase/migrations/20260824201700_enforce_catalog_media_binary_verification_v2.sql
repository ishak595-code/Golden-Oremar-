create table if not exists private.catalog_media_binary_verifications_v2 (
  object_id uuid primary key references storage.objects(id) on delete cascade,
  bucket_id text not null check (bucket_id = 'catalog-public'),
  object_path text not null,
  object_version text null,
  object_updated_at timestamptz null,
  detected_mime text not null check (detected_mime in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  verified_by uuid null,
  verified_at timestamptz not null default timezone('utc',now()),
  unique(bucket_id,object_path)
);
revoke all on table private.catalog_media_binary_verifications_v2 from public,anon,authenticated;
grant select,insert,update,delete on table private.catalog_media_binary_verifications_v2 to service_role;
create index if not exists catalog_media_binary_verifications_v2_path_idx on private.catalog_media_binary_verifications_v2(bucket_id,object_path);

create or replace function public.catalog_media_record_binary_verification_v2(p_path text,p_detected_mime text,p_byte_size bigint,p_sha256 text,p_verified_by uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  normalized text:=private.verified_public_storage_path_v1('catalog-public',p_path);
  obj storage.objects%rowtype;
  detected text:=lower(trim(coalesce(p_detected_mime,'')));
  digest text:=lower(trim(coalesce(p_sha256,'')));
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if normalized is null then raise exception 'catalog_media_path_invalid' using errcode='22023'; end if;
  if detected not in ('image/jpeg','image/png','image/webp','image/avif') then raise exception 'catalog_media_binary_type_invalid' using errcode='22023'; end if;
  if p_byte_size is null or p_byte_size<1 or p_byte_size>10485760 then raise exception 'catalog_media_size_invalid' using errcode='22023'; end if;
  if digest !~ '^[0-9a-f]{64}$' then raise exception 'catalog_media_checksum_invalid' using errcode='22023'; end if;
  if not ((detected='image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$') or (detected='image/png' and lower(normalized) ~ '\.png$') or (detected='image/webp' and lower(normalized) ~ '\.webp$') or (detected='image/avif' and lower(normalized) ~ '\.avif$')) then raise exception 'catalog_media_extension_mismatch' using errcode='22023'; end if;
  select * into obj from storage.objects o where o.bucket_id='catalog-public' and o.name=normalized and coalesce(o.is_delete_marker,false)=false and o.archived_at is null limit 1;
  if obj.id is null then raise exception 'catalog_media_object_missing' using errcode='P0002'; end if;
  if lower(coalesce(obj.metadata->>'mimetype',''))<>detected then raise exception 'catalog_media_metadata_mime_mismatch' using errcode='22023'; end if;
  if coalesce(obj.metadata->>'size','') !~ '^[0-9]{1,12}$' or (obj.metadata->>'size')::bigint<>p_byte_size then raise exception 'catalog_media_metadata_size_mismatch' using errcode='22023'; end if;
  insert into private.catalog_media_binary_verifications_v2(object_id,bucket_id,object_path,object_version,object_updated_at,detected_mime,byte_size,sha256,verified_by,verified_at)
  values(obj.id,'catalog-public',normalized,obj.version,obj.updated_at,detected,p_byte_size,digest,p_verified_by,timezone('utc',now()))
  on conflict(object_id) do update set bucket_id=excluded.bucket_id,object_path=excluded.object_path,object_version=excluded.object_version,object_updated_at=excluded.object_updated_at,detected_mime=excluded.detected_mime,byte_size=excluded.byte_size,sha256=excluded.sha256,verified_by=excluded.verified_by,verified_at=excluded.verified_at;
  delete from private.catalog_media_binary_verifications_v2 v where v.bucket_id='catalog-public' and v.object_path=normalized and v.object_id<>obj.id;
  return jsonb_build_object('ok',true,'path',normalized,'mime',detected,'byteSize',p_byte_size,'verifiedAt',timezone('utc',now()));
end;$$;
revoke all on function public.catalog_media_record_binary_verification_v2(text,text,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.catalog_media_record_binary_verification_v2(text,text,bigint,text,uuid) to service_role;

create or replace function private.catalog_media_binary_verified_path_v2(p_path text)
returns text language plpgsql stable security definer set search_path=''
as $$
declare normalized text:=private.verified_public_storage_path_v1('catalog-public',p_path); begin
  if normalized is null then return null; end if;
  if exists(select 1 from storage.objects o join private.catalog_media_binary_verifications_v2 v on v.object_id=o.id where o.bucket_id='catalog-public' and o.name=normalized and coalesce(o.is_delete_marker,false)=false and o.archived_at is null and v.bucket_id='catalog-public' and v.object_path=normalized and v.object_version is not distinct from o.version and v.object_updated_at is not distinct from o.updated_at and lower(coalesce(o.metadata->>'mimetype',''))=v.detected_mime and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$' and (o.metadata->>'size')::bigint=v.byte_size and v.byte_size between 1 and 10485760 and v.sha256 ~ '^[0-9a-f]{64}$' and ((v.detected_mime='image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$') or (v.detected_mime='image/png' and lower(normalized) ~ '\.png$') or (v.detected_mime='image/webp' and lower(normalized) ~ '\.webp$') or (v.detected_mime='image/avif' and lower(normalized) ~ '\.avif$'))) then return normalized; end if;
  return null;
end;$$;
revoke all on function private.catalog_media_binary_verified_path_v2(text) from public,anon,authenticated;

create or replace function private.verified_catalog_product_image_path_v1(p_path text)
returns text language sql stable security definer set search_path='' as $$ select private.catalog_media_binary_verified_path_v2(p_path); $$;
revoke all on function private.verified_catalog_product_image_path_v1(text) from public,anon,authenticated;

create table if not exists private.catalog_media_integrity_state_v2(singleton boolean primary key default true check(singleton),last_scanned_at timestamptz null,last_quarantined_count integer not null default 0 check(last_quarantined_count>=0));
revoke all on table private.catalog_media_integrity_state_v2 from public,anon,authenticated;
grant select,insert,update on table private.catalog_media_integrity_state_v2 to service_role;
insert into private.catalog_media_integrity_state_v2(singleton) values(true) on conflict(singleton) do nothing;

create or replace function private.quarantine_invalid_published_product_media_v1()
returns integer language plpgsql security definer set search_path=''
as $$declare affected_count integer:=0; begin
  update public.products p set is_active=false where p.status='published' and p.is_active=true and p.deleted_at is null and not private.product_media_integrity_ok_v1(p.id);
  get diagnostics affected_count=row_count;
  insert into private.catalog_media_integrity_state_v2(singleton,last_scanned_at,last_quarantined_count) values(true,timezone('utc',now()),affected_count) on conflict(singleton) do update set last_scanned_at=excluded.last_scanned_at,last_quarantined_count=excluded.last_quarantined_count;
  return affected_count;
end;$$;
revoke all on function private.quarantine_invalid_published_product_media_v1() from public,anon,authenticated,service_role;

create or replace function public.super_admin_catalog_media_health_v2()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare result jsonb; begin
  if auth.uid() is null or not coalesce(private.has_permission('product.health_manage'),false) then raise exception 'permission_required:product.health_manage' using errcode='42501'; end if;
  with image_rows as (
    select i.id image_id,i.product_id,p.name product_name,i.storage_path,private.verified_public_storage_path_v1('catalog-public',i.storage_path) normalized_path,o.id object_id,o.metadata,
      case when private.verified_public_storage_path_v1('catalog-public',i.storage_path) is null then 'invalid_path' when o.id is null then 'missing_object' when lower(coalesce(o.metadata->>'mimetype','')) not in ('image/jpeg','image/png','image/webp','image/avif') then 'invalid_mime' when coalesce(o.metadata->>'size','') !~ '^[0-9]{1,12}$' or (o.metadata->>'size')::bigint not between 1 and 10485760 then 'invalid_size' when private.catalog_media_binary_verified_path_v2(i.storage_path) is null then 'unverified_binary' else 'healthy' end status
    from public.product_images i join public.products p on p.id=i.product_id left join storage.objects o on o.bucket_id='catalog-public' and o.name=private.verified_public_storage_path_v1('catalog-public',i.storage_path) and coalesce(o.is_delete_marker,false)=false and o.archived_at is null
  ), orphan_rows as (
    select null::uuid image_id,null::uuid product_id,null::text product_name,o.name storage_path,o.name normalized_path,o.id object_id,o.metadata,'orphan_object'::text status from storage.objects o where o.bucket_id='catalog-public' and coalesce(o.is_delete_marker,false)=false and o.archived_at is null and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif') and not exists(select 1 from public.product_images i where private.verified_public_storage_path_v1('catalog-public',i.storage_path)=o.name)
  ), all_rows as (select * from image_rows union all select * from orphan_rows), summary as (select count(*) filter(where status='healthy')::integer healthy,count(*) filter(where status='missing_object')::integer missing,count(*) filter(where status='orphan_object')::integer orphan,count(*) filter(where status in ('invalid_path','invalid_mime','invalid_size','unverified_binary'))::integer invalid,count(*)::integer total from all_rows)
  select jsonb_build_object('scannedAt',timezone('utc',now()),'lastScheduledScanAt',(select s.last_scanned_at from private.catalog_media_integrity_state_v2 s where s.singleton=true),'lastQuarantinedCount',coalesce((select s.last_quarantined_count from private.catalog_media_integrity_state_v2 s where s.singleton=true),0),'summary',jsonb_build_object('total',summary.total,'healthy',summary.healthy,'missing',summary.missing,'orphan',summary.orphan,'invalid',summary.invalid),'items',coalesce((select jsonb_agg(jsonb_build_object('status',r.status,'productId',r.product_id,'productName',r.product_name,'imageId',r.image_id,'path',r.storage_path) order by r.status,r.product_name nulls last,r.storage_path) from all_rows r where r.status<>'healthy'),'[]'::jsonb)) into result from summary;
  return result;
end;$$;
revoke all on function public.super_admin_catalog_media_health_v2() from public,anon;
grant execute on function public.super_admin_catalog_media_health_v2() to authenticated;

select private.quarantine_invalid_published_product_media_v1();
