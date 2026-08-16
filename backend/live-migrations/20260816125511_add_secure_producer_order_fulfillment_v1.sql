create or replace function private.recompute_order_fulfillment_v1(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target public.orders%rowtype;
  active_count integer:=0;
  unfulfilled_count integer:=0;
  processing_count integer:=0;
  fulfilled_count integer:=0;
  new_fulfillment text;
  new_status text;
begin
  select * into target from public.orders o where o.id=p_order_id for update;
  if target.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  select count(*) filter (where oi.fulfillment_status not in ('cancelled','returned')),count(*) filter (where oi.fulfillment_status='unfulfilled'),count(*) filter (where oi.fulfillment_status='processing'),count(*) filter (where oi.fulfillment_status='fulfilled')
  into active_count,unfulfilled_count,processing_count,fulfilled_count from public.order_items oi where oi.order_id=target.id;
  if active_count=0 then new_fulfillment:=target.fulfillment_status;
  elsif unfulfilled_count=0 and processing_count=0 then new_fulfillment:='fulfilled';
  elsif fulfilled_count>0 then new_fulfillment:='partially_fulfilled';
  elsif processing_count>0 then new_fulfillment:='processing';
  else new_fulfillment:='unfulfilled'; end if;
  new_status:=target.status;
  if target.status in ('confirmed','preparing','partially_shipped') then
    if new_fulfillment='fulfilled' then new_status:='shipped';
    elsif fulfilled_count>0 then new_status:='partially_shipped';
    elsif processing_count>0 then new_status:='preparing';
    elsif target.status='preparing' then new_status:='confirmed'; end if;
  end if;
  update public.orders set fulfillment_status=new_fulfillment,status=new_status,updated_at=timezone('utc',now()) where id=target.id;
  return jsonb_build_object('orderId',target.id,'previousStatus',target.status,'status',new_status,'previousFulfillmentStatus',target.fulfillment_status,'fulfillmentStatus',new_fulfillment,'activeItemCount',active_count,'unfulfilledItemCount',unfulfilled_count,'processingItemCount',processing_count,'fulfilledItemCount',fulfilled_count);
end;
$function$;
revoke all on function private.recompute_order_fulfillment_v1(uuid) from public,anon,authenticated;

create or replace function private.list_my_producer_orders_v1(p_scope text default 'open',p_limit integer default 30,p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid();producer_id_value uuid;normalized_scope text:=lower(btrim(coalesce(p_scope,'open')));result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if normalized_scope not in ('open','shipped','all') then raise exception 'invalid_order_scope' using errcode='22023'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select p.id into producer_id_value from public.producers p where p.owner_user_id=caller_id and p.status='active' and p.is_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
  if producer_id_value is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  with item_rows as (
    select oi.order_id,oi.id,oi.line_total_minor,oi.fulfillment_status,greatest(0,oi.quantity-coalesce((select sum(si.quantity)::integer from public.shipment_items si where si.order_item_id=oi.id),0)) remaining_quantity
    from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.producer_id=producer_id_value and o.payment_status in ('paid','partially_refunded','refunded') and o.status not in ('draft','pending_payment','cancelled')
  ),grouped as (
    select ir.order_id,count(*)::integer item_count,sum(ir.line_total_minor)::bigint producer_subtotal_minor,count(*) filter(where ir.remaining_quantity>0 and ir.fulfillment_status not in ('cancelled','returned'))::integer remaining_item_count,count(*) filter(where ir.fulfillment_status='processing')::integer processing_item_count,count(*) filter(where ir.fulfillment_status='fulfilled')::integer fulfilled_item_count from item_rows ir group by ir.order_id
  ),filtered as (
    select o.*,g.item_count,g.producer_subtotal_minor,g.remaining_item_count,g.processing_item_count,g.fulfilled_item_count from grouped g join public.orders o on o.id=g.order_id
    where normalized_scope='all' or(normalized_scope='open' and g.remaining_item_count>0 and o.status not in ('shipped','delivered','completed','refunded')) or(normalized_scope='shipped' and(g.remaining_item_count=0 or o.status in ('shipped','delivered','completed','refunded')))
  ),paged as(select * from filtered order by coalesce(placed_at,created_at) desc limit p_limit offset p_offset)
  select jsonb_build_object('scope',normalized_scope,'limit',p_limit,'offset',p_offset,'total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'orderNumber',p.order_number,'status',p.status,'paymentStatus',p.payment_status,'fulfillmentStatus',p.fulfillment_status,'currency',p.currency,'producerSubtotalMinor',p.producer_subtotal_minor,'itemCount',p.item_count,'remainingItemCount',p.remaining_item_count,'processingItemCount',p.processing_item_count,'fulfilledItemCount',p.fulfilled_item_count,'recipientName',coalesce(p.shipping_address->>'recipient_name',p.shipping_address->>'recipientName'),'destination',jsonb_build_object('countryCode',coalesce(p.shipping_address->>'country_code',p.shipping_address->>'countryCode'),'province',p.shipping_address->>'province','district',p.shipping_address->>'district'),'placedAt',p.placed_at,'createdAt',p.created_at) order by coalesce(p.placed_at,p.created_at) desc) from paged p),'[]'::jsonb)) into result;
  return result;
end;
$function$;
revoke all on function private.list_my_producer_orders_v1(text,integer,integer) from public,anon,authenticated;
create or replace function public.list_my_producer_orders_v1(p_scope text default 'open',p_limit integer default 30,p_offset integer default 0) returns jsonb language sql stable set search_path to '' as $function$ select private.list_my_producer_orders_v1(p_scope,p_limit,p_offset); $function$;
revoke all on function public.list_my_producer_orders_v1(text,integer,integer) from public,anon;
grant execute on function public.list_my_producer_orders_v1(text,integer,integer) to authenticated;

create or replace function private.get_my_producer_order_detail_v1(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid();producer_id_value uuid;target public.orders%rowtype;result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select p.id into producer_id_value from public.producers p where p.owner_user_id=caller_id and p.status='active' and p.is_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
  if producer_id_value is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  select * into target from public.orders o where o.id=p_order_id and o.payment_status in ('paid','partially_refunded','refunded') and exists(select 1 from public.order_items oi where oi.order_id=o.id and oi.producer_id=producer_id_value);
  if target.id is null then raise exception 'producer_order_not_found' using errcode='P0002'; end if;
  select jsonb_build_object('id',target.id,'orderNumber',target.order_number,'status',target.status,'paymentStatus',target.payment_status,'fulfillmentStatus',target.fulfillment_status,'currency',target.currency,
    'producerSubtotalMinor',(select coalesce(sum(oi.line_total_minor),0)::bigint from public.order_items oi where oi.order_id=target.id and oi.producer_id=producer_id_value),'placedAt',target.placed_at,
    'shipping',jsonb_build_object('recipientName',coalesce(target.shipping_address->>'recipient_name',target.shipping_address->>'recipientName'),'phone',target.shipping_address->>'phone','countryCode',coalesce(target.shipping_address->>'country_code',target.shipping_address->>'countryCode'),'province',target.shipping_address->>'province','district',target.shipping_address->>'district','neighborhood',target.shipping_address->>'neighborhood','addressLine',coalesce(target.shipping_address->>'address_line',target.shipping_address->>'addressLine'),'postalCode',coalesce(target.shipping_address->>'postal_code',target.shipping_address->>'postalCode'),'deliveryNotes',coalesce(target.shipping_address->>'delivery_notes',target.shipping_address->>'deliveryNotes')),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'productId',oi.product_id,'variantId',oi.variant_id,'productName',oi.product_name,'variantName',oi.variant_name,'sku',oi.sku,'imagePath',oi.image_path,'quantity',oi.quantity,'unitPriceMinor',oi.unit_price_minor,'lineTotalMinor',oi.line_total_minor,'fulfillmentStatus',oi.fulfillment_status,'shippedQuantity',coalesce((select sum(si.quantity)::integer from public.shipment_items si where si.order_item_id=oi.id),0),'remainingToShip',greatest(0,oi.quantity-coalesce((select sum(si.quantity)::integer from public.shipment_items si where si.order_item_id=oi.id),0))) order by oi.created_at) from public.order_items oi where oi.order_id=target.id and oi.producer_id=producer_id_value),'[]'::jsonb),
    'shipments',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'carrier',s.carrier,'trackingNumber',s.tracking_number,'trackingUrl',s.tracking_url,'status',s.status,'shippedAt',s.shipped_at,'estimatedDeliveryAt',s.estimated_delivery_at,'deliveredAt',s.delivered_at,'items',coalesce((select jsonb_agg(jsonb_build_object('orderItemId',si.order_item_id,'quantity',si.quantity) order by si.order_item_id) from public.shipment_items si join public.order_items oi2 on oi2.id=si.order_item_id where si.shipment_id=s.id and oi2.producer_id=producer_id_value),'[]'::jsonb)) order by s.created_at desc) from public.shipments s where s.order_id=target.id and exists(select 1 from public.shipment_items si join public.order_items oi on oi.id=si.order_item_id where si.shipment_id=s.id and oi.producer_id=producer_id_value)),'[]'::jsonb),
    'canFulfill',target.payment_status='paid' and target.status in ('confirmed','preparing','partially_shipped') and exists(select 1 from public.order_items oi where oi.order_id=target.id and oi.producer_id=producer_id_value and oi.fulfillment_status not in ('fulfilled','cancelled','returned') and oi.quantity>coalesce((select sum(si.quantity)::integer from public.shipment_items si where si.order_item_id=oi.id),0))) into result;
  return result;
