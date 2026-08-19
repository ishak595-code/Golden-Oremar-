drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

create policy transactional_email_jobs_deny_direct_authenticated
on private.transactional_email_jobs
for all
to authenticated
using (false)
with check (false);

create or replace function private.super_admin_list_transactional_email_jobs_v1(p_status text default null,p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare normalized text:=nullif(lower(btrim(coalesce(p_status,''))),'' ); result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if normalized is not null and normalized not in ('pending','processing','failed','sent','dead_letter') then raise exception 'invalid_email_job_status' using errcode='22023'; end if;
  if p_limit not between 1 and 200 then raise exception 'invalid_limit' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'kind',j.kind,'aggregateId',j.aggregate_id,'status',j.status,'attempts',j.attempts,'availableAt',j.available_at,'providerMessageId',j.provider_message_id,'lastError',j.last_error,'createdAt',j.created_at,'sentAt',j.sent_at) order by j.created_at desc,j.id desc),'[]'::jsonb)
  into result from (select * from private.transactional_email_jobs where normalized is null or status=normalized order by created_at desc,id desc limit p_limit) j;
  return jsonb_build_object('ok',true,'items',result);
end;
$function$;

create or replace function private.super_admin_retry_transactional_email_job_v1(p_job_id bigint)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  update private.transactional_email_jobs
  set status='pending',attempts=0,available_at=timezone('utc',now()),locked_at=null,locked_by=null,last_error=null
  where id=p_job_id and status in ('failed','dead_letter');
  return found;
end;
$function$;

revoke all on function private.super_admin_list_transactional_email_jobs_v1(text,integer) from public,anon;
revoke all on function private.super_admin_retry_transactional_email_job_v1(bigint) from public,anon;
grant execute on function private.super_admin_list_transactional_email_jobs_v1(text,integer) to authenticated;
grant execute on function private.super_admin_retry_transactional_email_job_v1(bigint) to authenticated;

create or replace function public.super_admin_list_transactional_email_jobs_v1(p_status text default null,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path to '' as $function$
  select private.super_admin_list_transactional_email_jobs_v1(p_status,p_limit);
$function$;
create or replace function public.super_admin_retry_transactional_email_job_v1(p_job_id bigint)
returns boolean language sql security invoker set search_path to '' as $function$
  select private.super_admin_retry_transactional_email_job_v1(p_job_id);
$function$;

revoke all on function public.super_admin_list_transactional_email_jobs_v1(text,integer) from public,anon;
revoke all on function public.super_admin_retry_transactional_email_job_v1(bigint) from public,anon;
grant execute on function public.super_admin_list_transactional_email_jobs_v1(text,integer) to authenticated;
grant execute on function public.super_admin_retry_transactional_email_job_v1(bigint) to authenticated;
