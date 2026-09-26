-- media-cdn-sync deletes the Supabase copy of each file it has just adopted.
-- It must honour offload_sources for those too, so the plan now says whether
-- offloading is on (previously only the list of older offloads respected it).
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
    'budgetBlocked', blocked, 'offloadSources', s.offload_sources, 'uploads', uploads, 'offloads', offloads, 'deletes', deletes);
end;
$$;
