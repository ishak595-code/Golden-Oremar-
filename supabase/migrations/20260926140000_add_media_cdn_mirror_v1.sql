-- Media CDN mirror v1: public images served from Cloudflare R2.
--
-- Why: every product photo a customer sees is downloaded from Supabase's CDN,
-- and that "cached egress" is what exhausted the free plan and took the whole
-- project offline (HTTP 402). R2 does not charge for downloads at all.
--
-- Design, chosen so nothing that already works has to change:
--   * Supabase Storage stays the source of truth. Uploads, RLS policies and
--     the binary verifier are untouched.
--   * A worker (edge function media-cdn-sync) copies eligible public images to
--     R2 under the key "<bucket>/<object name>" and deletes copies whose source
--     is gone. The client builds R2 URLs and falls back to Supabase on error,
--     so an image that is not mirrored yet still shows.
--   * Only images from the three public buckets are mirrored. Videos and every
--     private bucket stay where they are.
--
-- The 10 GB free R2 allowance is protected by construction:
--   * every PUT is preceded by a reservation row in media_cdn_objects, so the
--     ledger is always a superset of what exists in R2;
--   * the reservation is refused when ledger bytes + the new object would pass
--     budget_bytes (8 GiB by default, 9 GiB hard ceiling in the CHECK);
--   * a single object above max_object_bytes (5 MiB) is never mirrored;
--   * copies of deleted sources are removed on the next run.
-- Anything refused simply keeps being served from Supabase.

create table if not exists private.media_cdn_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  r2_account_id text check (r2_account_id is null or r2_account_id ~ '^[0-9a-f]{32}$'),
  r2_bucket text check (r2_bucket is null or r2_bucket ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  public_base_url text check (public_base_url is null or public_base_url ~ '^https://[a-z0-9.-]+[a-z0-9]$'),
  budget_bytes bigint not null default 8589934592 check (budget_bytes between 0 and 9663676416),
  warn_bytes bigint not null default 7516192768 check (warn_bytes >= 0),
  max_object_bytes bigint not null default 5242880 check (max_object_bytes between 1 and 10485760),
  batch_size integer not null default 25 check (batch_size between 1 and 50),
  last_run_at timestamptz,
  last_run_status text check (last_run_status is null or char_length(last_run_status) <= 64),
  last_run_detail jsonb,
  updated_at timestamptz not null default now(),
  check (warn_bytes <= budget_bytes)
);
insert into private.media_cdn_settings (id, r2_account_id, r2_bucket)
values (true, '05764c9f34befd8e71cffca80a56d26b', 'golden-oremar-media')
on conflict (id) do nothing;

create table if not exists private.media_cdn_objects (
  bucket_id text not null check (bucket_id in ('catalog-public','content-public','event-public')),
  object_name text not null check (char_length(object_name) between 1 and 1024),
  source_etag text not null default '',
  byte_size bigint not null check (byte_size > 0),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','image/avif')),
  confirmed boolean not null default false,
  reserved_at timestamptz not null default now(),
  mirrored_at timestamptz,
  primary key (bucket_id, object_name)
);

create table if not exists private.media_cdn_failures (
  bucket_id text not null,
  object_name text not null,
  source_etag text not null default '',
  reason text not null check (char_length(reason) between 1 and 200),
  attempts integer not null default 1 check (attempts >= 1),
  last_attempt_at timestamptz not null default now(),
  primary key (bucket_id, object_name)
);

alter table private.media_cdn_settings enable row level security;
alter table private.media_cdn_objects enable row level security;
alter table private.media_cdn_failures enable row level security;
revoke all on private.media_cdn_settings, private.media_cdn_objects, private.media_cdn_failures from public, anon, authenticated;

-- Shared secret for the cron -> edge function call. Generated here, never
-- written anywhere else; the edge function asks the database to compare.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'golden_oremar_media_cdn_worker') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'golden_oremar_media_cdn_worker', 'media-cdn-sync worker secret');
  end if;
end;
$$;

