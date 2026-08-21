-- Temporary tightening step kept because this migration version already exists in live history.
-- The following migration restores the final linter-safe invoker/definer boundary.

alter function public.get_my_producer_dashboard_v2() security definer;
alter function public.get_my_producer_application_draft_v5(uuid) security definer;
alter function public.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) security definer;
alter function public.submit_producer_application_v4(uuid,jsonb) security definer;

revoke all on function private.get_my_producer_dashboard_v2() from public,anon,authenticated;
revoke all on function private.get_my_producer_application_draft_v5(uuid) from public,anon,authenticated;
revoke all on function private.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) from public,anon,authenticated;
revoke all on function private.submit_producer_application_v4(uuid,jsonb) from public,anon,authenticated;

grant execute on function private.get_my_producer_dashboard_v2() to service_role;
grant execute on function private.get_my_producer_application_draft_v5(uuid) to service_role;
grant execute on function private.save_producer_application_draft_v5(uuid,text,text[],text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text) to service_role;
grant execute on function private.submit_producer_application_v4(uuid,jsonb) to service_role;
