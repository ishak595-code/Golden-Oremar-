-- Product videos live only in Cloudflare R2.
--
-- Images are small and keep their verified original in Supabase Storage (the
-- binary verifier and every readiness check are built on it); customers
-- download them from R2 (migration add_media_cdn_mirror_v1). Videos are the
-- opposite: up to 50 MB each, and twenty of them would fill the whole free
-- Supabase storage allowance. So a video never touches Supabase at all:
--
--   1. edge function media-video-upload authorises the uploader, reserves the
--      bytes here (origin 'direct') and hands out a short-lived signed PUT URL;
--   2. the browser uploads straight to R2;
--   3. the function checks size, type and the file's own magic bytes in R2,
--      then confirms the reservation.
--
-- The ledger stays a superset of R2, so the R2 budget holds for videos too,
-- with its own sub-budget (3 GiB by default) so videos can never crowd out
-- product photos. Abandoned or replaced videos are removed automatically.

alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_content_type_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_content_type_check
  check (content_type in ('image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime'));
alter table private.media_cdn_objects add column if not exists origin text not null default 'mirror';
alter table private.media_cdn_objects add column if not exists owner_user_id uuid;
alter table private.media_cdn_objects drop constraint if exists media_cdn_objects_origin_check;
alter table private.media_cdn_objects add constraint media_cdn_objects_origin_check check (
  (origin = 'mirror' and content_type like 'image/%')
  or (origin = 'direct' and content_type like 'video/%' and bucket_id = 'catalog-public' and owner_user_id is not null));

alter table private.media_cdn_settings add column if not exists video_budget_bytes bigint not null default 3221225472;
alter table private.media_cdn_settings add column if not exists max_video_bytes bigint not null default 52428800;
alter table private.media_cdn_settings drop constraint if exists media_cdn_settings_video_budget_check;
alter table private.media_cdn_settings add constraint media_cdn_settings_video_budget_check
  check (video_budget_bytes between 0 and 4294967296 and video_budget_bytes <= budget_bytes);
alter table private.media_cdn_settings drop constraint if exists media_cdn_settings_max_video_check;
alter table private.media_cdn_settings add constraint media_cdn_settings_max_video_check check (max_video_bytes between 1 and 52428800);

-- Nothing but images may be stored in the public Supabase catalogue bucket
-- from now on. There are no video files in it (checked 2026-09-26).
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'], file_size_limit = 10485760
where id = 'catalog-public';

-- The only shapes a direct video may have, matching the upsert functions.
create or replace function private.media_direct_video_name_ok_v1(p_name text, p_content_type text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|webm|mov)$'
     or p_name ~ '^admin/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/official-products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|webm|mov)$')
    and ((p_content_type = 'video/mp4' and p_name like '%.mp4')
      or (p_content_type = 'video/webm' and p_name like '%.webm')
      or (p_content_type = 'video/quicktime' and p_name like '%.mov')), false);
$$;

-- Is a direct video still used anywhere a product can point at it?
create or replace function private.media_direct_referenced_v1(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.products p where strpos(coalesce(p.specifications::text,''), p_name) > 0)
      or exists (select 1 from public.product_change_requests r where strpos(coalesce(r.proposed_payload::text,''), p_name) > 0)
      or exists (select 1 from private.product_editorial_drafts d where strpos(coalesce(d.payload::text,''), p_name) > 0)
      or exists (select 1 from private.product_public_content_archives a where strpos(coalesce(a.specifications::text,''), p_name) > 0);
$$;

-- Public URL of a confirmed R2 object, or null when the CDN is not set up.
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
    and exists (select 1 from private.media_cdn_objects m where m.bucket_id = p_bucket and m.object_name = p_name and m.confirmed);
$$;

