-- Small read of the R2 target for edge functions that do not need the full
-- mirror plan (media-video-upload). Service role only.
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
    'publicBaseUrl', s.public_base_url,
    'maxVideoBytes', s.max_video_bytes)
  from private.media_cdn_settings s where s.id;
$$;
create or replace function public.service_media_cdn_target_v1()
returns jsonb language sql stable set search_path = '' as $$ select private.media_cdn_target_v1(); $$;

revoke all on function private.media_cdn_target_v1() from public, anon, authenticated;
revoke all on function public.service_media_cdn_target_v1() from public, anon, authenticated;
grant execute on function private.media_cdn_target_v1(), public.service_media_cdn_target_v1() to service_role;
