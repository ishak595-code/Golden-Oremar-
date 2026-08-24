create table if not exists private.catalog_media_verifications(
  object_id uuid not null,
  bucket_id text not null default 'catalog-public' check(bucket_id='catalog-public'),
  object_path text not null,
  object_version text,
  object_updated_at timestamptz,
  media_kind text not null check(media_kind in ('image','video')),
  detected_mime text not null,
  byte_size bigint not null check(byte_size>0 and byte_size<=52428800),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  verified_by uuid,
  verified_at timestamptz not null default timezone('utc',now()),
  primary key(object_id),
  unique(bucket_id,object_path)
);
alter table private.catalog_media_verifications enable row level security;
revoke all on table private.catalog_media_verifications from public,anon,authenticated,service_role;
create index if not exists catalog_media_verifications_path_idx on private.catalog_media_verifications(bucket_id,object_path);

create table if not exists private.catalog_media_integrity_scans(
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default timezone('utc',now()),
  completed_at timestamptz,
  counts jsonb not null default '{}'::jsonb
);
alter table private.catalog_media_integrity_scans enable row level security;
revoke all on table private.catalog_media_integrity_scans from public,anon,authenticated,service_role;

create table if not exists private.catalog_media_integrity_findings(
  scan_id uuid not null,
  finding_type text not null check(finding_type in ('healthy','missing_object','orphan_object','invalid_path','invalid_mime','invalid_size','unverified_binary')),
  bucket_id text not null default 'catalog-public',
  object_path text,
  product_id uuid,
  image_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc',now())
);
alter table private.catalog_media_integrity_findings enable row level security;
revoke all on table private.catalog_media_integrity_findings from public,anon,authenticated,service_role;
create index if not exists catalog_media_integrity_findings_scan_idx on private.catalog_media_integrity_findings(scan_id,finding_type);
create index if not exists catalog_media_integrity_findings_product_idx on private.catalog_media_integrity_findings(product_id) where product_id is not null;

