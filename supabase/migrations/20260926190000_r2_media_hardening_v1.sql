-- Hardening of the R2 media home after an independent review (2026-09-26).
--
-- 1. Uploads land on a private staging key first ("_incoming/<uuid>"). The
--    browser only ever gets a signed URL for that staging key; media-upload
--    checks the staged file (size first, then bytes) and copies it to the
--    final key itself. A signed URL can therefore never overwrite an approved
--    file, and a re-upload after finish/cancel only creates a staging object,
--    which the worker sweeps.
-- 2. Deleting is two-phase: a row is first marked (deleting_at, confirmed =
--    false, so every helper stops accepting the path in the same
--    transaction), then removed from R2, then forgotten. forget only removes
--    marked or unconfirmed rows.
-- 3. Garbage collection needs two scans at least 72 hours apart that both
--    find nothing referring to the file, only for files uploaded through the
--    app (never "adopted" free-form files), and works on (bucket, name) pairs.
-- 4. A user may cancel only their own upload, only while unconfirmed or
--    younger than 24 hours, which bounds the reference scans users can cause.
-- 5. Per-user daily upload cap (1 GiB) on direct uploads and on adoption.
-- 6. Offloading (deleting the Supabase copy of adopted files) is OFF until the
--    CDN address is built into every client; see ROADMAP "AÇMA SIRASI".
-- 7. Unverified catalogue images are adopted only after 30 minutes, so an
--    older app's verification call is never overtaken by adoption.

alter table private.media_cdn_settings alter column offload_sources set default false;
update private.media_cdn_settings set offload_sources = false where id;
alter table private.media_cdn_settings add column if not exists user_daily_bytes bigint not null default 1073741824;
alter table private.media_cdn_settings drop constraint if exists media_cdn_settings_user_daily_check;
alter table private.media_cdn_settings add constraint media_cdn_settings_user_daily_check check (user_daily_bytes between 0 and 4294967296);
alter table private.media_cdn_settings add column if not exists last_staging_sweep_at timestamptz;

