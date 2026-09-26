-- Cloudflare R2 becomes the only home of every public image and video.
--
-- Owner's decision (2026-09-26): "fotoğraf ve video oraya, veritabanı sadece
-- diğer veriler için" - the way large apps separate a relational database
-- from media storage. Supabase keeps the references (paths) and the facts
-- about each file; the bytes live in R2, where downloads are free.
--
-- How the existing system keeps working without being rewritten:
--   * every catalogue check funnels through two helpers,
--     verified_public_storage_path_v1 and catalog_media_binary_verified_path_v2.
--     Both now also accept a confirmed, verified R2 object from the ledger;
--   * four functions that read storage.objects directly now read the view
--     private.media_objects_all (storage.objects plus confirmed R2 objects,
--     with the same column names), so their logic is unchanged;
--   * paths keep exactly the same shape, so no stored reference changes.
--
-- New uploads go straight to R2 through edge function media-upload, which
-- checks each file's real type, size and dimensions before confirming it.
-- Anything that still lands in the public Supabase buckets (older app
-- versions, tests) is copied to R2 by media-cdn-sync and then deleted from
-- Supabase ("adopt" + "offload").
--
-- Deleting is conservative: a file is removed from R2 only when an upload was
-- never finished (after 1 hour), or when no column of any table in the public
-- and private schemas mentions it any more for 72 hours. Audit history does
-- not count as a use. A missed reference can therefore only ever keep a file,
-- never delete a used one.

-- 1. Ledger: identity, verification facts, reference-check bookkeeping ------
alter table private.media_cdn_objects add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists media_cdn_objects_id_key on private.media_cdn_objects (id);
alter table private.media_cdn_objects add column if not exists sha256 text;
alter table private.media_cdn_objects add column if not exists width integer;
alter table private.media_cdn_objects add column if not exists height integer;
alter table private.media_cdn_objects add column if not exists binary_verified boolean not null default false;
alter table private.media_cdn_objects add column if not exists media_kind text;
alter table private.media_cdn_objects add column if not exists last_reference_check_at timestamptz;
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_sha256_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_sha256_check check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_dimensions_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_dimensions_check check ((width is null and height is null) or (width between 1 and 20000 and height between 1 and 20000));
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_origin_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_origin_check check (
  origin in ('mirror','direct') and (origin = 'direct' or content_type like 'image/%'));
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_verified_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_verified_check check (
  not binary_verified or (confirmed and sha256 is not null and content_type like 'image/%'));
create index if not exists media_cdn_objects_gc_idx on private.media_cdn_objects (origin, confirmed, reserved_at);

alter table private.media_cdn_settings add column if not exists offload_sources boolean not null default true;
-- Every image the public buckets accept (10 MB) can be adopted.
update private.media_cdn_settings set max_object_bytes = 10485760 where id and max_object_bytes < 10485760;

-- 2. One view of every stored object, Supabase or R2 ------------------------
-- Same column names as storage.objects. A Supabase object that already has a
-- confirmed R2 twin (adopted, waiting to be offloaded) is listed once.
create or replace view private.media_objects_all as
select o.id, o.bucket_id, o.name, o.owner, o.owner_id, o.metadata, o.version, o.created_at, o.updated_at,
       o.last_accessed_at, coalesce(o.is_delete_marker, false) as is_delete_marker, o.archived_at, 'supabase'::text as store
from storage.objects o
where not exists (
  select 1 from private.media_cdn_objects m
  where m.origin = 'direct' and m.confirmed and m.bucket_id = o.bucket_id and m.object_name = o.name)
union all
select m.id, m.bucket_id, m.object_name, m.owner_user_id, m.owner_user_id::text,
       jsonb_build_object('mimetype', m.content_type, 'size', m.byte_size, 'eTag', coalesce(m.sha256, m.source_etag), 'cacheControl', 'max-age=31536000'),
       null::text, m.reserved_at, coalesce(m.mirrored_at, m.reserved_at), null::timestamptz, false, null::timestamptz, 'r2'::text
from private.media_cdn_objects m
where m.origin = 'direct' and m.confirmed;
revoke all on private.media_objects_all from public, anon, authenticated;
grant select on private.media_objects_all to service_role;