-- Public images that may be mirrored. Names that could escape their bucket
-- prefix in an R2 key (leading slash, empty or dot segments, control
-- characters, backslash) are never eligible.
create or replace function private.media_cdn_sources_v1(p_bucket text default null, p_name text default null)
returns table (bucket_id text, object_name text, source_etag text, byte_size bigint, content_type text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name, coalesce(o.metadata->>'eTag',''), (o.metadata->>'size')::bigint, lower(o.metadata->>'mimetype'), o.created_at
  from storage.objects o
  where o.bucket_id in ('catalog-public','content-public','event-public')
    and (p_bucket is null or o.bucket_id = p_bucket)
    and (p_name is null or o.name = p_name)
    and coalesce(o.is_delete_marker,false) = false
    and o.archived_at is null
    and lower(coalesce(o.metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/avif')
    and coalesce(o.metadata->>'size','') ~ '^[0-9]{1,12}$'
    and (o.metadata->>'size')::bigint > 0
    and char_length(o.name) between 1 and 1024
    and o.name !~ '(^/|//|/$|(^|/)[.]{1,2}(/|$)|[\\[:cntrl:]])';
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
  mirrored bigint;
  uploads jsonb;
  deletes jsonb;
  blocked integer;
begin
  select * into s from private.media_cdn_settings where id;
  if not found then raise exception 'media_cdn_settings_missing' using errcode = 'P0002'; end if;
  select coalesce(sum(byte_size),0) into mirrored from private.media_cdn_objects;

  -- Copies whose source was deleted. Deleting a key R2 does not have is a
  -- harmless no-op, so unconfirmed reservations are included too.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket_id, 'name', g.object_name) order by g.reserved_at), '[]'::jsonb)
  into deletes
  from (
    with src as materialized (select * from private.media_cdn_sources_v1())
    select m.bucket_id, m.object_name, m.reserved_at
    from private.media_cdn_objects m
    where not exists (select 1 from src where src.bucket_id = m.bucket_id and src.object_name = m.object_name)
    order by m.reserved_at
    limit 50
  ) g;

  with candidates as (
    select src.*, coalesce(m.byte_size, 0) as previous_bytes
    from private.media_cdn_sources_v1() src
    left join private.media_cdn_objects m on m.bucket_id = src.bucket_id and m.object_name = src.object_name
    where src.byte_size <= s.max_object_bytes
      and src.created_at < now() - interval '2 minutes'
      and (m.object_name is null
           or m.source_etag <> src.source_etag
           or (m.confirmed = false and m.reserved_at < now() - interval '10 minutes'))
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

-- Reserve before PUT. This is the last line of defence for the budget: it
-- re-checks under a row lock, so two overlapping runs cannot both squeeze in.
create or replace function private.media_cdn_reserve_v1(p_bucket text, p_name text, p_etag text, p_size bigint, p_content_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare s private.media_cdn_settings; mirrored bigint; previous bigint;
begin
  select * into s from private.media_cdn_settings where id for update;
  if not found or not s.enabled then return false; end if;
  if not exists (
    select 1 from private.media_cdn_sources_v1(p_bucket, p_name) src
    where src.source_etag = coalesce(p_etag,'')
      and src.byte_size = p_size and src.content_type = p_content_type and src.byte_size <= s.max_object_bytes) then
    return false;
  end if;
  select coalesce(sum(byte_size),0) into mirrored from private.media_cdn_objects;
  select coalesce((select byte_size from private.media_cdn_objects where bucket_id = p_bucket and object_name = p_name), 0) into previous;
  if mirrored - previous + p_size > s.budget_bytes then return false; end if;
  insert into private.media_cdn_objects (bucket_id, object_name, source_etag, byte_size, content_type, confirmed, reserved_at, mirrored_at)
  values (p_bucket, p_name, coalesce(p_etag,''), p_size, p_content_type, false, now(), null)
  on conflict (bucket_id, object_name) do update
    set source_etag = excluded.source_etag, byte_size = excluded.byte_size, content_type = excluded.content_type,
        confirmed = false, reserved_at = now(), mirrored_at = null;
  return true;
end;
$$;

create or replace function private.media_cdn_confirm_v1(p_bucket text, p_name text, p_etag text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.media_cdn_objects set confirmed = true, mirrored_at = now()
  where bucket_id = p_bucket and object_name = p_name and source_etag = coalesce(p_etag,'');
  if not found then return false; end if;
  delete from private.media_cdn_failures where bucket_id = p_bucket and object_name = p_name;
  return true;
end;
$$;

-- Called after R2 confirmed the delete, or after a PUT failed.
create or replace function private.media_cdn_forget_v1(p_bucket text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from private.media_cdn_objects where bucket_id = p_bucket and object_name = p_name returning 1)
  select exists (select 1 from gone);
$$;

create or replace function private.media_cdn_fail_v1(p_bucket text, p_name text, p_etag text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.media_cdn_failures (bucket_id, object_name, source_etag, reason)
  values (p_bucket, p_name, coalesce(p_etag,''), left(coalesce(nullif(btrim(p_reason),''),'unknown'), 200))
  on conflict (bucket_id, object_name) do update
    set reason = excluded.reason,
        attempts = case when private.media_cdn_failures.source_etag = excluded.source_etag then private.media_cdn_failures.attempts + 1 else 1 end,
        source_etag = excluded.source_etag,
        last_attempt_at = now();
$$;

create or replace function private.media_cdn_finish_v1(p_status text, p_detail jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.media_cdn_settings
  set last_run_at = now(), last_run_status = left(coalesce(p_status,'unknown'), 64), last_run_detail = p_detail, updated_at = now()
  where id;
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
  plan := private.media_cdn_plan_v1(1);
  return jsonb_array_length(plan->'uploads') > 0 or jsonb_array_length(plan->'deletes') > 0;
end;
$$;

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
    'mirroredBytes', plan->'mirroredBytes',
    'budgetBytes', s.budget_bytes,
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

-- Public wrappers. Worker functions are service_role only.
create or replace function public.service_validate_media_cdn_worker_v1(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(char_length(p_secret) between 32 and 256, false)
    and exists (select 1 from vault.decrypted_secrets s where s.name = 'golden_oremar_media_cdn_worker' and s.decrypted_secret = p_secret);
$$;
create or replace function public.service_media_cdn_plan_v1(p_limit integer default null)
returns jsonb language sql stable set search_path = '' as $$ select private.media_cdn_plan_v1(p_limit); $$;
create or replace function public.service_media_cdn_reserve_v1(p_bucket text, p_name text, p_etag text, p_size bigint, p_content_type text)
returns boolean language sql set search_path = '' as $$ select private.media_cdn_reserve_v1(p_bucket, p_name, p_etag, p_size, p_content_type); $$;
create or replace function public.service_media_cdn_confirm_v1(p_bucket text, p_name text, p_etag text)
returns boolean language sql set search_path = '' as $$ select private.media_cdn_confirm_v1(p_bucket, p_name, p_etag); $$;
create or replace function public.service_media_cdn_forget_v1(p_bucket text, p_name text)
returns boolean language sql set search_path = '' as $$ select private.media_cdn_forget_v1(p_bucket, p_name); $$;
create or replace function public.service_media_cdn_fail_v1(p_bucket text, p_name text, p_etag text, p_reason text)
returns void language sql set search_path = '' as $$ select private.media_cdn_fail_v1(p_bucket, p_name, p_etag, p_reason); $$;
create or replace function public.service_media_cdn_finish_v1(p_status text, p_detail jsonb)
returns void language sql set search_path = '' as $$ select private.media_cdn_finish_v1(p_status, p_detail); $$;
create or replace function public.super_admin_media_cdn_status_v1()
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.super_admin_media_cdn_status_v1(); $$;

revoke all on function private.media_cdn_sources_v1(text,text) from public, anon, authenticated;
revoke all on function private.media_cdn_plan_v1(integer) from public, anon, authenticated;
revoke all on function private.media_cdn_reserve_v1(text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function private.media_cdn_confirm_v1(text,text,text) from public, anon, authenticated;
revoke all on function private.media_cdn_forget_v1(text,text) from public, anon, authenticated;
revoke all on function private.media_cdn_fail_v1(text,text,text,text) from public, anon, authenticated;
revoke all on function private.media_cdn_finish_v1(text,jsonb) from public, anon, authenticated;
revoke all on function private.media_cdn_has_work_v1() from public, anon, authenticated;
revoke all on function private.super_admin_media_cdn_status_v1() from public, anon;
grant execute on function private.media_cdn_sources_v1(text,text), private.media_cdn_plan_v1(integer), private.media_cdn_reserve_v1(text,text,text,bigint,text),
  private.media_cdn_confirm_v1(text,text,text), private.media_cdn_forget_v1(text,text), private.media_cdn_fail_v1(text,text,text,text),
  private.media_cdn_finish_v1(text,jsonb), private.media_cdn_has_work_v1() to service_role;
grant execute on function private.super_admin_media_cdn_status_v1() to authenticated, service_role;

revoke all on function public.service_validate_media_cdn_worker_v1(text) from public, anon, authenticated;
revoke all on function public.service_media_cdn_plan_v1(integer) from public, anon, authenticated;
revoke all on function public.service_media_cdn_reserve_v1(text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.service_media_cdn_confirm_v1(text,text,text) from public, anon, authenticated;
revoke all on function public.service_media_cdn_forget_v1(text,text) from public, anon, authenticated;
revoke all on function public.service_media_cdn_fail_v1(text,text,text,text) from public, anon, authenticated;
revoke all on function public.service_media_cdn_finish_v1(text,jsonb) from public, anon, authenticated;
revoke all on function public.super_admin_media_cdn_status_v1() from public, anon;
grant execute on function public.service_validate_media_cdn_worker_v1(text), public.service_media_cdn_plan_v1(integer),
  public.service_media_cdn_reserve_v1(text,text,text,bigint,text), public.service_media_cdn_confirm_v1(text,text,text),
  public.service_media_cdn_forget_v1(text,text), public.service_media_cdn_fail_v1(text,text,text,text),
  public.service_media_cdn_finish_v1(text,jsonb) to service_role;
grant execute on function public.super_admin_media_cdn_status_v1() to authenticated;

-- Every 5 minutes, only when enabled and there is something to do, so an idle
-- system makes no edge function calls at all.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'golden-oremar-media-cdn-sync') then
    perform cron.unschedule('golden-oremar-media-cdn-sync');
  end if;
  perform cron.schedule('golden-oremar-media-cdn-sync', '*/5 * * * *', $job$
    select case when private.media_cdn_has_work_v1() then net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'golden_oremar_project_url') || '/functions/v1/media-cdn-sync',
      headers := jsonb_build_object('Content-Type','application/json','x-golden-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'golden_oremar_media_cdn_worker')),
      body := jsonb_build_object('source','cron'),
      timeout_milliseconds := 60000) end;
  $job$);
end;
$$;
