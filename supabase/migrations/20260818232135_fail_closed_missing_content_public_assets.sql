create or replace function private.list_public_content_v2(
  p_content_type text,
  p_locale text default 'tr',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.list_public_content_v1(p_content_type,p_locale,p_limit,p_offset);
  items jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(item,'{heroImagePath}',coalesce(to_jsonb(private.verified_public_storage_path_v1('content-public',item->>'heroImagePath')),'null'::jsonb),true)
    order by ordinality
  ),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) with ordinality as rows(item,ordinality);
  return jsonb_set(base,'{items}',items,true);
end;
$$;
revoke all on function private.list_public_content_v2(text,text,integer,integer) from public,anon;
grant execute on function private.list_public_content_v2(text,text,integer,integer) to anon,authenticated;

create or replace function private.get_public_content_entry_v3(p_reference text,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_content_entry_v2(p_reference,p_locale);
  verified_path text;
begin
  verified_path:=private.verified_public_storage_path_v1('content-public',base->>'heroImagePath');
  return jsonb_set(base,'{heroImagePath}',coalesce(to_jsonb(verified_path),'null'::jsonb),true);
end;
$$;
revoke all on function private.get_public_content_entry_v3(text,text) from public,anon;
grant execute on function private.get_public_content_entry_v3(text,text) to anon,authenticated;

create or replace function private.list_public_events_v2(p_include_past boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.list_public_events_v1(p_include_past);
  items jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(item,'{imagePath}',coalesce(to_jsonb(private.verified_public_storage_path_v1('content-public',item->>'imagePath')),'null'::jsonb),true)
    order by ordinality
  ),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) with ordinality as rows(item,ordinality);
  return jsonb_set(base,'{items}',items,true);
end;
$$;
revoke all on function private.list_public_events_v2(boolean) from public,anon;
grant execute on function private.list_public_events_v2(boolean) to anon,authenticated;

create or replace function private.list_my_event_reservations_v1(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid_limit' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',reservation.id,
    'event_id',reservation.event_id,
    'reservation_code',reservation.reservation_code,
    'guest_name',reservation.guest_name,
    'guest_count',reservation.guest_count,
    'status',reservation.status,
    'created_at',reservation.created_at,
    'updated_at',reservation.updated_at,
    'event',case when event.id is null then null else jsonb_build_object(
      'id',event.id,
      'slug',event.slug,
      'title',event.title,
      'starts_at',event.starts_at,
      'ends_at',event.ends_at,
      'location_name',event.location_name,
      'status',event.status,
      'image_path',private.verified_public_storage_path_v1('content-public',event.image_path)
    ) end
  ) order by reservation.created_at desc),'[]'::jsonb)
  into result
  from (
    select * from public.event_reservations
    where user_id=uid
    order by created_at desc
    limit p_limit
  ) reservation
  left join public.events event on event.id=reservation.event_id;
  return result;
end;
$$;
revoke all on function private.list_my_event_reservations_v1(integer) from public,anon;
grant execute on function private.list_my_event_reservations_v1(integer) to authenticated;

create or replace function public.list_public_content_v1(p_content_type text,p_locale text default 'tr',p_limit integer default 20,p_offset integer default 0)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_public_content_v2(p_content_type,p_locale,p_limit,p_offset); $$;

create or replace function public.get_public_content_entry_v2(p_reference text,p_locale text default 'tr')
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_content_entry_v3(p_reference,p_locale); $$;

create or replace function public.list_public_events_v1(p_include_past boolean default true)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_public_events_v2(p_include_past); $$;

create or replace function public.list_my_event_reservations_v1(p_limit integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_my_event_reservations_v1(p_limit); $$;

revoke all on function public.list_public_content_v1(text,text,integer,integer) from public;
revoke all on function public.get_public_content_entry_v2(text,text) from public;
revoke all on function public.list_public_events_v1(boolean) from public;
revoke all on function public.list_my_event_reservations_v1(integer) from public,anon;
grant execute on function public.list_public_content_v1(text,text,integer,integer) to anon,authenticated;
grant execute on function public.get_public_content_entry_v2(text,text) to anon,authenticated;
grant execute on function public.list_public_events_v1(boolean) to anon,authenticated;
grant execute on function public.list_my_event_reservations_v1(integer) to authenticated;
