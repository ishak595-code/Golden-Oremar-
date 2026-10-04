-- Admin inbox for Geri bildirim (app feedback) and contact-form messages.
-- private.contact_messages stays closed to clients (forced RLS, deny policy);
-- only admins (private.is_admin: admin / super_admin) read and update it,
-- through these SECURITY DEFINER functions. Who read / resolved a message
-- is kept for audit.
alter table private.contact_messages
  add column if not exists read_at timestamptz,
  add column if not exists read_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

create index if not exists contact_messages_created_idx on private.contact_messages (created_at desc);

create or replace function private.admin_contact_message_category_v1(p_subject text, p_source text)
 returns text language sql immutable set search_path to ''
as $function$
  select case
    when coalesce(p_subject,'') ~* '^geri bildirim:\s*' then nullif(btrim(regexp_replace(p_subject,'^geri bildirim:\s*','','i')),'')
    when p_source='app-feedback' then 'Geri bildirim'
    else 'İletişim formu' end;
$function$;
revoke all on function private.admin_contact_message_category_v1(text, text) from public, anon, authenticated;

create or replace function private.admin_list_contact_messages_v1(p_status text default 'all', p_limit integer default 30, p_offset integer default 0)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare filter_value text:=lower(coalesce(nullif(btrim(p_status),''),'all')); result jsonb; total_count integer; unread_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if filter_value not in ('all','unread','read','resolved') then raise exception 'invalid_status_filter' using errcode='22023'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select count(*) into unread_count from private.contact_messages where status='new';
  select count(*) into total_count from private.contact_messages m
   where filter_value='all' or (filter_value='unread' and m.status='new') or (filter_value='read' and m.status in ('assigned','in_progress')) or (filter_value='resolved' and m.status='resolved');
  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into result from (
    select jsonb_build_object(
      'id',m.id,'createdAt',m.created_at,'status',m.status,'source',m.source,
      'subject',m.subject,'category',private.admin_contact_message_category_v1(m.subject,m.source),
      'preview',left(regexp_replace(m.message,'\s+',' ','g'),160),
      'guest',m.user_id is null,
      'userName',case when m.user_id is null then null else coalesce(nullif(btrim(p.display_name),''),nullif(btrim(m.name),''),'Üye') end,
      'senderName',nullif(btrim(m.name),'')
    ) item, m.created_at
    from private.contact_messages m left join public.profiles p on p.id=m.user_id
    where filter_value='all' or (filter_value='unread' and m.status='new') or (filter_value='read' and m.status in ('assigned','in_progress')) or (filter_value='resolved' and m.status='resolved')
    order by m.created_at desc limit p_limit offset p_offset
  ) rows;
  return jsonb_build_object('total',total_count,'unreadCount',unread_count,'items',result);
end;
$function$;

create or replace function private.admin_get_contact_message_v1(p_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'id',m.id,'createdAt',m.created_at,'updatedAt',m.updated_at,'status',m.status,'source',m.source,'locale',m.locale,
    'subject',m.subject,'category',private.admin_contact_message_category_v1(m.subject,m.source),'message',m.message,
    'guest',m.user_id is null,
    'userName',case when m.user_id is null then null else coalesce(nullif(btrim(p.display_name),''),nullif(btrim(m.name),''),'Üye') end,
    'senderName',nullif(btrim(m.name),''),'email',m.email,'phone',m.phone,
    'readAt',m.read_at,'readBy',rp.display_name,'resolvedAt',m.resolved_at,'resolvedBy',sp.display_name
  ) into result
  from private.contact_messages m
  left join public.profiles p on p.id=m.user_id
  left join public.profiles rp on rp.id=m.read_by
  left join public.profiles sp on sp.id=m.resolved_by
  where m.id=p_id;
  if result is null then raise exception 'contact_message_not_found' using errcode='P0002'; end if;
  return result;
end;
$function$;