end;
$function$;
revoke all on function private.get_my_producer_order_detail_v1(uuid) from public,anon,authenticated;
create or replace function public.get_my_producer_order_detail_v1(p_order_id uuid) returns jsonb language sql stable set search_path to '' as $function$ select private.get_my_producer_order_detail_v1(p_order_id); $function$;
revoke all on function public.get_my_producer_order_detail_v1(uuid) from public,anon;
grant execute on function public.get_my_producer_order_detail_v1(uuid) to authenticated;

create or replace function private.producer_mark_order_items_processing_v1(p_order_id uuid,p_order_item_ids uuid[])
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare caller_id uuid:=auth.uid();producer_id_value uuid;target public.orders%rowtype;requested_count integer;matched_count integer;recomputed jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_order_item_ids is null or coalesce(array_length(p_order_item_ids,1),0) not between 1 and 50 then raise exception 'order_items_required' using errcode='22023'; end if;
 select count(distinct id),count(*) into matched_count,requested_count from unnest(p_order_item_ids) id;
 if matched_count<>requested_count then raise exception 'duplicate_order_items' using errcode='22023'; end if;
 select p.id into producer_id_value from public.producers p where p.owner_user_id=caller_id and p.status='active' and p.is_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
 if producer_id_value is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
 select * into target from public.orders o where o.id=p_order_id for update;
 if target.id is null or target.payment_status<>'paid' or target.status not in ('confirmed','preparing','partially_shipped') then raise exception 'order_not_fulfillable' using errcode='55000'; end if;
 select count(*) into matched_count from public.order_items oi where oi.id=any(p_order_item_ids) and oi.order_id=target.id and oi.producer_id=producer_id_value and oi.fulfillment_status in ('unfulfilled','processing');
 if matched_count<>requested_count then raise exception 'invalid_producer_order_items' using errcode='42501'; end if;
 update public.order_items set fulfillment_status='processing' where id=any(p_order_item_ids) and fulfillment_status='unfulfilled';
 recomputed:=private.recompute_order_fulfillment_v1(target.id);
 if(recomputed->>'status') is distinct from(recomputed->>'previousStatus') then
  insert into public.order_status_history(order_id,from_status,to_status,note,visible_to_customer,actor_user_id) values(target.id,recomputed->>'previousStatus',recomputed->>'status','Siparişiniz hazırlanıyor.',true,caller_id);
  insert into public.notifications(user_id,type,title,message,action_url,metadata) values(target.user_id,'order','Siparişiniz hazırlanıyor',format('%s numaralı siparişinizin ürünleri hazırlanmaya başladı.',target.order_number),'/?tab=account',jsonb_build_object('orderId',target.id));
 end if;
 return private.get_my_producer_order_detail_v1(target.id);