-- Plan v1, now aware of direct videos: the "source is gone" rule applies only
-- to mirrored images; direct videos are removed when abandoned (never
-- confirmed within an hour) or no longer referenced a day after upload.
create or replace function private.media_cdn_plan_v1(p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s private.media_cdn_settings;
  mirrored bigint;
  uploads jsonb;
  deletes jsonb;
  blocked integer;
begin
  select * into s from private.media_cdn_settings where id;
  if not found then raise exception 'media_cdn_settings_missing' using errcode = 'P0002'; end if;
  select coalesce(sum(byte_size),0) into mirrored from private.media_cdn_objects;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket_id, 'name', g.object_name) order by g.reserved_at), '[]'::jsonb)
  into deletes
  from (
    (with src as materialized (select * from private.media_cdn_sources_v1())
     select m.bucket_id, m.object_name, m.reserved_at
     from private.media_cdn_objects m
     where m.origin = 'mirror'
       and not exists (select 1 from src where src.bucket_id = m.bucket_id and src.object_name = m.object_name)
     order by m.reserved_at
     limit 50)
    union all
    (select m.bucket_id, m.object_name, m.reserved_at
     from private.media_cdn_objects m
     where m.origin = 'direct'
       and ((not m.confirmed and m.reserved_at < now() - interval '1 hour')
         or (m.confirmed and m.reserved_at < now() - interval '24 hours' and not private.media_direct_referenced_v1(m.object_name)))
     order by m.reserved_at
     limit 20)
  ) g;

  with candidates as (
    select src.*, coalesce(m.byte_size, 0) as previous_bytes
    from private.media_cdn_sources_v1() src
    left join private.media_cdn_objects m on m.bucket_id = src.bucket_id and m.object_name = src.object_name
    where src.byte_size <= s.max_object_bytes
      and src.created_at < now() - interval '2 minutes'
      and (m.object_name is null
           or (m.origin = 'mirror' and m.source_etag <> src.source_etag)
           or (m.origin = 'mirror' and m.confirmed = false and m.reserved_at < now() - interval '10 minutes'))
      and not exists (
        select 1 from private.media_cdn_failures f
        where f.bucket_id = src.bucket_id and f.object_name = src.object_name and f.source_etag = src.source_etag
          and (f.attempts >= 3 or f.last_attempt_at > now() - (interval '10 minutes' * f.attempts)))
  ), ranked as (
    select c.*, mirrored + sum(c.byte_size - c.previous_bytes) over (order by c.created_at, c.bucket_id, c.object_name) as projected
    from candidates c
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('bucket', r.bucket_id, 'name', r.object_name, 'etag', r.source_etag, 'size', r.byte_size, 'contentType', r.content_type) order by r.created_at)
              from (select * from ranked where projected <= s.budget_bytes order by created_at limit greatest(1, least(coalesce(p_limit, s.batch_size), s.batch_size))) r), '[]'::jsonb),
    (select count(*) from ranked where projected > s.budget_bytes)::integer
  into uploads, blocked;

  return jsonb_build_object(
    'enabled', s.enabled,
    'accountId', s.r2_account_id,
    'bucket', s.r2_bucket,
    'mirroredBytes', mirrored,
    'budgetBytes', s.budget_bytes,
    'warnBytes', s.warn_bytes,
    'maxObjectBytes', s.max_object_bytes,
    'budgetBlocked', blocked,
    'uploads', uploads,
    'deletes', deletes);
end;
$$;

