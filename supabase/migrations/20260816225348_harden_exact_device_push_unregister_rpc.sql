create or replace function private.unregister_push_device_v1(p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  affected integer := 0;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update private.device_push_tokens
  set disabled_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_device_id
    and user_id = caller_id
    and disabled_at is null;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$function$;

revoke all on function private.unregister_push_device_v1(uuid) from public;
grant execute on function private.unregister_push_device_v1(uuid) to authenticated;

create or replace function public.unregister_push_device_v1(p_device_id uuid)
returns boolean
language sql
security invoker
set search_path to ''
as $function$
  select private.unregister_push_device_v1(p_device_id);
$function$;

revoke all on function public.unregister_push_device_v1(uuid) from public;
grant execute on function public.unregister_push_device_v1(uuid) to authenticated;
