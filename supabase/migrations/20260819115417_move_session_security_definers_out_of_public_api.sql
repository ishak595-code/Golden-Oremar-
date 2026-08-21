create or replace function private.customer_session_status_impl_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); profile public.profiles%rowtype; block jsonb; roles jsonb;
begin
  if caller_id is null then return null; end if;
  perform private.record_current_security_context_v1(caller_id);
  select * into profile from public.profiles where id=caller_id;
  if profile.id is null then return null; end if;
  block:=private.platform_access_block_v1(caller_id);
  select coalesce(jsonb_agg(r.role order by r.role),'[]'::jsonb) into roles from private.user_roles r where r.user_id=caller_id and (r.expires_at is null or r.expires_at>timezone('utc',now()));
  return jsonb_build_object('is_authenticated',true,'user_id',profile.id,'email',coalesce(auth.jwt()->>'email',''),'display_name',profile.display_name,'phone',profile.phone,'locale',profile.locale,'status',case when coalesce((block->>'blocked')::boolean,false) then 'blocked' else profile.status end,'roles',roles,'access_code',block->>'code','access_reason',block->>'reason','fraud_flag',coalesce((block->>'fraudFlag')::boolean,false));
end;
$function$;

create or replace function private.admin_session_status_impl_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); roles jsonb; allowed boolean;
begin
  if caller_id is null then return jsonb_build_object('is_admin',false,'roles','[]'::jsonb); end if;
  perform private.record_current_security_context_v1(caller_id);
  allowed:=coalesce(private.is_admin(),false);
  select coalesce(jsonb_agg(r.role order by r.role),'[]'::jsonb) into roles from private.user_roles r where r.user_id=caller_id and r.role in ('admin','super_admin') and (r.expires_at is null or r.expires_at>timezone('utc',now()));
  return jsonb_build_object('is_admin',allowed,'roles',case when allowed then roles else '[]'::jsonb end);
end;
$function$;

revoke all on function private.customer_session_status_impl_v1() from public;
revoke all on function private.admin_session_status_impl_v1() from public;
grant execute on function private.customer_session_status_impl_v1() to authenticated;
grant execute on function private.admin_session_status_impl_v1() to authenticated,service_role;

create or replace function public.customer_session_status()
returns jsonb
language sql
security invoker
set search_path=''
as $function$select private.customer_session_status_impl_v1();$function$;

create or replace function public.admin_session_status()
returns jsonb
language sql
security invoker
set search_path=''
as $function$select private.admin_session_status_impl_v1();$function$;

revoke all on function public.customer_session_status() from public,anon;
grant execute on function public.customer_session_status() to authenticated;
revoke all on function public.admin_session_status() from public,anon;
grant execute on function public.admin_session_status() to authenticated,service_role;
