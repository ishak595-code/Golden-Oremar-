create or replace function private.admin_session_status_impl_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); roles jsonb; allowed boolean;
begin
  if caller_id is null then return jsonb_build_object('is_admin',false,'roles','[]'::jsonb); end if;
  perform private.record_current_security_context_v1(caller_id);
  allowed:=coalesce(private.has_permission('admin.access'),false);
  select coalesce(jsonb_agg(r.role order by case r.role when 'super_admin' then 1 when 'admin' then 2 when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 else 99 end,r.role),'[]'::jsonb)
  into roles
  from private.user_roles r
  where r.user_id=caller_id
    and r.role in ('support','content_editor','operations','moderator','admin','super_admin')
    and (r.expires_at is null or r.expires_at>timezone('utc',now()));
  return jsonb_build_object('is_admin',allowed,'roles',case when allowed then roles else '[]'::jsonb end);
end;
$$;