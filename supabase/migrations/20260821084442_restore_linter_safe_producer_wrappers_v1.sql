-- Final producer RPC boundary: public wrappers are SECURITY INVOKER,
-- private canonical implementations are SECURITY DEFINER and authenticated-only.

alter function public.get_my_producer_dashboard_v2() security invoker;
alter function public.get_my_producer_application_draft_v5(uuid) security invoker;
alter function public.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) security invoker;
alter function public.submit_producer_application_v4(uuid,jsonb) security invoker;

revoke all on function public.get_my_producer_dashboard_v2() from public,anon;
revoke all on function public.get_my_producer_application_draft_v5(uuid) from public,anon;
revoke all on function public.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) from public,anon;
revoke all on function public.submit_producer_application_v4(uuid,jsonb) from public,anon;

grant execute on function public.get_my_producer_dashboard_v2() to authenticated;
grant execute on function public.get_my_producer_application_draft_v5(uuid) to authenticated;
grant execute on function public.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) to authenticated;
grant execute on function public.submit_producer_application_v4(uuid,jsonb) to authenticated;

revoke all on function private.get_my_producer_dashboard_v2() from public,anon;
revoke all on function private.get_my_producer_application_draft_v5(uuid) from public,anon;
revoke all on function private.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) from public,anon;
revoke all on function private.submit_producer_application_v4(uuid,jsonb) from public,anon;

grant execute on function private.get_my_producer_dashboard_v2() to authenticated,service_role;
grant execute on function private.get_my_producer_application_draft_v5(uuid) to authenticated,service_role;
grant execute on function private.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) to authenticated,service_role;
grant execute on function private.submit_producer_application_v4(uuid,jsonb) to authenticated,service_role;
