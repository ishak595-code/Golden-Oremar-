select cron.unschedule(jobid) from cron.job where jobname in ('golden-oremar-catalog-media-health','golden-oremar-product-media-integrity');

drop function if exists public.super_admin_run_catalog_media_integrity_scan_v1();
drop function if exists public.super_admin_catalog_media_health_v1(integer);
drop function if exists private.super_admin_run_catalog_media_integrity_scan_v1();
drop function if exists private.super_admin_catalog_media_health_v1(integer);
drop function if exists private.run_catalog_media_integrity_scan_v1();
drop function if exists public.record_catalog_media_verification_v1(text,text,text,bigint,text,uuid);
drop function if exists private.catalog_media_binary_verification_current_v1(text,text);

drop table if exists private.catalog_media_integrity_findings;
drop table if exists private.catalog_media_integrity_scans;
drop table if exists private.catalog_media_verifications;

create or replace function private.verified_catalog_product_image_path_v1(p_path text)
returns text
language plpgsql
stable security definer
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

create or replace function private.verified_product_video_path_v1(p_path text)
returns text
language plpgsql
stable security definer
set search_path=''
as $$
declare
  normalized text:=btrim(coalesce(p_path,''));
  mime text;
  size_bytes bigint;
begin
  if normalized='' or char_length(normalized)>1200 or normalized~*'^[a-z][a-z0-9+.-]*:' or normalized like '/%' then return null; end if;
  if exists(select 1 from unnest(string_to_array(normalized,'/')) part where part in ('','.','..')) then return null; end if;
  select lower(coalesce(o.metadata->>'mimetype','')), nullif(o.metadata->>'size','')::bigint
    into mime,size_bytes
  from storage.objects o
  where o.bucket_id='catalog-public' and o.name=normalized
  limit 1;
  if mime not in ('video/mp4','video/webm','video/quicktime') then return null; end if;
  if size_bytes is null or size_bytes<=0 or size_bytes>52428800 then return null; end if;
  return normalized;
exception when others then
  return null;
end;
$$;