create or replace function private.admin_update_contact_message_v1(p_id uuid, p_action text)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); action_value text:=lower(btrim(coalesce(p_action,''))); row_value private.contact_messages%rowtype; now_value timestamptz:=timezone('utc',now());
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if action_value not in ('read','unread','resolve','reopen') then raise exception 'invalid_action' using errcode='22023'; end if;
  select * into row_value from private.contact_messages where id=p_id for update;
  if row_value.id is null then raise exception 'contact_message_not_found' using errcode='P0002'; end if;
  if action_value='read' then
    update private.contact_messages set status=case when status='new' then 'in_progress' else status end,
      read_at=coalesce(read_at,now_value),read_by=coalesce(read_by,caller_id),updated_at=now_value where id=p_id returning * into row_value;
  elsif action_value='unread' then
    update private.contact_messages set status='new',read_at=null,read_by=null,resolved_at=null,resolved_by=null,updated_at=now_value where id=p_id returning * into row_value;
  elsif action_value='resolve' then
    update private.contact_messages set status='resolved',read_at=coalesce(read_at,now_value),read_by=coalesce(read_by,caller_id),resolved_at=now_value,resolved_by=caller_id,updated_at=now_value where id=p_id returning * into row_value;
  else
    update private.contact_messages set status='in_progress',resolved_at=null,resolved_by=null,updated_at=now_value where id=p_id returning * into row_value;
  end if;
  return jsonb_build_object('id',row_value.id,'status',row_value.status,'readAt',row_value.read_at,'resolvedAt',row_value.resolved_at,
    'unreadCount',(select count(*) from private.contact_messages where status='new'));
end;
$function$;

create or replace function private.admin_contact_messages_unread_count_v1()
 returns integer language plpgsql stable security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return (select count(*)::integer from private.contact_messages where status='new');
end;
$function$;

revoke all on function private.admin_list_contact_messages_v1(text, integer, integer) from public, anon, authenticated;
revoke all on function private.admin_get_contact_message_v1(uuid) from public, anon, authenticated;
revoke all on function private.admin_update_contact_message_v1(uuid, text) from public, anon, authenticated;
revoke all on function private.admin_contact_messages_unread_count_v1() from public, anon, authenticated;
grant execute on function private.admin_list_contact_messages_v1(text, integer, integer) to authenticated;
grant execute on function private.admin_get_contact_message_v1(uuid) to authenticated;
grant execute on function private.admin_update_contact_message_v1(uuid, text) to authenticated;
grant execute on function private.admin_contact_messages_unread_count_v1() to authenticated;

create or replace function public.admin_list_contact_messages_v1(p_status text default 'all', p_limit integer default 30, p_offset integer default 0)
 returns jsonb language sql set search_path to '' as $function$ select private.admin_list_contact_messages_v1(p_status,p_limit,p_offset); $function$;
create or replace function public.admin_get_contact_message_v1(p_id uuid)
 returns jsonb language sql set search_path to '' as $function$ select private.admin_get_contact_message_v1(p_id); $function$;
create or replace function public.admin_update_contact_message_v1(p_id uuid, p_action text)
 returns jsonb language sql set search_path to '' as $function$ select private.admin_update_contact_message_v1(p_id,p_action); $function$;
create or replace function public.admin_contact_messages_unread_count_v1()
 returns integer language sql set search_path to '' as $function$ select private.admin_contact_messages_unread_count_v1(); $function$;
revoke all on function public.admin_list_contact_messages_v1(text, integer, integer) from public, anon;
revoke all on function public.admin_get_contact_message_v1(uuid) from public, anon;
revoke all on function public.admin_update_contact_message_v1(uuid, text) from public, anon;
revoke all on function public.admin_contact_messages_unread_count_v1() from public, anon;
grant execute on function public.admin_list_contact_messages_v1(text, integer, integer) to authenticated;
grant execute on function public.admin_get_contact_message_v1(uuid) to authenticated;
grant execute on function public.admin_update_contact_message_v1(uuid, text) to authenticated;
grant execute on function public.admin_contact_messages_unread_count_v1() to authenticated;