alter table private.media_cdn_objects add column if not exists deleting_at timestamptz;
alter table private.media_cdn_objects add column if not exists first_unreferenced_at timestamptz;
alter table private.media_cdn_objects add column if not exists staging_key text;
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_staging_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_staging_check
  check (staging_key is null or staging_key ~ '^_incoming/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_deleting_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_deleting_check check (deleting_at is null or not confirmed);

-- Bytes a user started uploading in the last 24 hours (direct or adopted).
create or replace function private.media_user_recent_bytes_v1(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(byte_size), 0) from private.media_cdn_objects
  where owner_user_id = p_user and reserved_at > now() - interval '24 hours';
$$;

-- Reserve v2: as v1 plus the daily cap, and returns the staging key.
create or replace function private.media_direct_reserve_v2(p_user uuid, p_bucket text, p_name text, p_size bigint, p_content_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.media_cdn_settings;
  kind text := private.media_direct_kind_v1(p_bucket, p_name);
  producer public.producers%rowtype;
  total bigint; videos bigint; pending integer; staging text;
begin
  select * into s from private.media_cdn_settings where id for update;
  if not found or not s.enabled or s.public_base_url is null then return jsonb_build_object('status', 'not_configured'); end if;
  if p_user is null or kind is null or not private.media_extension_matches_v1(p_name, p_content_type) then return jsonb_build_object('status', 'invalid_name'); end if;
  if (kind like '%-video') <> (p_content_type like 'video/%') then return jsonb_build_object('status', 'invalid_name'); end if;
  if p_size is null or p_size < 1 or p_size > private.media_direct_max_bytes_v1(kind) then return jsonb_build_object('status', 'size_invalid'); end if;

  if kind in ('official-image','official-video','category-image') then
    if split_part(p_name, '/', 2) <> p_user::text then return jsonb_build_object('status', 'owner_mismatch'); end if;
  else
    select * into producer from public.producers pr where pr.id = split_part(p_name, '/', 1)::uuid and pr.deleted_at is null;
    if producer.id is null then return jsonb_build_object('status', 'owner_mismatch'); end if;
    if kind in ('product-image','product-video') then
      if producer.owner_user_id is distinct from p_user or producer.status <> 'active' or not producer.is_verified or not producer.origin_verified then
        return jsonb_build_object('status', 'owner_mismatch');
      end if;
    elsif kind in ('brand-logo','brand-cover') then
      if not producer.is_verified then return jsonb_build_object('status', 'owner_mismatch'); end if;
      if producer.store_kind = 'official' then
        if producer.status <> 'active' then return jsonb_build_object('status', 'owner_mismatch'); end if;
      elsif producer.owner_user_id is distinct from p_user or producer.status not in ('pending','active') then
        return jsonb_build_object('status', 'owner_mismatch');
      end if;
    elsif kind = 'event-image' then
      if producer.owner_user_id is distinct from p_user or not private.is_producer_trust_badge_active_v1(producer.id) then
        return jsonb_build_object('status', 'owner_mismatch');
      end if;
    end if;
  end if;

  select count(*) into pending from private.media_cdn_objects
  where origin = 'direct' and owner_user_id = p_user and not confirmed and deleting_at is null and reserved_at > now() - interval '1 hour';
  if pending >= 20 then return jsonb_build_object('status', 'too_many_pending'); end if;
  if private.media_user_recent_bytes_v1(p_user) + p_size > s.user_daily_bytes then return jsonb_build_object('status', 'daily_limit'); end if;
  select coalesce(sum(byte_size),0), coalesce(sum(byte_size) filter (where content_type like 'video/%'),0) into total, videos from private.media_cdn_objects;
  if total + p_size > s.budget_bytes then return jsonb_build_object('status', 'budget_full'); end if;
  if p_content_type like 'video/%' and videos + p_size > s.video_budget_bytes then return jsonb_build_object('status', 'budget_full'); end if;

  staging := '_incoming/' || gen_random_uuid()::text;
  insert into private.media_cdn_objects (bucket_id, object_name, source_etag, byte_size, content_type, confirmed, reserved_at, origin, owner_user_id, media_kind, staging_key)
  values (p_bucket, p_name, '', p_size, p_content_type, false, now(), 'direct', p_user, kind, staging);
  return jsonb_build_object('status', 'reserved', 'staging', staging);
exception when unique_violation then
  return jsonb_build_object('status', 'invalid_name');
end;
$$;

-- What media-upload needs to check a staged file against its reservation.
create or replace function private.media_direct_reservation_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('size', m.byte_size, 'contentType', m.content_type, 'staging', m.staging_key,
                            'confirmed', m.confirmed, 'deleting', m.deleting_at is not null)
  from private.media_cdn_objects m
  where m.bucket_id = p_bucket and m.object_name = p_name and m.origin = 'direct' and m.owner_user_id = p_user;
$$;

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
        binary_verified = (p_content_type like 'image/%'), staging_key = null
    where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and not confirmed and deleting_at is null and byte_size = p_size and content_type = p_content_type
      and lower(coalesce(p_sha256,'')) ~ '^[0-9a-f]{64}$'
      and (p_content_type like 'video/%' or (p_width between 1 and 20000 and p_height between 1 and 20000))
    returning 1)
  select exists (select 1 from done);
$$;

-- Phase 1 of a user's cancel: mark the row so no helper accepts the path any
-- more, in the same transaction as the ownership and reference checks.
-- Returns the keys to delete from R2, or null when the cancel is refused.
create or replace function private.media_direct_begin_release_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r private.media_cdn_objects;
begin
  select * into r from private.media_cdn_objects
  where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user
  for update;
  if r.id is null then return null; end if;
  if r.deleting_at is null then
    if r.confirmed then
      if r.reserved_at < now() - interval '24 hours' then return null; end if;
      if coalesce(array_length(private.media_unreferenced_v1(array[p_name]), 1), 0) = 0 then return null; end if;
    end if;
    update private.media_cdn_objects set deleting_at = now(), confirmed = false, binary_verified = false where id = r.id;
  end if;
  return jsonb_build_object('bucket', r.bucket_id, 'name', r.object_name, 'staging', r.staging_key);
end;
$$;

-- Phase 3: forget a row that was marked and deleted from R2.
create or replace function private.media_direct_finish_release_v1(p_user uuid, p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.media_cdn_objects
    where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user and deleting_at is not null
    returning 1)
  select exists (select 1 from gone);
$$;

-- The worker forgets only rows that are marked, unconfirmed, or legacy mirror copies.
create or replace function private.media_cdn_forget_v1(p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.media_cdn_objects
    where bucket_id = p_bucket and object_name = p_name and (deleting_at is not null or not confirmed or origin = 'mirror')
    returning 1)
  select exists (select 1 from gone);
$$;

-- Garbage v2. Returns rows already marked for deletion; each marking happens
-- here, in this transaction, together with its checks.
create or replace function private.media_gc_candidates_v2(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  due record; names text[]; free text[];
begin
  -- Unfinished uploads (never confirmed within an hour).
  update private.media_cdn_objects set deleting_at = now()
  where id in (select id from private.media_cdn_objects
               where origin = 'direct' and not confirmed and deleting_at is null and reserved_at < now() - interval '1 hour'
               order by reserved_at limit lim);

  -- Files uploaded through the app: two scans at least 72 hours apart must
  -- both find no reference. Adopted free-form files are never collected.
  select array_agg(object_name) into names from (
    select object_name from private.media_cdn_objects
    where origin = 'direct' and confirmed and deleting_at is null and media_kind is distinct from 'adopted'
      and reserved_at < now() - interval '72 hours'
      and (last_reference_check_at is null or last_reference_check_at < now() - interval '6 hours')
    order by last_reference_check_at nulls first, reserved_at
    limit lim) d;
  if names is not null then
    free := private.media_unreferenced_v1(names);
    update private.media_cdn_objects
    set last_reference_check_at = now(),
        first_unreferenced_at = case when object_name = any(free) then coalesce(first_unreferenced_at, now()) else null end
    where origin = 'direct' and confirmed and deleting_at is null and media_kind is distinct from 'adopted' and object_name = any(names);
    update private.media_cdn_objects
    set deleting_at = now(), confirmed = false, binary_verified = false
    where origin = 'direct' and confirmed and deleting_at is null and media_kind is distinct from 'adopted'
      and object_name = any(free) and first_unreferenced_at < now() - interval '72 hours';
  end if;

  return jsonb_build_object('delete', coalesce((
    select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', object_name, 'staging', staging_key))
    from (select bucket_id, object_name, staging_key from private.media_cdn_objects
          -- marked in this transaction (now() is its start time), or a deletion
          -- that got stuck more than 10 minutes ago; a user's cancel that is
          -- still in flight is left to that user's request
          where deleting_at = now() or deleting_at < now() - interval '10 minutes'
          order by deleting_at limit lim) x), '[]'::jsonb));
end;
$$;

-- Adoption respects the daily cap of the uploader too.
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
  if exists (select 1 from private.media_cdn_objects where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and (confirmed or deleting_at is not null)) then return false; end if;
  if owner is not null and private.media_user_recent_bytes_v1(owner) + p_size > s.user_daily_bytes then return false; end if;
  select coalesce(sum(byte_size),0) into total from private.media_cdn_objects where not (bucket_id = p_bucket and object_name = p_name);
  if total + p_size > s.budget_bytes then return false; end if;
  insert into private.media_cdn_objects (bucket_id, object_name, source_etag, byte_size, content_type, confirmed, reserved_at, origin, owner_user_id, media_kind)
  values (p_bucket, p_name, coalesce(p_etag,''), p_size, p_content_type, false, now(), 'direct', owner, coalesce(private.media_direct_kind_v1(p_bucket, p_name), 'adopted'))
  on conflict (bucket_id, object_name) do update
    set source_etag = excluded.source_etag, byte_size = excluded.byte_size, content_type = excluded.content_type, confirmed = false,
        reserved_at = now(), mirrored_at = null, origin = 'direct', owner_user_id = excluded.owner_user_id, media_kind = excluded.media_kind,
        sha256 = null, width = null, height = null, binary_verified = false, staging_key = null;
  return true;
end;
$$;

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
  where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and not confirmed and deleting_at is null
    and source_etag = coalesce(p_etag,'') and lower(coalesce(p_sha256,'')) ~ '^[0-9a-f]{64}$';
  if not found then return false; end if;
  delete from private.media_cdn_failures where bucket_id = p_bucket and object_name = p_name;
  return true;
end;
$$;

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

  select coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket_id, 'name', g.object_name)), '[]'::jsonb) into deletes
  from (
    with src as materialized (select * from private.media_cdn_sources_v1())
    select m.bucket_id, m.object_name from private.media_cdn_objects m
    where m.origin = 'mirror' and not exists (select 1 from src where src.bucket_id = m.bucket_id and src.object_name = m.object_name)
    limit 50) g;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket_id, 'name', g.object_name)), '[]'::jsonb) into offloads
  from (
    select src.bucket_id, src.object_name
    from private.media_cdn_sources_v1() src
    join private.media_cdn_objects m on m.bucket_id = src.bucket_id and m.object_name = src.object_name and m.origin = 'direct' and m.confirmed
    where s.offload_sources
    limit 50) g;

  with candidates as (
    select src.*, coalesce(m.byte_size, 0) as previous_bytes
    from private.media_cdn_sources_v1() src
    left join private.media_cdn_objects m on m.bucket_id = src.bucket_id and m.object_name = src.object_name
    where src.byte_size <= s.max_object_bytes
      and src.created_at < now() - interval '2 minutes'
      -- an older app verifies right after uploading; never adopt before that
      and (src.bucket_id <> 'catalog-public' or src.created_at < now() - interval '30 minutes'
           or exists (select 1 from private.catalog_media_binary_verifications_v2 v where v.bucket_id = 'catalog-public' and v.object_path = src.object_name))
      and (m.object_name is null
           or m.origin = 'mirror'
           or (m.origin = 'direct' and not m.confirmed and m.deleting_at is null and m.reserved_at < now() - interval '10 minutes'))
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
    'budgetBlocked', blocked, 'offloadSources', s.offload_sources,
    'stagingSweepDue', s.last_staging_sweep_at is null or s.last_staging_sweep_at < now() - interval '6 hours',
    'uploads', uploads, 'offloads', offloads, 'deletes', deletes);
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
  if exists (select 1 from private.media_cdn_settings where id and (last_staging_sweep_at is null or last_staging_sweep_at < now() - interval '6 hours')) then return true; end if;
  if exists (select 1 from private.media_cdn_objects where deleting_at is not null) then return true; end if;
  if exists (select 1 from private.media_cdn_objects where origin = 'direct' and not confirmed and reserved_at < now() - interval '1 hour') then return true; end if;
  if exists (select 1 from private.media_cdn_objects where origin = 'direct' and confirmed and media_kind is distinct from 'adopted'
             and reserved_at < now() - interval '72 hours'
             and (last_reference_check_at is null or last_reference_check_at < now() - interval '6 hours')) then return true; end if;
  plan := private.media_cdn_plan_v1(1);
  return jsonb_array_length(plan->'uploads') > 0 or jsonb_array_length(plan->'offloads') > 0 or jsonb_array_length(plan->'deletes') > 0;
