-- Fixes from the independent review of r2_media_hardening_v1 (2026-09-26).
--
-- 1. finish racing cancel or the garbage collector could leave a public file
--    in R2 with no ledger row. finish now CLAIMS the row first
--    (media_direct_begin_publish_v1); while the claim is fresh neither cancel
--    nor the collector touches the row, and confirm requires the claim.
-- 2. Staging keys lived in the public bucket. They now live in a separate,
--    never-public bucket (r2_staging_bucket), and the signed upload URL also
--    signs Content-Length, so a device cannot upload more than it reserved.
--    sign_content_length exists only as an emergency switch.
-- 3. Cancelling refunded the daily allowance. Usage is now an append-only
--    record (media_upload_usage) that cancel and refusals do not touch.
-- 4. The collector could delete a file saved while it was scanning. A file
--    that was usable is now only MARKED; it is deleted at least 10 minutes
--    later, after a second reference check, and restored if anything uses it.
--    A user's own cancel of a usable file goes the same slow way.
-- 5. A retried finish could delete the file the first finish confirmed.
--    Refusals now release only unconfirmed rows.

alter table private.media_cdn_settings add column if not exists r2_staging_bucket text not null default 'golden-oremar-incoming';
alter table private.media_cdn_settings drop constraint if exists media_cdn_settings_staging_bucket_check;
alter table private.media_cdn_settings add constraint media_cdn_settings_staging_bucket_check
  check (r2_staging_bucket ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' and r2_staging_bucket is distinct from r2_bucket);
alter table private.media_cdn_settings add column if not exists sign_content_length boolean not null default true;

alter table private.media_cdn_objects add column if not exists publishing_at timestamptz;
alter table private.media_cdn_objects add column if not exists delete_after timestamptz;
alter table private.media_cdn_objects add column if not exists restore_binary_verified boolean;
update private.media_cdn_objects set delete_after = deleting_at where deleting_at is not null and delete_after is null;
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_delete_after_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_delete_after_check
  check ((deleting_at is null) = (delete_after is null));

create table if not exists private.media_upload_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  byte_size bigint not null check (byte_size > 0),
  used_at timestamptz not null default now()
);
create index if not exists media_upload_usage_user_time_idx on private.media_upload_usage (user_id, used_at);
alter table private.media_upload_usage enable row level security;
revoke all on table private.media_upload_usage from public, anon, authenticated;

create or replace function private.media_user_recent_bytes_v1(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(byte_size), 0) from private.media_upload_usage
  where user_id = p_user and used_at > now() - interval '24 hours';
$$;

create or replace function private.media_cdn_target_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', s.enabled,
    'accountId', s.r2_account_id,
    'bucket', s.r2_bucket,
    'stagingBucket', s.r2_staging_bucket,
    'signContentLength', s.sign_content_length,
    'publicBaseUrl', s.public_base_url,
    'maxVideoBytes', s.max_video_bytes)
  from private.media_cdn_settings s where s.id;
$$;

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
  -- Counted when reserved and never refunded: a refused or cancelled upload
  -- still used the allowance.
  insert into private.media_upload_usage (user_id, byte_size) values (p_user, p_size);
  return jsonb_build_object('status', 'reserved', 'staging', staging);
exception when unique_violation then
  return jsonb_build_object('status', 'invalid_name');
end;
$$;

-- finish takes this before reading anything. Only one finish at a time, and
-- while the claim is fresh (5 minutes, longer than any edge function run) the
-- row cannot be cancelled or collected.
create or replace function private.media_direct_begin_publish_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  update private.media_cdn_objects
  set publishing_at = now()
  where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user
    and not confirmed and deleting_at is null and staging_key is not null
    and (publishing_at is null or publishing_at < now() - interval '5 minutes')
  returning jsonb_build_object('size', byte_size, 'contentType', content_type, 'staging', staging_key);
$$;

create or replace function private.media_direct_end_publish_v1(p_user uuid, p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with done as (
    update private.media_cdn_objects set publishing_at = null
    where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user and not confirmed
    returning 1)
  select exists (select 1 from done);
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
        binary_verified = (p_content_type like 'image/%'), staging_key = null, publishing_at = null
    where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and not confirmed and deleting_at is null and publishing_at is not null
      and byte_size = p_size and content_type = p_content_type
      and lower(coalesce(p_sha256,'')) ~ '^[0-9a-f]{64}$'
      and (p_content_type like 'video/%' or (p_width between 1 and 20000 and p_height between 1 and 20000))
    returning 1)
  select exists (select 1 from done);
$$;

