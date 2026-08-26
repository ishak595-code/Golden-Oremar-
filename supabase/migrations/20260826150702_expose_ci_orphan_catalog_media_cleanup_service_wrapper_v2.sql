create or replace function public.ci_orphan_catalog_media_cleanup_candidates_for_service_v1()
returns text[]
language sql
stable
security definer
set search_path=''
as $$
  select private.ci_orphan_catalog_media_cleanup_candidates_for_service_v1();
$$;
revoke all on function public.ci_orphan_catalog_media_cleanup_candidates_for_service_v1() from public,anon,authenticated;
grant execute on function public.ci_orphan_catalog_media_cleanup_candidates_for_service_v1() to service_role;