-- Reserve room for one direct video. Authorisation of the caller happens in
-- the edge function (same rules as catalog-media-verify); ownership of the
-- path is checked again here so the database never trusts it blindly.
create or replace function private.media_video_reserve_v1(p_user uuid, p_name text, p_size bigint, p_content_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare s private.media_cdn_settings; total bigint; videos bigint; pending integer; producer_id uuid;
begin
  select * into s from private.media_cdn_settings where id for update;
  if not found or not s.enabled or s.public_base_url is null then return 'not_configured'; end if;
  if p_user is null or not private.media_direct_video_name_ok_v1(p_name, p_content_type) then return 'invalid_name'; end if;
  if p_size is null or p_size < 1 or p_size > s.max_video_bytes then return 'size_invalid'; end if;
  if p_name like 'admin/%' then
    if split_part(p_name, '/', 2) <> p_user::text then return 'owner_mismatch'; end if;
  else
    producer_id := split_part(p_name, '/', 1)::uuid;
    if not exists (select 1 from public.producers pr where pr.id = producer_id and pr.owner_user_id = p_user and pr.status = 'active' and pr.deleted_at is null) then
      return 'owner_mismatch';
    end if;
  end if;
  select count(*) into pending from private.media_cdn_objects
  where origin = 'direct' and owner_user_id = p_user and not confirmed and reserved_at > now() - interval '1 hour';
  if pending >= 3 then return 'too_many_pending'; end if;
  select coalesce(sum(byte_size),0), coalesce(sum(byte_size) filter (where content_type like 'video/%'),0) into total, videos from private.media_cdn_objects;
  if total + p_size > s.budget_bytes or videos + p_size > s.video_budget_bytes then return 'budget_full'; end if;
  insert into private.media_cdn_objects (bucket_id, object_name, source_etag, byte_size, content_type, confirmed, reserved_at, origin, owner_user_id)
  values ('catalog-public', p_name, '', p_size, p_content_type, false, now(), 'direct', p_user);
  return 'reserved';
exception when unique_violation then
  return 'invalid_name';
end;
$$;

-- Confirm after the function has seen the object in R2 with the reserved
-- size and type.
create or replace function private.media_video_confirm_v1(p_user uuid, p_name text, p_size bigint, p_content_type text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with done as (
    update private.media_cdn_objects set confirmed = true, mirrored_at = now()
    where bucket_id = 'catalog-public' and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and not confirmed and byte_size = p_size and content_type = p_content_type
    returning 1)
  select exists (select 1 from done);
$$;

-- The uploader may release their own video while it is not used by a product.
-- Called AFTER the R2 object was deleted, so the ledger still covers R2.
create or replace function private.media_video_release_v1(p_user uuid, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.media_cdn_objects
    where bucket_id = 'catalog-public' and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and (not confirmed or not private.media_direct_referenced_v1(p_name))
    returning 1)
  select exists (select 1 from gone);
$$;

create or replace function private.media_video_releasable_v1(p_user uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.media_cdn_objects
    where bucket_id = 'catalog-public' and object_name = p_name and origin = 'direct' and owner_user_id = p_user
      and (not confirmed or not private.media_direct_referenced_v1(p_name)));
$$;

-- A product video is valid when it is a confirmed R2 video, or (legacy) a
-- video object in Supabase Storage. The public bucket no longer accepts
-- videos, so the legacy branch only covers history.
create or replace function private.verified_product_video_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized text := btrim(coalesce(p_path,''));
  mime text;
  size_bytes bigint;
begin
  if normalized = '' or char_length(normalized) > 1200 or normalized ~* '^[a-z][a-z0-9+.-]*:' or normalized like '/%' then return null; end if;
  if exists (select 1 from unnest(string_to_array(normalized,'/')) part where part in ('','.','..')) then return null; end if;
  if exists (
    select 1 from private.media_cdn_objects m
    where m.bucket_id = 'catalog-public' and m.object_name = normalized and m.origin = 'direct' and m.confirmed
      and m.content_type in ('video/mp4','video/webm','video/quicktime') and m.byte_size between 1 and 52428800) then
    return normalized;
  end if;
  select lower(coalesce(o.metadata->>'mimetype','')), nullif(o.metadata->>'size','')::bigint
    into mime, size_bytes
  from storage.objects o
  where o.bucket_id = 'catalog-public' and o.name = normalized
  limit 1;
  if mime not in ('video/mp4','video/webm','video/quicktime') then return null; end if;
  if size_bytes is null or size_bytes <= 0 or size_bytes > 52428800 then return null; end if;
  return normalized;
exception when others then
  return null;
end;
$function$;

-- Product detail v10: a file video is shown only when it is a verified video
-- (previously any object at that path), and carries its CDN URL.
create or replace function private.get_public_product_detail_v10(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  base jsonb := private.get_public_product_detail_v9(p_reference);
  product_id uuid;
  raw_video text;
  store_kind text;
begin
  if base = '{}'::jsonb then return base; end if;
  begin
    product_id := (base->>'id')::uuid;
  exception when others then
    product_id := private.resolve_product_id_v1(p_reference);
  end;
  if product_id is null then return base; end if;

  select nullif(btrim(coalesce(p.specifications->>'video','')),''), pr.store_kind
    into raw_video, store_kind
  from public.products p
  join public.producers pr on pr.id = p.producer_id
  where p.id = product_id;

  if raw_video is null or char_length(raw_video) > 2000 then return base; end if;

  if private.is_youtube_video_url_v1(raw_video) then
    if store_kind = 'official' then
      return base || jsonb_build_object('video', jsonb_build_object('kind','youtube','url',raw_video));
    end if;
    return base;
  end if;

  if raw_video !~ '^[a-z]+:' and private.verified_product_video_path_v1(raw_video) is not null then
    return base || jsonb_build_object('video', jsonb_build_object('kind','file','path',raw_video,
      'url', private.media_public_url_v1('catalog-public', raw_video)));
  end if;

  return base;
end;
$function$;

create or replace function private.get_public_product_safety_v3(p_reference text, p_locale text default 'tr'::text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  base jsonb:=private.get_public_product_safety_v2(p_reference,p_locale);
  content_id uuid;
  product_id uuid;
  video_path text;
begin
  if base='{}'::jsonb then return base; end if;
  begin content_id:=(base->>'contentId')::uuid; exception when others then return base; end;
  select ce.related_product_id into product_id from public.content_entries ce where ce.id=content_id and ce.status='published' and ce.deleted_at is null;
  if product_id is not null then
    select private.verified_product_video_path_v1(p.specifications->>'video') into video_path from public.products p where p.id=product_id and p.status='published' and p.is_active=true and p.deleted_at is null;
  end if;
  base := jsonb_set(base,'{safety,videoPath}',coalesce(to_jsonb(video_path),'null'::jsonb),true);
  return jsonb_set(base,'{safety,videoUrl}',coalesce(to_jsonb(private.media_public_url_v1('catalog-public',video_path)),'null'::jsonb),true);
end;
$function$;

-- Status for the admin panel, now with the video share of the budget.
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
    'enabled', s.enabled,
    'publicBaseUrl', s.public_base_url,
    'objectCount', (select count(*) from private.media_cdn_objects where confirmed),
    'videoCount', (select count(*) from private.media_cdn_objects where confirmed and content_type like 'video/%'),
    'mirroredBytes', plan->'mirroredBytes',
    'videoBytes', (select coalesce(sum(byte_size),0) from private.media_cdn_objects where content_type like 'video/%'),
    'budgetBytes', s.budget_bytes,
    'videoBudgetBytes', s.video_budget_bytes,
    'warnBytes', s.warn_bytes,
    'overWarning', (plan->>'mirroredBytes')::bigint >= s.warn_bytes,
    'budgetBlocked', plan->'budgetBlocked',
    'pendingUploads', jsonb_array_length(plan->'uploads'),
    'pendingDeletes', jsonb_array_length(plan->'deletes'),
    'failedObjects', (select count(*) from private.media_cdn_failures where attempts >= 3),
    'lastRunAt', s.last_run_at,
    'lastRunStatus', s.last_run_status,
    'lastRunDetail', s.last_run_detail);
end;
$$;

create or replace function public.service_media_video_reserve_v1(p_user uuid, p_name text, p_size bigint, p_content_type text)
returns text language sql set search_path = '' as $$ select private.media_video_reserve_v1(p_user, p_name, p_size, p_content_type); $$;
create or replace function public.service_media_video_confirm_v1(p_user uuid, p_name text, p_size bigint, p_content_type text)
returns boolean language sql set search_path = '' as $$ select private.media_video_confirm_v1(p_user, p_name, p_size, p_content_type); $$;
create or replace function public.service_media_video_release_v1(p_user uuid, p_name text)
returns boolean language sql set search_path = '' as $$ select private.media_video_release_v1(p_user, p_name); $$;
create or replace function public.service_media_video_releasable_v1(p_user uuid, p_name text)
returns boolean language sql stable set search_path = '' as $$ select private.media_video_releasable_v1(p_user, p_name); $$;

revoke all on function private.media_direct_video_name_ok_v1(text,text) from public, anon, authenticated;
revoke all on function private.media_direct_referenced_v1(text) from public, anon, authenticated;
revoke all on function private.media_public_url_v1(text,text) from public, anon, authenticated;
revoke all on function private.media_video_reserve_v1(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function private.media_video_confirm_v1(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function private.media_video_release_v1(uuid,text) from public, anon, authenticated;
revoke all on function private.media_video_releasable_v1(uuid,text) from public, anon, authenticated;
grant execute on function private.media_direct_video_name_ok_v1(text,text), private.media_direct_referenced_v1(text), private.media_public_url_v1(text,text),
  private.media_video_reserve_v1(uuid,text,bigint,text), private.media_video_confirm_v1(uuid,text,bigint,text),
  private.media_video_release_v1(uuid,text), private.media_video_releasable_v1(uuid,text) to service_role;

revoke all on function public.service_media_video_reserve_v1(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function public.service_media_video_confirm_v1(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function public.service_media_video_release_v1(uuid,text) from public, anon, authenticated;
revoke all on function public.service_media_video_releasable_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.service_media_video_reserve_v1(uuid,text,bigint,text), public.service_media_video_confirm_v1(uuid,text,bigint,text),
  public.service_media_video_release_v1(uuid,text), public.service_media_video_releasable_v1(uuid,text) to service_role;