end;
$function$;
revoke all on function private.producer_mark_order_items_processing_v1(uuid,uuid[]) from public,anon,authenticated;
create or replace function public.producer_mark_order_items_processing_v1(p_order_id uuid,p_order_item_ids uuid[]) returns jsonb language sql set search_path to '' as $function$ select private.producer_mark_order_items_processing_v1(p_order_id,p_order_item_ids); $function$;
revoke all on function public.producer_mark_order_items_processing_v1(uuid,uuid[]) from public,anon;
grant execute on function public.producer_mark_order_items_processing_v1(uuid,uuid[]) to authenticated;

create or replace function private.producer_create_shipment_v1(p_order_id uuid,p_items jsonb,p_carrier text,p_tracking_number text,p_tracking_url text,p_estimated_delivery_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare caller_id uuid:=auth.uid();producer_id_value uuid;target public.orders%rowtype;normalized_carrier text:=btrim(coalesce(p_carrier,''));normalized_tracking text:=btrim(coalesce(p_tracking_number,''));normalized_url text:=nullif(btrim(coalesce(p_tracking_url,'')),'');new_shipment_id uuid;element jsonb;order_item_id_value uuid;quantity_value integer;item_row public.order_items%rowtype;shipped_before integer;requested_count integer;recomputed jsonb;previous_status text;next_status text;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'shipment_items_required' using errcode='22023'; end if;
 if char_length(normalized_carrier) not between 2 and 100 then raise exception 'invalid_carrier' using errcode='22023'; end if;
 if char_length(normalized_tracking) not between 2 and 160 then raise exception 'invalid_tracking_number' using errcode='22023'; end if;
 if normalized_url is not null and(char_length(normalized_url)>500 or normalized_url !~ '^https://') then raise exception 'invalid_tracking_url' using errcode='22023'; end if;
 if p_estimated_delivery_at is not null and(p_estimated_delivery_at<timezone('utc',now())-interval '5 minutes' or p_estimated_delivery_at>timezone('utc',now())+interval '120 days') then raise exception 'invalid_estimated_delivery' using errcode='22023'; end if;
 if exists(select 1 from public.shipments s where lower(s.carrier)=lower(normalized_carrier) and s.tracking_number=normalized_tracking) then raise exception 'tracking_number_already_used' using errcode='23505'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) e group by e->>'orderItemId' having count(*)>1) then raise exception 'duplicate_shipment_items' using errcode='22023'; end if;
 select p.id into producer_id_value from public.producers p where p.owner_user_id=caller_id and p.status='active' and p.is_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
 if producer_id_value is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
 select * into target from public.orders o where o.id=p_order_id for update;
 if target.id is null or target.payment_status<>'paid' or target.status not in ('confirmed','preparing','partially_shipped') then raise exception 'order_not_fulfillable' using errcode='55000'; end if;
 requested_count:=jsonb_array_length(p_items);
 for element in select value from jsonb_array_elements(p_items) loop
  begin order_item_id_value:=(element->>'orderItemId')::uuid; exception when others then raise exception 'invalid_order_item_id' using errcode='22023'; end;
  begin quantity_value:=(element->>'quantity')::integer; exception when others then raise exception 'invalid_shipment_quantity' using errcode='22023'; end;
  if quantity_value<1 then raise exception 'invalid_shipment_quantity' using errcode='22023'; end if;
  select * into item_row from public.order_items oi where oi.id=order_item_id_value and oi.order_id=target.id and oi.producer_id=producer_id_value for update;
  if item_row.id is null or item_row.fulfillment_status in ('cancelled','returned','fulfilled') then raise exception 'invalid_producer_order_item' using errcode='42501'; end if;
  select coalesce(sum(si.quantity),0)::integer into shipped_before from public.shipment_items si where si.order_item_id=item_row.id;
  if quantity_value>item_row.quantity-shipped_before then raise exception 'shipment_quantity_exceeds_remaining' using errcode='22023'; end if;
 end loop;
 insert into public.shipments(order_id,carrier,tracking_number,tracking_url,status,shipped_at,estimated_delivery_at) values(target.id,normalized_carrier,normalized_tracking,normalized_url,'in_transit',timezone('utc',now()),p_estimated_delivery_at) returning id into new_shipment_id;
 for element in select value from jsonb_array_elements(p_items) loop order_item_id_value:=(element->>'orderItemId')::uuid;quantity_value:=(element->>'quantity')::integer;insert into public.shipment_items(shipment_id,order_item_id,quantity) values(new_shipment_id,order_item_id_value,quantity_value);end loop;
 update public.order_items oi set fulfillment_status=case when coalesce((select sum(si.quantity)::integer from public.shipment_items si where si.order_item_id=oi.id),0)>=oi.quantity then 'fulfilled' else 'processing' end where oi.order_id=target.id and oi.producer_id=producer_id_value and oi.id in(select(e->>'orderItemId')::uuid from jsonb_array_elements(p_items)e);
 recomputed:=private.recompute_order_fulfillment_v1(target.id);previous_status:=recomputed->>'previousStatus';next_status:=recomputed->>'status';
 if next_status is distinct from previous_status then insert into public.order_status_history(order_id,from_status,to_status,note,visible_to_customer,actor_user_id) values(target.id,previous_status,next_status,case when next_status='shipped' then 'Siparişiniz kargoya verildi.' else 'Siparişinizin bir bölümü kargoya verildi.' end,true,caller_id);end if;
 insert into public.notifications(user_id,type,title,message,action_url,metadata) values(target.user_id,'shipment',case when next_status='shipped' then 'Siparişiniz kargoya verildi' else 'Siparişinizin bir bölümü kargoda' end,format('%s ile gönderildi. Takip numarası: %s',normalized_carrier,normalized_tracking),'/?tab=account',jsonb_build_object('orderId',target.id,'shipmentId',new_shipment_id,'carrier',normalized_carrier,'trackingNumber',normalized_tracking));
 insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('shipment',new_shipment_id,'shipment.created',jsonb_build_object('shipment_id',new_shipment_id,'order_id',target.id,'producer_id',producer_id_value));
 return private.get_my_producer_order_detail_v1(target.id);
end;
$function$;
revoke all on function private.producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamptz) from public,anon,authenticated;
create or replace function public.producer_create_shipment_v1(p_order_id uuid,p_items jsonb,p_carrier text,p_tracking_number text,p_tracking_url text,p_estimated_delivery_at timestamptz default null) returns jsonb language sql set search_path to '' as $function$ select private.producer_create_shipment_v1(p_order_id,p_items,p_carrier,p_tracking_number,p_tracking_url,p_estimated_delivery_at); $function$;
revoke all on function public.producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamptz) from public,anon;
grant execute on function public.producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamptz) to authenticated;
