create or replace function public.management_orders_snapshot_v2()
returns jsonb
language sql
set search_path=''
as $function$select private.management_orders_snapshot_v3();$function$;
revoke all on function public.management_orders_snapshot_v2() from public,anon;
grant execute on function public.management_orders_snapshot_v2() to authenticated;
