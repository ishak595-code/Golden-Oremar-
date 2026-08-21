create or replace function public.unregister_push_device_v1(p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  changed boolean := false;
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

  changed := found;
  return changed;
end;
$function$;

revoke all on function public.unregister_push_device_v1(uuid) from public;
grant execute on function public.unregister_push_device_v1(uuid) to authenticated;