create or replace function private.catalog_media_binary_verification_current_v1(p_path text,p_kind text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
select exists(
  select 1
  from storage.objects o
  join private.catalog_media_verifications v
    on v.object_id=o.id and v.bucket_id=o.bucket_id and v.object_path=o.name
  where o.bucket_id='catalog-public'
    and o.name=regexp_replace(btrim(coalesce(p_path,'')),'^/+','','g')
    and v.media_kind=p_kind
    and coalesce(o.is_delete_marker,false)=false
    and o.archived_at is null
    and v.object_version is not distinct from o.version
    and v.object_updated_at is not distinct from o.updated_at
    and lower(coalesce(o.metadata->>'mimetype',''))=v.detected_mime
    and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$'
    and (o.metadata->>'size')::bigint=v.byte_size
    and v.sha256 ~ '^[0-9a-f]{64}$'
);
$$;

create or replace function private.verified_catalog_product_image_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare normalized text:=private.verified_public_storage_path_v1('catalog-public',p_path);
begin
  if normalized is null then return null; end if;
  if exists(
    select 1 from storage.objects o
    where o.bucket_id='catalog-public' and o.name=normalized
      and coalesce(o.is_delete_marker,false)=false and o.archived_at is null
      and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif')
      and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$'
      and (o.metadata->>'size')::bigint between 1 and 10485760
      and ((lower(o.metadata->>'mimetype')='image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$')
        or (lower(o.metadata->>'mimetype')='image/png' and lower(normalized) ~ '\.png$')
        or (lower(o.metadata->>'mimetype')='image/webp' and lower(normalized) ~ '\.webp$')
        or (lower(o.metadata->>'mimetype')='image/avif' and lower(normalized) ~ '\.avif$'))
      and private.catalog_media_binary_verification_current_v1(normalized,'image')
  ) then return normalized; end if;
  return null;
end;
$$;

create or replace function private.verified_product_video_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare normalized text:=btrim(coalesce(p_path,'')); mime text; size_bytes bigint;
begin
  if normalized='' or char_length(normalized)>1200 or normalized~*'^[a-z][a-z0-9+.-]*:' or normalized like '/%' then return null; end if;
  if exists(select 1 from unnest(string_to_array(normalized,'/')) as part(value) where value in ('','.','..')) then return null; end if;
  select lower(coalesce(o.metadata->>'mimetype','')),nullif(o.metadata->>'size','')::bigint into mime,size_bytes
  from storage.objects o where o.bucket_id='catalog-public' and o.name=normalized and coalesce(o.is_delete_marker,false)=false and o.archived_at is null limit 1;
  if mime not in ('video/mp4','video/webm','video/quicktime') then return null; end if;
  if size_bytes is null or size_bytes<=0 or size_bytes>52428800 then return null; end if;
  if not ((mime='video/mp4' and lower(normalized) ~ '\.mp4$') or (mime='video/webm' and lower(normalized) ~ '\.webm$') or (mime='video/quicktime' and lower(normalized) ~ '\.mov$')) then return null; end if;
  if not private.catalog_media_binary_verification_current_v1(normalized,'video') then return null; end if;
  return normalized;
exception when others then return null;
end;
$$;

create or replace function public.record_catalog_media_verification_v1(p_path text,p_media_kind text,p_detected_mime text,p_byte_size bigint,p_sha256 text,p_verified_by uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized text:=regexp_replace(btrim(coalesce(p_path,'')),'^/+','','g');
  media_kind_value text:=lower(btrim(coalesce(p_media_kind,'')));
  detected text:=lower(btrim(coalesce(p_detected_mime,'')));
  digest text:=lower(btrim(coalesce(p_sha256,'')));
  object_row storage.objects%rowtype;
  declared_mime text;
  declared_size bigint;
  max_size bigint;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if normalized='' or char_length(normalized)>1200 or normalized~*'^[a-z][a-z0-9+.-]*:' or exists(select 1 from unnest(string_to_array(normalized,'/')) as part(value) where value in ('','.','..')) then raise exception 'invalid_catalog_media_path' using errcode='22023'; end if;
  if media_kind_value not in ('image','video') then raise exception 'invalid_catalog_media_kind' using errcode='22023'; end if;
  max_size:=case when media_kind_value='image' then 10485760 else 52428800 end;
  if p_byte_size is null or p_byte_size<=0 or p_byte_size>max_size then raise exception 'invalid_catalog_media_size' using errcode='22023'; end if;
  if digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid_catalog_media_checksum' using errcode='22023'; end if;
  if media_kind_value='image' and detected not in ('image/jpeg','image/png','image/webp','image/avif') then raise exception 'invalid_catalog_image_type' using errcode='22023'; end if;
  if media_kind_value='video' and detected not in ('video/mp4','video/webm','video/quicktime') then raise exception 'invalid_catalog_video_type' using errcode='22023'; end if;
  if not ((detected='image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$') or (detected='image/png' and lower(normalized) ~ '\.png$') or (detected='image/webp' and lower(normalized) ~ '\.webp$') or (detected='image/avif' and lower(normalized) ~ '\.avif$') or (detected='video/mp4' and lower(normalized) ~ '\.mp4$') or (detected='video/webm' and lower(normalized) ~ '\.webm$') or (detected='video/quicktime' and lower(normalized) ~ '\.mov$')) then raise exception 'catalog_media_extension_mismatch' using errcode='22023'; end if;
  select * into object_row from storage.objects o where o.bucket_id='catalog-public' and o.name=normalized and coalesce(o.is_delete_marker,false)=false and o.archived_at is null limit 1;
  if object_row.id is null then raise exception 'catalog_media_object_not_found' using errcode='P0002'; end if;
  declared_mime:=lower(coalesce(object_row.metadata->>'mimetype',''));
  if coalesce(object_row.metadata->>'size','') !~ '^[0-9]{1,12}$' then raise exception 'catalog_media_object_size_invalid' using errcode='55000'; end if;
  declared_size:=(object_row.metadata->>'size')::bigint;
  if declared_mime<>detected then raise exception 'catalog_media_declared_mime_mismatch' using errcode='55000'; end if;
  if declared_size<>p_byte_size then raise exception 'catalog_media_declared_size_mismatch' using errcode='55000'; end if;
  delete from private.catalog_media_verifications v where v.bucket_id='catalog-public' and v.object_path=normalized and v.object_id<>object_row.id;
  insert into private.catalog_media_verifications(object_id,bucket_id,object_path,object_version,object_updated_at,media_kind,detected_mime,byte_size,sha256,verified_by,verified_at)
  values(object_row.id,'catalog-public',normalized,object_row.version,object_row.updated_at,media_kind_value,detected,p_byte_size,digest,p_verified_by,timezone('utc',now()))
  on conflict(object_id) do update set bucket_id=excluded.bucket_id,object_path=excluded.object_path,object_version=excluded.object_version,object_updated_at=excluded.object_updated_at,media_kind=excluded.media_kind,detected_mime=excluded.detected_mime,byte_size=excluded.byte_size,sha256=excluded.sha256,verified_by=excluded.verified_by,verified_at=excluded.verified_at;
  return jsonb_build_object('ok',true,'path',normalized,'kind',media_kind_value,'detectedMime',detected,'byteSize',p_byte_size,'sha256',digest,'objectId',object_row.id);
end;
$$;
revoke all on function public.record_catalog_media_verification_v1(text,text,text,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.record_catalog_media_verification_v1(text,text,text,bigint,text,uuid) to service_role;

create or replace function private.run_catalog_media_integrity_scan_v1()
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_scan_id uuid:=gen_random_uuid(); v_counts jsonb;
begin
  insert into private.catalog_media_integrity_scans(id,started_at) values(v_scan_id,timezone('utc',now()));
  insert into private.catalog_media_integrity_findings(scan_id,finding_type,bucket_id,object_path,product_id,image_id,details)
  select v_scan_id,
    case when o.id is null then 'missing_object'
      when lower(coalesce(o.metadata->>'mimetype','')) not in ('image/jpeg','image/png','image/webp','image/avif') then 'invalid_mime'
      when coalesce(o.metadata->>'size','') !~ '^[0-9]{1,12}$' or (o.metadata->>'size')::bigint not between 1 and 10485760 then 'invalid_size'
      when not (n.normalized ~ '^[0-9a-fA-F-]{36}/products/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|avif)$' or n.normalized ~ '^admin/[0-9a-fA-F-]{36}/official-products/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|avif)$') then 'invalid_path'
      when not private.catalog_media_binary_verification_current_v1(n.normalized,'image') then 'unverified_binary'
      else 'healthy' end,
    'catalog-public',n.normalized,i.product_id,i.id,jsonb_build_object('productName',p.name,'productStatus',p.status,'productActive',p.is_active,'isPrimary',i.is_primary,'storageObjectId',o.id)
  from public.product_images i
  join public.products p on p.id=i.product_id and p.deleted_at is null
  cross join lateral (select regexp_replace(btrim(coalesce(i.storage_path,'')),'^/+','','g') as normalized) n
  left join storage.objects o on o.bucket_id='catalog-public' and o.name=n.normalized and coalesce(o.is_delete_marker,false)=false and o.archived_at is null;
  insert into private.catalog_media_integrity_findings(scan_id,finding_type,bucket_id,object_path,details)
  select v_scan_id,'orphan_object','catalog-public',o.name,jsonb_build_object('storageObjectId',o.id,'createdAt',o.created_at,'mime',o.metadata->>'mimetype','size',o.metadata->>'size')
  from storage.objects o
  where o.bucket_id='catalog-public' and coalesce(o.is_delete_marker,false)=false and o.archived_at is null
    and coalesce(o.created_at,timezone('utc',now()))<timezone('utc',now())-interval '30 minutes'
    and not exists(select 1 from public.product_images i where regexp_replace(btrim(coalesce(i.storage_path,'')),'^/+','','g')=o.name)
    and not exists(select 1 from public.products p where p.deleted_at is null and nullif(btrim(coalesce(p.specifications->>'video','')),'')=o.name);
  select jsonb_build_object(
    'totalImageRows',(select count(*) from public.product_images i join public.products p on p.id=i.product_id and p.deleted_at is null),
    'storageObjects',(select count(*) from storage.objects o where o.bucket_id='catalog-public' and coalesce(o.is_delete_marker,false)=false and o.archived_at is null),
    'healthy',count(*) filter(where finding_type='healthy'),'missingObject',count(*) filter(where finding_type='missing_object'),'orphanObject',count(*) filter(where finding_type='orphan_object'),'invalidPath',count(*) filter(where finding_type='invalid_path'),'invalidMime',count(*) filter(where finding_type='invalid_mime'),'invalidSize',count(*) filter(where finding_type='invalid_size'),'unverifiedBinary',count(*) filter(where finding_type='unverified_binary'))
  into v_counts from private.catalog_media_integrity_findings where scan_id=v_scan_id;
  update private.catalog_media_integrity_scans set completed_at=timezone('utc',now()),counts=v_counts where id=v_scan_id;
  delete from private.catalog_media_integrity_findings f using private.catalog_media_integrity_scans s where f.scan_id=s.id and s.started_at<timezone('utc',now())-interval '30 days';
  delete from private.catalog_media_integrity_scans where started_at<timezone('utc',now())-interval '30 days';
  return v_scan_id;
end;
$$;
revoke all on function private.run_catalog_media_integrity_scan_v1() from public,anon,authenticated,service_role;

create or replace function private.super_admin_catalog_media_health_v1(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); scan_row private.catalog_media_integrity_scans%rowtype; findings jsonb; safe_limit integer:=least(200,greatest(1,coalesce(p_limit,100)));
begin
  if uid is null or not private.has_permission('product.health_manage') then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into scan_row from private.catalog_media_integrity_scans order by started_at desc limit 1;
  if scan_row.id is null then return jsonb_build_object('scan',null,'findings','[]'::jsonb); end if;
  select coalesce(jsonb_agg(row_data order by priority,product_name nulls last,object_path),'[]'::jsonb) into findings from (
    select case f.finding_type when 'missing_object' then 1 when 'invalid_mime' then 2 when 'invalid_size' then 3 when 'unverified_binary' then 4 when 'invalid_path' then 5 when 'orphan_object' then 6 else 7 end as priority,
      coalesce(f.details->>'productName','') as product_name,f.object_path,
      jsonb_build_object('type',f.finding_type,'productId',f.product_id,'imageId',f.image_id,'objectPath',f.object_path,'details',f.details) as row_data
    from private.catalog_media_integrity_findings f where f.scan_id=scan_row.id and f.finding_type<>'healthy' order by priority,product_name,f.object_path limit safe_limit
  ) q;
  return jsonb_build_object('scan',jsonb_build_object('id',scan_row.id,'startedAt',scan_row.started_at,'completedAt',scan_row.completed_at,'counts',scan_row.counts),'findings',findings);
end;
$$;

create or replace function private.super_admin_run_catalog_media_integrity_scan_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); new_scan_id uuid; result jsonb;
begin
  if uid is null or not private.has_permission('product.health_manage') then raise exception 'super_admin_required' using errcode='42501'; end if;
  new_scan_id:=private.run_catalog_media_integrity_scan_v1();
  result:=private.super_admin_catalog_media_health_v1(100);
  perform private.write_admin_audit_v2('catalog_media.integrity_scan','system','catalog-public',null,result->'scan',jsonb_build_object('scanId',new_scan_id),null);
  return result;
end;
$$;

create or replace function public.super_admin_catalog_media_health_v1(p_limit integer default 100)
returns jsonb language sql stable set search_path='' as $$select private.super_admin_catalog_media_health_v1(p_limit);$$;
create or replace function public.super_admin_run_catalog_media_integrity_scan_v1()
returns jsonb language sql set search_path='' as $$select private.super_admin_run_catalog_media_integrity_scan_v1();$$;
revoke all on function public.super_admin_catalog_media_health_v1(integer) from public,anon;
revoke all on function public.super_admin_run_catalog_media_integrity_scan_v1() from public,anon;
grant execute on function public.super_admin_catalog_media_health_v1(integer) to authenticated;
grant execute on function public.super_admin_run_catalog_media_integrity_scan_v1() to authenticated;

select cron.unschedule(jobid) from cron.job where jobname='golden-oremar-catalog-media-health';
select cron.schedule('golden-oremar-catalog-media-health','*/15 * * * *','select private.run_catalog_media_integrity_scan_v1();');
select private.run_catalog_media_integrity_scan_v1();