end;
$$;

create or replace function private.media_staging_swept_v1()
returns void
language sql
security definer
set search_path = ''
as $$
  update private.media_cdn_settings set last_staging_sweep_at = now() where id;
$$;

-- Service wrappers; the replaced ones are dropped.
drop function if exists public.service_media_direct_reserve_v1(uuid,text,text,bigint,text);
drop function if exists private.media_direct_reserve_v1(uuid,text,text,bigint,text);
drop function if exists public.service_media_direct_releasable_v1(uuid,text,text);
drop function if exists public.service_media_direct_release_v1(uuid,text,text);
drop function if exists private.media_direct_release_v1(uuid,text,text);
drop function if exists private.media_direct_releasable_v1(uuid,text,text);
drop function if exists public.service_media_gc_candidates_v1(integer);
drop function if exists private.media_gc_candidates_v1(integer);

create or replace function public.service_media_direct_reserve_v2(p_user uuid, p_bucket text, p_name text, p_size bigint, p_content_type text)
returns jsonb language sql set search_path = '' as $$ select private.media_direct_reserve_v2(p_user, p_bucket, p_name, p_size, p_content_type); $$;
create or replace function public.service_media_direct_reservation_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb language sql stable set search_path = '' as $$ select private.media_direct_reservation_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_direct_begin_release_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb language sql set search_path = '' as $$ select private.media_direct_begin_release_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_direct_finish_release_v1(p_user uuid, p_bucket text, p_name text)
returns boolean language sql set search_path = '' as $$ select private.media_direct_finish_release_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_gc_candidates_v2(p_limit integer default 50)
returns jsonb language sql set search_path = '' as $$ select private.media_gc_candidates_v2(p_limit); $$;
create or replace function public.service_media_staging_swept_v1()
returns void language sql set search_path = '' as $$ select private.media_staging_swept_v1(); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.media_user_recent_bytes_v1(uuid)', 'private.media_direct_reserve_v2(uuid,text,text,bigint,text)',
    'private.media_direct_reservation_v1(uuid,text,text)', 'private.media_direct_begin_release_v1(uuid,text,text)',
    'private.media_direct_finish_release_v1(uuid,text,text)', 'private.media_gc_candidates_v2(integer)', 'private.media_staging_swept_v1()',
    'public.service_media_direct_reserve_v2(uuid,text,text,bigint,text)', 'public.service_media_direct_reservation_v1(uuid,text,text)',
    'public.service_media_direct_begin_release_v1(uuid,text,text)', 'public.service_media_direct_finish_release_v1(uuid,text,text)',
    'public.service_media_gc_candidates_v2(integer)', 'public.service_media_staging_swept_v1()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
