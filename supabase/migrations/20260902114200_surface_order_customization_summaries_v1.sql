create or replace function private.order_customization_summary_v1(p_selected_options jsonb)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  labels jsonb;
  item record;
  parts text[]:='{}';
begin
  if p_selected_options is null or jsonb_typeof(p_selected_options)<>'object' then return ''; end if;
  labels:=p_selected_options#>'{orderCustomization,labels}';
  if labels is null or jsonb_typeof(labels)<>'object' then return ''; end if;
  for item in select key,value from jsonb_each(labels) order by key
  loop
    if jsonb_typeof(item.value)='object' and nullif(btrim(coalesce(item.value->>'group','')),'') is not null and nullif(btrim(coalesce(item.value->>'choice','')),'') is not null then
      parts:=array_append(parts,(item.value->>'group')||': '||(item.value->>'choice'));
    end if;
  end loop;
  return left(array_to_string(parts,' · '),200);
end;
$$;
revoke all on function private.order_customization_summary_v1(jsonb) from public;

create or replace function private.get_customer_cart_snapshot_v1(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare cart_row public.carts%rowtype; result jsonb;
begin
  if p_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into cart_row from public.carts where user_id=p_user_id and status='active' and (expires_at is null or expires_at>timezone('utc',now())) order by created_at desc limit 1;
  if cart_row.id is null then return jsonb_build_object('cartId',null,'currency','TRY','itemCount',0,'subtotalMinor',0,'items','[]'::jsonb); end if;
  with rows as (
    select item.id cart_item_id,item.quantity,item.selected_options,
      variant.id variant_id,variant.name raw_variant_name,variant.sku,variant.price_minor,variant.compare_at_price_minor,variant.weight_grams,
      product.id product_id,product.legacy_id,product.slug,product.name product_name,product.unit_label,product.stock_mode,product.currency,
      producer.id producer_id,producer.display_name producer_name,image.storage_path image_path,
      case when product.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0)) else null end sellable_quantity,
      (item.quantity*variant.price_minor)::bigint line_total_minor,
      (product.status='published' and product.is_active=true and product.deleted_at is null and variant.is_active=true and producer.status='active' and producer.is_verified=true and producer.deleted_at is null) available
    from public.cart_items item
    join public.product_variants variant on variant.id=item.variant_id
    join public.products product on product.id=variant.product_id
    join public.producers producer on producer.id=product.producer_id
    left join public.product_inventory inventory on inventory.variant_id=variant.id
    left join lateral(select pi.storage_path from public.product_images pi where pi.product_id=product.id order by pi.is_primary desc,pi.sort_order asc limit 1) image on true
    where item.cart_id=cart_row.id
  )
  select jsonb_build_object(
    'cartId',cart_row.id,'currency',cart_row.currency,'expiresAt',cart_row.expires_at,
    'itemCount',coalesce(sum(quantity),0),'subtotalMinor',coalesce(sum(line_total_minor),0),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'cartItemId',cart_item_id,'quantity',quantity,'selectedOptions',selected_options,
      'productId',product_id,'legacyId',legacy_id,'slug',slug,'productName',product_name,'unitLabel',unit_label,
      'variantId',variant_id,'variantName',left(raw_variant_name||case when private.order_customization_summary_v1(selected_options)<>'' then ' · '||private.order_customization_summary_v1(selected_options) else '' end,240),'sku',sku,'priceMinor',price_minor,'compareAtPriceMinor',compare_at_price_minor,'weightGrams',weight_grams,
      'producer',jsonb_build_object('id',producer_id,'name',producer_name),'imagePath',image_path,
      'stockMode',stock_mode,'sellableQuantity',sellable_quantity,'available',available,'lineTotalMinor',line_total_minor
    ) order by product_name,raw_variant_name),'[]'::jsonb)
  ) into result from rows;
  return result;
end;
$$;

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
  select coalesce(jsonb_agg(order_item||jsonb_build_object('items',coalesce(enriched.items,'[]'::jsonb)) order by order_ordinality),'[]'::jsonb)
  into orders_payload
  from jsonb_array_elements(coalesce(base->'orders','[]'::jsonb)) with ordinality order_rows(order_item,order_ordinality)
  left join lateral (
    select jsonb_agg(
      item || jsonb_build_object(
        'variantName',left(coalesce(item->>'variantName','Standart varyant')||case when private.order_customization_summary_v1(coalesce(db_item.snapshot->'selected_options','{}'::jsonb))<>'' then ' · '||private.order_customization_summary_v1(coalesce(db_item.snapshot->'selected_options','{}'::jsonb)) else '' end,240),
        'selectedOptions',coalesce(db_item.snapshot->'selected_options','{}'::jsonb),
        'preparationEvents',coalesce(events.items,'[]'::jsonb),
        'fulfillmentStatus',left(coalesce(item->>'fulfillmentStatus','unfulfilled')||case when events.latest_label is not null then ' · '||events.latest_label else '' end,60)
      ) order by item_ordinality
    ) as items
    from jsonb_array_elements(coalesce(order_item->'items','[]'::jsonb)) with ordinality item_rows(item,item_ordinality)
    left join public.order_items db_item on db_item.id=(item->>'id')::uuid
    left join lateral (
      select jsonb_agg(jsonb_build_object('id',e.id,'eventType',e.event_type,'note',e.note,'visibleToCustomer',e.visible_to_customer,'createdAt',e.created_at) order by e.created_at,e.id) items,
        (array_agg(case e.event_type when 'accepted' then 'sipariş kabul edildi' when 'harvest_planned' then 'hasat planlandı' when 'catch_planned' then 'av planlandı' when 'preparing' then 'hazırlanıyor' when 'packed' then 'paketlendi' when 'ready' then 'gönderime hazır' else 'hazırlık notu' end order by e.created_at desc,e.id desc))[1] latest_label
      from public.order_item_preparation_events e where e.order_item_id=db_item.id
    ) events on true
  ) enriched on true;
  return jsonb_set(base,'{orders}',orders_payload,true);
end;
$$;

create or replace function public.management_orders_snapshot_v2()
returns jsonb language sql set search_path='' as $$ select private.management_orders_snapshot_v3(); $$;
