-- Keep existing public RPC names stable while enriching their payloads with the canonical commerce profile.

create or replace function private.management_catalog_snapshot_v3()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  base jsonb:=private.management_catalog_snapshot_v2();
  products_payload jsonb;
begin
  select coalesce(jsonb_agg(
    item || jsonb_build_object('commerce',private.product_commerce_payload_v1((item->>'databaseId')::uuid))
    order by ordinality
  ),'[]'::jsonb)
  into products_payload
  from jsonb_array_elements(coalesce(base->'products','[]'::jsonb)) with ordinality rows(item,ordinality);
  return jsonb_set(base,'{products}',products_payload,true);
end;
$$;

create or replace function public.management_catalog_snapshot_v1()
returns jsonb
language sql
set search_path=''
as $$ select private.management_catalog_snapshot_v3(); $$;

create or replace function private.management_orders_snapshot_v3()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  base jsonb:=private.management_orders_snapshot_v2();
  orders_payload jsonb;
begin
  select coalesce(jsonb_agg(
    order_item || jsonb_build_object('items',coalesce(enriched.items,'[]'::jsonb))
    order by order_ordinality
  ),'[]'::jsonb)
  into orders_payload
  from jsonb_array_elements(coalesce(base->'orders','[]'::jsonb)) with ordinality order_rows(order_item,order_ordinality)
  left join lateral (
    select jsonb_agg(
      item || jsonb_build_object(
        'selectedOptions',coalesce(db_item.snapshot->'selected_options','{}'::jsonb),
        'preparationEvents',coalesce(events.items,'[]'::jsonb)
      ) order by item_ordinality
    ) as items
    from jsonb_array_elements(coalesce(order_item->'items','[]'::jsonb)) with ordinality item_rows(item,item_ordinality)
    left join public.order_items db_item on db_item.id=(item->>'id')::uuid
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'eventType',e.event_type,'note',e.note,'visibleToCustomer',e.visible_to_customer,'createdAt',e.created_at
      ) order by e.created_at,e.id) as items
      from public.order_item_preparation_events e where e.order_item_id=db_item.id
    ) events on true
  ) enriched on true;
  return jsonb_set(base,'{orders}',orders_payload,true);
end;
$$;

create or replace function public.management_orders_snapshot_v2()
returns jsonb
language sql
set search_path=''
as $$ select private.management_orders_snapshot_v3(); $$;

-- A lightweight public read contract for the current signed-in customer's availability preference.
create or replace function public.get_product_availability_subscription_v1(p_reference text)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_id uuid:=private.resolve_product_id_v1(p_reference);
  active_value boolean:=false;
begin
  if caller_id is null then return jsonb_build_object('active',false,'authenticated',false); end if;
  if product_id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select coalesce(s.active,false) into active_value from public.product_availability_subscriptions s where s.user_id=caller_id and s.product_id=product_id;
  return jsonb_build_object('active',coalesce(active_value,false),'authenticated',true,'productId',product_id);
end;
$$;

revoke all on function public.get_product_availability_subscription_v1(text) from public;
grant execute on function public.get_product_availability_subscription_v1(text) to authenticated;