-- Release by the owner.
--   unconfirmed, not being published -> marked, deferred=false: the caller
--     deletes R2 now (nothing can reference an unconfirmed file);
--   confirmed (only when p_allow_confirmed, within a day, unreferenced now)
--     -> marked, deferred=true: the collector deletes it after a second
--     reference check at least 10 minutes later;
--   being published, not owned, or in use -> null.
create or replace function private.media_direct_begin_release_v2(p_user uuid, p_bucket text, p_name text, p_allow_confirmed boolean)
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
  if r.deleting_at is not null then
    return jsonb_build_object('bucket', r.bucket_id, 'name', r.object_name, 'staging', r.staging_key, 'deferred', true);
  end if;
  if r.confirmed then
    if not coalesce(p_allow_confirmed, false) or r.reserved_at < now() - interval '24 hours' then return null; end if;
    if coalesce(array_length(private.media_unreferenced_v1(array[p_name]), 1), 0) = 0 then return null; end if;
    update private.media_cdn_objects
    set deleting_at = now(), delete_after = now() + interval '10 minutes', restore_binary_verified = r.binary_verified,
        confirmed = false, binary_verified = false
    where id = r.id;
    return jsonb_build_object('bucket', r.bucket_id, 'name', r.object_name, 'staging', r.staging_key, 'deferred', true);
  end if;
  if r.publishing_at is not null and r.publishing_at > now() - interval '5 minutes' then return null; end if;
  update private.media_cdn_objects
  set deleting_at = now(), delete_after = now() + interval '10 minutes', restore_binary_verified = null
  where id = r.id;
  return jsonb_build_object('bucket', r.bucket_id, 'name', r.object_name, 'staging', r.staging_key, 'deferred', false);
end;
$$;

create or replace function private.media_direct_finish_release_v1(p_user uuid, p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.media_cdn_objects
    where bucket_id = p_bucket and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and deleting_at is not null and restore_binary_verified is null
    returning 1)
  select exists (select 1 from gone);
$$;

create or replace function private.media_direct_reservation_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('size', m.byte_size, 'contentType', m.content_type, 'staging', m.staging_key,
                            'confirmed', m.confirmed, 'deleting', m.deleting_at is not null,
                            'publishing', m.publishing_at is not null and m.publishing_at > now() - interval '5 minutes')
  from private.media_cdn_objects m
  where m.bucket_id = p_bucket and m.object_name = p_name and m.origin = 'direct' and m.owner_user_id = p_user;
$$;