-- 3. The two helpers every catalogue check goes through ---------------------
-- event-public is now accepted: event submissions called this helper with
-- 'event-public' and it always answered null, so no event image could ever
-- be saved (stored_event_image_required).
create or replace function private.verified_public_storage_path_v1(p_bucket text, p_path text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  bucket_name text := btrim(coalesce(p_bucket,''));
  raw_path text := btrim(coalesce(p_path,''));
  normalized text;
begin
  if bucket_name not in ('catalog-public','content-public','event-public') then return null; end if;
  if raw_path = '' or raw_path ~ '[[:cntrl:]]' or raw_path ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' then return null; end if;
  normalized := regexp_replace(raw_path,'^/+','','g');
  if normalized = '' or normalized like '%../%' or normalized like '../%' or normalized like '%/..' or normalized like '%/./%' then return null; end if;
  if exists (select 1 from private.media_objects_all o where o.bucket_id = bucket_name and o.name = normalized and not o.is_delete_marker and o.archived_at is null) then
    return normalized;
  end if;
  return null;
end;
$function$;

create or replace function private.catalog_media_binary_verified_path_v2(p_path text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare normalized text := private.verified_public_storage_path_v1('catalog-public', p_path);
begin
  if normalized is null then return null; end if;
  -- R2: verified by media-upload (or adopted from a verified Supabase object).
  if exists (
    select 1 from private.media_cdn_objects m
    where m.bucket_id = 'catalog-public' and m.object_name = normalized and m.origin = 'direct' and m.confirmed and m.binary_verified
      and m.byte_size between 1 and 10485760 and m.sha256 ~ '^[0-9a-f]{64}$'
      and ((m.content_type = 'image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$') or (m.content_type = 'image/png' and lower(normalized) ~ '\.png$')
        or (m.content_type = 'image/webp' and lower(normalized) ~ '\.webp$') or (m.content_type = 'image/avif' and lower(normalized) ~ '\.avif$'))) then
    return normalized;
  end if;
  -- Supabase Storage (not yet adopted): the original rule, unchanged.
  if exists (select 1 from storage.objects o join private.catalog_media_binary_verifications_v2 v on v.object_id = o.id
             where o.bucket_id = 'catalog-public' and o.name = normalized and coalesce(o.is_delete_marker,false) = false and o.archived_at is null
               and v.bucket_id = 'catalog-public' and v.object_path = normalized and v.object_version is not distinct from o.version
               and v.object_updated_at is not distinct from o.updated_at and lower(coalesce(o.metadata->>'mimetype','')) = v.detected_mime
               and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$' and (o.metadata->>'size')::bigint = v.byte_size
               and v.byte_size between 1 and 10485760 and v.sha256 ~ '^[0-9a-f]{64}$'
               and ((v.detected_mime = 'image/jpeg' and lower(normalized) ~ '\.(jpg|jpeg)$') or (v.detected_mime = 'image/png' and lower(normalized) ~ '\.png$')
                 or (v.detected_mime = 'image/webp' and lower(normalized) ~ '\.webp$') or (v.detected_mime = 'image/avif' and lower(normalized) ~ '\.avif$'))) then
    return normalized;
  end if;
  return null;
end;
$function$;

-- 4. Functions that read storage.objects directly now read the view --------
-- Only the table name changes; each function's own logic is kept verbatim.
do $$
declare f text; def text;
begin
  foreach f in array array[
    'private.admin_operations_overview_v2()',
    'private.super_admin_catalog_media_health_v3()',
    'private.super_admin_get_production_readiness_snapshot_v1()',
    'private.validate_product_change_payload_v1(uuid,uuid,uuid,jsonb)'] loop
    def := pg_get_functiondef(f::regprocedure);
    if strpos(def, 'storage.objects') = 0 then raise exception 'media_objects_all: % no longer reads storage.objects, review this migration', f; end if;
    execute replace(def, 'storage.objects', 'private.media_objects_all');
  end loop;
end;
$$;

-- 5. Which direct uploads exist, who may make them, how big they may be -----
create or replace function private.media_direct_kind_v1(p_bucket text, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  with u as (select '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'::text as id)
  select case
    when p_bucket = 'catalog-public' and p_name ~ ('^' || u.id || '/products/' || u.id || '[.](jpg|jpeg|png|webp|avif)$') then 'product-image'
    when p_bucket = 'catalog-public' and p_name ~ ('^' || u.id || '/products/' || u.id || '[.](mp4|webm|mov)$') then 'product-video'
    when p_bucket = 'catalog-public' and p_name ~ ('^admin/' || u.id || '/official-products/' || u.id || '[.](jpg|jpeg|png|webp|avif)$') then 'official-image'
    when p_bucket = 'catalog-public' and p_name ~ ('^admin/' || u.id || '/official-products/' || u.id || '[.](mp4|webm|mov)$') then 'official-video'
    when p_bucket = 'catalog-public' and p_name ~ ('^admin/' || u.id || '/categories/' || u.id || '[.](jpg|jpeg|png|webp|avif)$') then 'category-image'
    when p_bucket = 'catalog-public' and p_name ~ ('^' || u.id || '/profile/logo-' || u.id || '[.](jpg|jpeg|png|webp)$') then 'brand-logo'
    when p_bucket = 'catalog-public' and p_name ~ ('^' || u.id || '/profile/cover-' || u.id || '[.](jpg|jpeg|png|webp)$') then 'brand-cover'
    when p_bucket = 'event-public' and p_name ~ ('^' || u.id || '/events/' || u.id || '[.](jpg|jpeg|png|webp|avif)$') then 'event-image'
  end
  from u;
$$;

create or replace function private.media_extension_matches_v1(p_name text, p_content_type text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
       (p_content_type = 'image/jpeg' and lower(p_name) ~ '[.](jpg|jpeg)$')
    or (p_content_type = 'image/png' and lower(p_name) ~ '[.]png$')
    or (p_content_type = 'image/webp' and lower(p_name) ~ '[.]webp$')
    or (p_content_type = 'image/avif' and lower(p_name) ~ '[.]avif$')
    or (p_content_type = 'video/mp4' and lower(p_name) ~ '[.]mp4$')
    or (p_content_type = 'video/webm' and lower(p_name) ~ '[.]webm$')
    or (p_content_type = 'video/quicktime' and lower(p_name) ~ '[.]mov$'), false);
$$;

create or replace function private.media_direct_max_bytes_v1(p_kind text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_kind in ('product-video','official-video') then s.max_video_bytes
    when p_kind in ('brand-logo','brand-cover') then 5242880
    when p_kind is not null then 10485760
  end
  from private.media_cdn_settings s where s.id;
$$;

-- Reserve room for one direct upload. The edge function has already checked
-- staff permissions; ownership of producer folders is checked again here.
create or replace function private.media_direct_reserve_v1(p_user uuid, p_bucket text, p_name text, p_size bigint, p_content_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.media_cdn_settings;
  kind text := private.media_direct_kind_v1(p_bucket, p_name);
  producer public.producers%rowtype;
  total bigint; videos bigint; pending integer;
begin
  select * into s from private.media_cdn_settings where id for update;
  if not found or not s.enabled or s.public_base_url is null then return 'not_configured'; end if;
  if p_user is null or kind is null or not private.media_extension_matches_v1(p_name, p_content_type) then return 'invalid_name'; end if;
  if (kind like '%-video') <> (p_content_type like 'video/%') then return 'invalid_name'; end if;
  if p_size is null or p_size < 1 or p_size > private.media_direct_max_bytes_v1(kind) then return 'size_invalid'; end if;

  if kind in ('official-image','official-video','category-image') then
    if split_part(p_name, '/', 2) <> p_user::text then return 'owner_mismatch'; end if;
  else
    select * into producer from public.producers pr where pr.id = split_part(p_name, '/', 1)::uuid and pr.deleted_at is null;
    if producer.id is null then return 'owner_mismatch'; end if;
    if kind in ('product-image','product-video') then
      if producer.owner_user_id is distinct from p_user or producer.status <> 'active' or not producer.is_verified or not producer.origin_verified then return 'owner_mismatch'; end if;
    elsif kind in ('brand-logo','brand-cover') then
      if not producer.is_verified then return 'owner_mismatch'; end if;
      if producer.store_kind = 'official' then
        if producer.status <> 'active' then return 'owner_mismatch'; end if;
      elsif producer.owner_user_id is distinct from p_user or producer.status not in ('pending','active') then
        return 'owner_mismatch';
      end if;
    elsif kind = 'event-image' then
      if producer.owner_user_id is distinct from p_user or not private.is_producer_trust_badge_active_v1(producer.id) then return 'owner_mismatch'; end if;
    end if;
  end if;

  select count(*) into pending from private.media_cdn_objects
  where origin = 'direct' and owner_user_id = p_user and not confirmed and reserved_at > now() - interval '1 hour';
  if pending >= 20 then return 'too_many_pending'; end if;
  select coalesce(sum(byte_size),0), coalesce(sum(byte_size) filter (where content_type like 'video/%'),0) into total, videos from private.media_cdn_objects;
  if total + p_size > s.budget_bytes then return 'budget_full'; end if;
  if p_content_type like 'video/%' and videos + p_size > s.video_budget_bytes then return 'budget_full'; end if;

  insert into private.media_cdn_objects (bucket_id, object_name, source_etag, byte_size, content_type, confirmed, reserved_at, origin, owner_user_id, media_kind)
  values (p_bucket, p_name, '', p_size, p_content_type, false, now(), 'direct', p_user, kind);
  return 'reserved';
exception when unique_violation then
  return 'invalid_name';
end;
$$;

-- Confirm after media-upload has read the object back from R2: exact size,
-- type, magic bytes, and for images the dimension rules of its kind.
create or replace function private.media_direct_confirm_v1(p_user uuid, p_bucket text, p_name text, p_size bigint, p_content_type text,
  p_sha256 text, p_width integer, p_height integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with done as (
    update private.media_cdn_objects
    set confirmed = true, mirrored_at = now(), sha256 = lower(p_sha256), width = p_width, height = p_height,
        binary_verified = (p_content_type like 'image/%')
    where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and not confirmed and byte_size = p_size and content_type = p_content_type
      and lower(coalesce(p_sha256,'')) ~ '^[0-9a-f]{64}$'
      and (p_content_type like 'video/%' or (p_width between 1 and 20000 and p_height between 1 and 20000))
    returning 1)
  select exists (select 1 from done);
$$;

-- Names (from p_names) that no column of any public/private table mentions.
-- Audit history and the media bookkeeping tables do not count as a use.
create or replace function private.media_unreferenced_v1(p_names text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r record; remaining text[] := coalesce(p_names, '{}');
begin
  if coalesce(array_length(remaining, 1), 0) = 0 then return '{}'; end if;
  for r in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema in ('public','private')
      and c.data_type in ('text','character varying','jsonb','json','ARRAY')
      and not (c.table_schema = 'private' and c.table_name in ('audit_log','catalog_media_binary_verifications_v2','media_cdn_objects','media_cdn_failures','media_cdn_settings'))
  loop
    execute format('select coalesce(array_agg(n), ''{}'') from unnest($1) n where not exists (select 1 from %I.%I x where strpos(x.%I::text, n) > 0)',
                   r.table_schema, r.table_name, r.column_name)
      into remaining using remaining;
    exit when coalesce(array_length(remaining, 1), 0) = 0;
  end loop;
  return remaining;
end;
$$;

create or replace function private.media_direct_releasable_v1(p_user uuid, p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare row private.media_cdn_objects;
begin
  select * into row from private.media_cdn_objects
  where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user;
  if row.id is null then return false; end if;
  if not row.confirmed then return true; end if;
  return coalesce(array_length(private.media_unreferenced_v1(array[p_name]), 1), 0) = 1;
end;
$$;

-- Called AFTER the object was deleted from R2, so the ledger still covers R2.
create or replace function private.media_direct_release_v1(p_user uuid, p_bucket text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.media_direct_releasable_v1(p_user, p_bucket, p_name) then return false; end if;
  delete from private.media_cdn_objects where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user;
  return found;
end;
$$;

-- 6. Adopting what still lands in Supabase (then it is deleted there) -------
create or replace function private.media_adopt_reserve_v1(p_bucket text, p_name text, p_etag text, p_size bigint, p_content_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare s private.media_cdn_settings; total bigint; owner uuid;
begin
  select * into s from private.media_cdn_settings where id for update;
  if not found or not s.enabled then return false; end if;
  select o.owner into owner from storage.objects o where o.bucket_id = p_bucket and o.name = p_name limit 1;
  if not exists (
    select 1 from private.media_cdn_sources_v1(p_bucket, p_name) src
    where src.source_etag = coalesce(p_etag,'') and src.byte_size = p_size and src.content_type = p_content_type and src.byte_size <= s.max_object_bytes) then
    return false;
  end if;
  if exists (select 1 from private.media_cdn_objects where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and confirmed) then return false; end if;
  select coalesce(sum(byte_size),0) into total from private.media_cdn_objects where not (bucket_id = p_bucket and object_name = p_name);
  if total + p_size > s.budget_bytes then return false; end if;
  insert into private.media_cdn_objects (bucket_id, object_name, source_etag, byte_size, content_type, confirmed, reserved_at, origin, owner_user_id, media_kind)
  values (p_bucket, p_name, coalesce(p_etag,''), p_size, p_content_type, false, now(), 'direct', owner, coalesce(private.media_direct_kind_v1(p_bucket, p_name), 'adopted'))
  on conflict (bucket_id, object_name) do update
    set source_etag = excluded.source_etag, byte_size = excluded.byte_size, content_type = excluded.content_type, confirmed = false,
        reserved_at = now(), mirrored_at = null, origin = 'direct', owner_user_id = excluded.owner_user_id, media_kind = excluded.media_kind,
        sha256 = null, width = null, height = null, binary_verified = false;
  return true;
end;
$$;

-- binary_verified is inherited only if the Supabase copy was verified by
-- catalog-media-verify (evaluated now, while that copy still exists).
create or replace function private.media_adopt_confirm_v1(p_bucket text, p_name text, p_etag text, p_sha256 text, p_width integer, p_height integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare verified boolean := false;
begin
  if p_bucket = 'catalog-public' then
    verified := exists (
      select 1 from storage.objects o join private.catalog_media_binary_verifications_v2 v on v.object_id = o.id
      where o.bucket_id = 'catalog-public' and o.name = p_name and v.object_path = p_name and v.sha256 = lower(p_sha256)
        and v.object_updated_at is not distinct from o.updated_at);
  end if;
  update private.media_cdn_objects
  set confirmed = true, mirrored_at = now(), sha256 = lower(p_sha256), width = p_width, height = p_height, binary_verified = verified
  where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and not confirmed and source_etag = coalesce(p_etag,'')
    and lower(coalesce(p_sha256,'')) ~ '^[0-9a-f]{64}$';
  if not found then return false; end if;
  delete from private.media_cdn_failures where bucket_id = p_bucket and object_name = p_name;
  return true;
end;
$$;

-- Objects removed from R2 by the worker leave the ledger here.
create or replace function private.media_cdn_forget_v1(p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from private.media_cdn_objects where bucket_id = p_bucket and object_name = p_name returning 1)
  select exists (select 1 from gone);
$$;

-- 7. The worker's plan -------------------------------------------------------
create or replace function private.media_cdn_plan_v1(p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s private.media_cdn_settings;
  total bigint;
  uploads jsonb; offloads jsonb; deletes jsonb; blocked integer;
begin
  select * into s from private.media_cdn_settings where id;
  if not found then raise exception 'media_cdn_settings_missing' using errcode = 'P0002'; end if;
  select coalesce(sum(byte_size),0) into total from private.media_cdn_objects;

  -- Legacy mirror copies whose source is gone (none are created any more).
  select coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket_id, 'name', g.object_name)), '[]'::jsonb) into deletes
  from (
    with src as materialized (select * from private.media_cdn_sources_v1())
    select m.bucket_id, m.object_name from private.media_cdn_objects m
    where m.origin = 'mirror' and not exists (select 1 from src where src.bucket_id = m.bucket_id and src.object_name = m.object_name)
    limit 50) g;

  -- Supabase copies whose R2 twin is confirmed: delete them from Supabase.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket_id, 'name', g.object_name)), '[]'::jsonb) into offloads
  from (
    select src.bucket_id, src.object_name
    from private.media_cdn_sources_v1() src
    join private.media_cdn_objects m on m.bucket_id = src.bucket_id and m.object_name = src.object_name and m.origin = 'direct' and m.confirmed
    where s.offload_sources
    limit 50) g;

  -- Supabase objects not yet in R2: adopt them.
  with candidates as (
    select src.*, coalesce(m.byte_size, 0) as previous_bytes
    from private.media_cdn_sources_v1() src
    left join private.media_cdn_objects m on m.bucket_id = src.bucket_id and m.object_name = src.object_name
    where src.byte_size <= s.max_object_bytes
      and src.created_at < now() - interval '2 minutes'
      and (m.object_name is null
           or m.origin = 'mirror'
           or (m.origin = 'direct' and not m.confirmed and m.reserved_at < now() - interval '10 minutes'))
      and not exists (
        select 1 from private.media_cdn_failures f
        where f.bucket_id = src.bucket_id and f.object_name = src.object_name and f.source_etag = src.source_etag
          and (f.attempts >= 3 or f.last_attempt_at > now() - (interval '10 minutes' * f.attempts)))
  ), ranked as (
    select c.*, total + sum(c.byte_size - c.previous_bytes) over (order by c.created_at, c.bucket_id, c.object_name) as projected
    from candidates c
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('bucket', r.bucket_id, 'name', r.object_name, 'etag', r.source_etag, 'size', r.byte_size, 'contentType', r.content_type) order by r.created_at)
              from (select * from ranked where projected <= s.budget_bytes order by created_at limit greatest(1, least(coalesce(p_limit, s.batch_size), s.batch_size))) r), '[]'::jsonb),
    (select count(*) from ranked where projected > s.budget_bytes)::integer
  into uploads, blocked;

  return jsonb_build_object(
    'enabled', s.enabled, 'accountId', s.r2_account_id, 'bucket', s.r2_bucket,
    'mirroredBytes', total, 'budgetBytes', s.budget_bytes, 'warnBytes', s.warn_bytes, 'maxObjectBytes', s.max_object_bytes,
    'budgetBlocked', blocked, 'uploads', uploads, 'offloads', offloads, 'deletes', deletes);
end;
$$;

-- Garbage: unfinished uploads after 1 hour; confirmed objects nothing refers
-- to after 72 hours. Each object's references are re-checked at most every 6
-- hours so the full scan stays rare.
create or replace function private.media_gc_candidates_v1(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare abandoned jsonb; due text[]; free text[]; unreferenced jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', object_name)), '[]'::jsonb) into abandoned
  from (select bucket_id, object_name from private.media_cdn_objects
        where origin = 'direct' and not confirmed and reserved_at < now() - interval '1 hour'
        order by reserved_at limit greatest(1, least(coalesce(p_limit, 50), 100))) a;

  select array_agg(object_name) into due from (
    select object_name from private.media_cdn_objects
    where origin = 'direct' and confirmed and reserved_at < now() - interval '72 hours'
      and (last_reference_check_at is null or last_reference_check_at < now() - interval '6 hours')
    order by last_reference_check_at nulls first, reserved_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))) d;
  if due is null then return jsonb_build_object('delete', abandoned); end if;

  update private.media_cdn_objects set last_reference_check_at = now() where origin = 'direct' and object_name = any(due);
  free := private.media_unreferenced_v1(due);
  select coalesce(jsonb_agg(jsonb_build_object('bucket', m.bucket_id, 'name', m.object_name)), '[]'::jsonb) into unreferenced
  from private.media_cdn_objects m where m.origin = 'direct' and m.object_name = any(free);
  return jsonb_build_object('delete', abandoned || unreferenced);
end;
$$;

create or replace function private.media_cdn_has_work_v1()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare plan jsonb;
begin
  if not exists (select 1 from private.media_cdn_settings where id and enabled) then return false; end if;
  if exists (select 1 from private.media_cdn_objects where origin = 'direct' and not confirmed and reserved_at < now() - interval '1 hour') then return true; end if;
  if exists (select 1 from private.media_cdn_objects where origin = 'direct' and confirmed and reserved_at < now() - interval '72 hours'
             and (last_reference_check_at is null or last_reference_check_at < now() - interval '6 hours')) then return true; end if;
  plan := private.media_cdn_plan_v1(1);
  return jsonb_array_length(plan->'uploads') > 0 or jsonb_array_length(plan->'offloads') > 0 or jsonb_array_length(plan->'deletes') > 0;
end;
$$;

-- Public URL of a confirmed R2 object (used by detail and safety payloads).
create or replace function private.media_public_url_v1(p_bucket text, p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.public_base_url || '/' || p_bucket || '/' || p_name
  from private.media_cdn_settings s
  where s.id and s.enabled and s.public_base_url is not null
    and p_name ~ '^[A-Za-z0-9._/-]+$'
    and exists (select 1 from private.media_cdn_objects m where m.bucket_id = p_bucket and m.object_name = p_name and m.origin = 'direct' and m.confirmed);
$$;

-- Videos: confirmed direct R2 videos only (the Supabase bucket takes images only).
create or replace function private.verified_product_video_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare normalized text := btrim(coalesce(p_path,''));
begin
  if normalized = '' or char_length(normalized) > 1200 or normalized ~* '^[a-z][a-z0-9+.-]*:' or normalized like '/%' then return null; end if;
  if exists (select 1 from unnest(string_to_array(normalized,'/')) part where part in ('','.','..')) then return null; end if;
  if exists (
    select 1 from private.media_cdn_objects m
    where m.bucket_id = 'catalog-public' and m.object_name = normalized and m.origin = 'direct' and m.confirmed
      and m.content_type in ('video/mp4','video/webm','video/quicktime') and m.byte_size between 1 and 52428800) then
    return normalized;
  end if;
  return null;
end;
$function$;

create or replace function private.super_admin_media_cdn_status_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare s private.media_cdn_settings; plan jsonb;
begin
  if auth.uid() is null or not coalesce(private.has_permission('product.health_manage'), false) then
    raise exception 'permission_required:product.health_manage' using errcode = '42501';
  end if;
  select * into s from private.media_cdn_settings where id;
  plan := private.media_cdn_plan_v1(50);
  return jsonb_build_object(
    'enabled', s.enabled, 'publicBaseUrl', s.public_base_url,
    'objectCount', (select count(*) from private.media_cdn_objects where confirmed),
    'imageCount', (select count(*) from private.media_cdn_objects where confirmed and content_type like 'image/%'),
    'videoCount', (select count(*) from private.media_cdn_objects where confirmed and content_type like 'video/%'),
    'storedBytes', plan->'mirroredBytes',
    'videoBytes', (select coalesce(sum(byte_size),0) from private.media_cdn_objects where content_type like 'video/%'),
    'budgetBytes', s.budget_bytes, 'videoBudgetBytes', s.video_budget_bytes, 'warnBytes', s.warn_bytes,
    'overWarning', (plan->>'mirroredBytes')::bigint >= s.warn_bytes,
    'budgetBlocked', plan->'budgetBlocked',
    'waitingInSupabase', jsonb_array_length(plan->'uploads') + jsonb_array_length(plan->'offloads'),
    'unfinishedUploads', (select count(*) from private.media_cdn_objects where origin = 'direct' and not confirmed),
    'failedObjects', (select count(*) from private.media_cdn_failures where attempts >= 3),
    'lastRunAt', s.last_run_at, 'lastRunStatus', s.last_run_status, 'lastRunDetail', s.last_run_detail);
end;
$$;

-- 8. Retire the pieces this replaces ---------------------------------------
drop function if exists public.service_media_video_reserve_v1(uuid,text,bigint,text);
drop function if exists public.service_media_video_confirm_v1(uuid,text,bigint,text);
drop function if exists public.service_media_video_release_v1(uuid,text);
drop function if exists public.service_media_video_releasable_v1(uuid,text);
drop function if exists private.media_video_reserve_v1(uuid,text,bigint,text);
drop function if exists private.media_video_confirm_v1(uuid,text,bigint,text);
drop function if exists private.media_video_release_v1(uuid,text);
drop function if exists private.media_video_releasable_v1(uuid,text);
drop function if exists private.media_direct_referenced_v1(text);
drop function if exists private.media_direct_video_name_ok_v1(text,text);
drop function if exists public.service_media_cdn_reserve_v1(text,text,text,bigint,text);
drop function if exists public.service_media_cdn_confirm_v1(text,text,text);
drop function if exists private.media_cdn_reserve_v1(text,text,text,bigint,text);
drop function if exists private.media_cdn_confirm_v1(text,text,text);

-- 9. Service wrappers and grants --------------------------------------------
create or replace function public.service_media_direct_reserve_v1(p_user uuid, p_bucket text, p_name text, p_size bigint, p_content_type text)
returns text language sql set search_path = '' as $$ select private.media_direct_reserve_v1(p_user, p_bucket, p_name, p_size, p_content_type); $$;
create or replace function public.service_media_direct_confirm_v1(p_user uuid, p_bucket text, p_name text, p_size bigint, p_content_type text, p_sha256 text, p_width integer, p_height integer)
returns boolean language sql set search_path = '' as $$ select private.media_direct_confirm_v1(p_user, p_bucket, p_name, p_size, p_content_type, p_sha256, p_width, p_height); $$;
create or replace function public.service_media_direct_releasable_v1(p_user uuid, p_bucket text, p_name text)
returns boolean language sql stable set search_path = '' as $$ select private.media_direct_releasable_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_direct_release_v1(p_user uuid, p_bucket text, p_name text)
returns boolean language sql set search_path = '' as $$ select private.media_direct_release_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_adopt_reserve_v1(p_bucket text, p_name text, p_etag text, p_size bigint, p_content_type text)
returns boolean language sql set search_path = '' as $$ select private.media_adopt_reserve_v1(p_bucket, p_name, p_etag, p_size, p_content_type); $$;
create or replace function public.service_media_adopt_confirm_v1(p_bucket text, p_name text, p_etag text, p_sha256 text, p_width integer, p_height integer)
returns boolean language sql set search_path = '' as $$ select private.media_adopt_confirm_v1(p_bucket, p_name, p_etag, p_sha256, p_width, p_height); $$;
create or replace function public.service_media_gc_candidates_v1(p_limit integer default 50)
returns jsonb language sql set search_path = '' as $$ select private.media_gc_candidates_v1(p_limit); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.media_direct_kind_v1(text,text)', 'private.media_extension_matches_v1(text,text)', 'private.media_direct_max_bytes_v1(text)',
    'private.media_direct_reserve_v1(uuid,text,text,bigint,text)', 'private.media_direct_confirm_v1(uuid,text,text,bigint,text,text,integer,integer)',
    'private.media_unreferenced_v1(text[])', 'private.media_direct_releasable_v1(uuid,text,text)', 'private.media_direct_release_v1(uuid,text,text)',
    'private.media_adopt_reserve_v1(text,text,text,bigint,text)', 'private.media_adopt_confirm_v1(text,text,text,text,integer,integer)',
    'private.media_gc_candidates_v1(integer)', 'private.media_cdn_forget_v1(text,text)',
    'public.service_media_direct_reserve_v1(uuid,text,text,bigint,text)', 'public.service_media_direct_confirm_v1(uuid,text,text,bigint,text,text,integer,integer)',
    'public.service_media_direct_releasable_v1(uuid,text,text)', 'public.service_media_direct_release_v1(uuid,text,text)',
    'public.service_media_adopt_reserve_v1(text,text,text,bigint,text)', 'public.service_media_adopt_confirm_v1(text,text,text,text,integer,integer)',
    'public.service_media_gc_candidates_v1(integer)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
