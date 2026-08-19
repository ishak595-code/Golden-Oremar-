create or replace function private.management_orders_snapshot_v3()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare base jsonb; filtered_orders jsonb;
begin
  base:=private.management_orders_snapshot_v2();
  select coalesce(jsonb_agg(row_item order by ordinality),'[]'::jsonb) into filtered_orders
  from jsonb_array_elements(coalesce(base->'orders','[]'::jsonb)) with ordinality rows(row_item,ordinality)
  join public.orders o on o.id=(row_item->>'id')::uuid
  where o.accounting_archived_at is null;
  return jsonb_set(base,'{orders}',filtered_orders,true);
end;
$function$;
create or replace function public.management_orders_snapshot_v3()
returns jsonb language sql set search_path='' as $function$select private.management_orders_snapshot_v3();$function$;
revoke all on function public.management_orders_snapshot_v3() from public,anon;
grant execute on function public.management_orders_snapshot_v3() to authenticated;
