drop function if exists public.get_my_producer_dashboard_v1();

revoke execute on function private.get_my_producer_dashboard_v1() from public, anon, authenticated;
revoke execute on function private.get_my_producer_application_draft_v4(uuid) from public, anon, authenticated;

revoke execute on function private.get_my_producer_dashboard_v2() from public, anon;
grant execute on function private.get_my_producer_dashboard_v2() to authenticated;

revoke execute on function private.get_my_producer_application_draft_v5(uuid) from public, anon;
grant execute on function private.get_my_producer_application_draft_v5(uuid) to authenticated;