-- The collector. Marks, re-checks, and hands back only what is safe to delete.
create or replace function private.media_gc_candidates_v3(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  names text[]; free text[]; due text[]; still_free text[];
begin
  -- Unfinished uploads: never confirmed, so nothing can reference them.
  update private.media_cdn_objects
  set deleting_at = now(), delete_after = now(), restore_binary_verified = null
  where id in (select id from private.media_cdn_objects
               where origin = 'direct' and not confirmed and deleting_at is null and reserved_at < now() - interval '1 hour'
                 and (publishing_at is null or publishing_at < now() - interval '10 minutes')
               order by reserved_at limit lim);

  -- Files nothing refers to: first sighting, then a second one 72 h later.
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
    -- Marked, not deleted: a save that checked the file just before this
    -- statement may still commit. The second check below catches it.
    update private.media_cdn_objects
    set deleting_at = now(), delete_after = now() + interval '10 minutes', restore_binary_verified = binary_verified,
        confirmed = false, binary_verified = false
    where origin = 'direct' and confirmed and deleting_at is null and media_kind is distinct from 'adopted'
      and object_name = any(free) and first_unreferenced_at < now() - interval '72 hours';
  end if;

  -- Second check for files that were usable when marked.
  select array_agg(object_name) into due from (
    select object_name from private.media_cdn_objects
    where deleting_at is not null and delete_after <= now() and restore_binary_verified is not null
    limit lim) d;
  if due is not null then
    still_free := coalesce(private.media_unreferenced_v1(due), '{}');
    update private.media_cdn_objects
    set deleting_at = null, delete_after = null, confirmed = true, binary_verified = restore_binary_verified,
        restore_binary_verified = null, first_unreferenced_at = null, last_reference_check_at = now()
    where deleting_at is not null and restore_binary_verified is not null and object_name = any(due) and not (object_name = any(still_free));
  end if;

  -- The allowance record only needs a day; keep three.
  delete from private.media_upload_usage where used_at < now() - interval '3 days';

  return jsonb_build_object('delete', coalesce((
    select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', object_name, 'staging', staging_key))
    from (select bucket_id, object_name, staging_key from private.media_cdn_objects
          where deleting_at is not null and delete_after <= now()
            and (restore_binary_verified is null or object_name = any(coalesce(still_free, '{}')))
          order by delete_after limit lim) x), '[]'::jsonb));
end;
$$;

-- The row may go only once it is marked (or never was usable).
create or replace function private.media_cdn_forget_v1(p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.media_cdn_objects
    where bucket_id = p_bucket and object_name = p_name
      and ((deleting_at is not null and delete_after <= now()) or (not confirmed and deleting_at is null) or origin = 'mirror')
    returning 1)
  select exists (select 1 from gone);
$$;

create or replace function private.media_adopt_confirm_v1(p_bucket text, p_name text, p_etag text, p_sha256 text, p_width integer, p_height integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare verified boolean := false; r private.media_cdn_objects;
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
    and source_etag = coalesce(p_etag,'') and lower(coalesce(p_sha256,'')) ~ '^[0-9a-f]{64}$'
  returning * into r;
  if r.id is null then return false; end if;
  if r.owner_user_id is not null then
    insert into private.media_upload_usage (user_id, byte_size) values (r.owner_user_id, r.byte_size);
  end if;
  delete from private.media_cdn_failures where bucket_id = p_bucket and object_name = p_name;
  return true;
end;
$$;

-- Plan: same as r2_media_hardening_v1 plus the staging bucket and a sweep
-- that stays due while recent uploads may have left staging keys.
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
      and (src.bucket_id <> 'catalog-public' or src.created_at < now() - interval '30 minutes'
           or exists (select 1 from private.catalog_media_binary_verifications_v2 v where v.bucket_id = 'catalog-public' and v.object_path = src.object_name))
      and (m.object_name is null
           or m.origin = 'mirror'
           or (m.origin = 'direct' and not m.confirmed and m.deleting_at is null and m.reserved_at < now() - interval '10 minutes'
               and m.staging_key is null))
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
    'enabled', s.enabled, 'accountId', s.r2_account_id, 'bucket', s.r2_bucket, 'stagingBucket', s.r2_staging_bucket,
    'mirroredBytes', total, 'budgetBytes', s.budget_bytes, 'warnBytes', s.warn_bytes, 'maxObjectBytes', s.max_object_bytes,
    'budgetBlocked', blocked, 'offloadSources', s.offload_sources,
    'stagingSweepDue', private.media_staging_sweep_due_v1(),
    'uploads', uploads, 'offloads', offloads, 'deletes', deletes);
end;
$$;

-- A staging key can exist at most ~10 minutes after its reservation (URL
-- lifetime), and the sweep deletes keys older than 15 minutes. So after any
-- upload the sweep stays due until one runs 30 minutes later; otherwise every
-- 6 hours as a safety net.
create or replace function private.media_staging_sweep_due_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select s.last_staging_sweep_at is null
      or s.last_staging_sweep_at < now() - interval '6 hours'
      or exists (select 1 from private.media_upload_usage u where u.used_at > s.last_staging_sweep_at - interval '30 minutes')
  from private.media_cdn_settings s where s.id;
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
  if private.media_staging_sweep_due_v1() then return true; end if;
  if exists (select 1 from private.media_cdn_objects where deleting_at is not null and delete_after <= now()) then return true; end if;
  if exists (select 1 from private.media_cdn_objects where origin = 'direct' and not confirmed and deleting_at is null and reserved_at < now() - interval '1 hour') then return true; end if;
  if exists (select 1 from private.media_cdn_objects where origin = 'direct' and confirmed and media_kind is distinct from 'adopted'
             and reserved_at < now() - interval '72 hours'
             and (last_reference_check_at is null or last_reference_check_at < now() - interval '6 hours')) then return true; end if;
  plan := private.media_cdn_plan_v1(1);
  return jsonb_array_length(plan->'uploads') > 0 or jsonb_array_length(plan->'offloads') > 0 or jsonb_array_length(plan->'deletes') > 0;
end;
$$;

drop function if exists public.service_media_direct_begin_release_v1(uuid,text,text);
drop function if exists private.media_direct_begin_release_v1(uuid,text,text);
drop function if exists public.service_media_gc_candidates_v2(integer);
drop function if exists private.media_gc_candidates_v2(integer);

create or replace function public.service_media_direct_begin_publish_v1(p_user uuid, p_bucket text, p_name text)
returns jsonb language sql set search_path = '' as $$ select private.media_direct_begin_publish_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_direct_end_publish_v1(p_user uuid, p_bucket text, p_name text)
returns boolean language sql set search_path = '' as $$ select private.media_direct_end_publish_v1(p_user, p_bucket, p_name); $$;
create or replace function public.service_media_direct_begin_release_v2(p_user uuid, p_bucket text, p_name text, p_allow_confirmed boolean)
returns jsonb language sql set search_path = '' as $$ select private.media_direct_begin_release_v2(p_user, p_bucket, p_name, p_allow_confirmed); $$;
create or replace function public.service_media_gc_candidates_v3(p_limit integer default 50)
returns jsonb language sql set search_path = '' as $$ select private.media_gc_candidates_v3(p_limit); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.media_direct_begin_publish_v1(uuid,text,text)', 'private.media_direct_end_publish_v1(uuid,text,text)',
    'private.media_direct_begin_release_v2(uuid,text,text,boolean)', 'private.media_gc_candidates_v3(integer)',
    'private.media_staging_sweep_due_v1()',
    'public.service_media_direct_begin_publish_v1(uuid,text,text)', 'public.service_media_direct_end_publish_v1(uuid,text,text)',
    'public.service_media_direct_begin_release_v2(uuid,text,text,boolean)', 'public.service_media_gc_candidates_v3(integer)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
