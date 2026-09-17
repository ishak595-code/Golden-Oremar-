-- Drift closure: order status management shared by admins and producers,
-- category upsert, producer ledger entry creation on paid orders, and the
-- product change-request payload validator.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.management_update_order_status_v1(p_order_id uuid, p_status text, p_tracking_number text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
  caller_producer_id uuid;
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  normalized_tracking text := nullif(btrim(coalesce(p_tracking_number, '')), '');
  normalized_note text := nullif(btrim(coalesce(p_note, '')), '');
  target_order public.orders%rowtype;
  next_order_status text;
  next_fulfillment_status text;
  v_shipment_id uuid;
  unfulfilled_count integer;
begin
  if caller_id is null or p_order_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if normalized_status='payment_pending_escrow' then normalized_status:='pending_payment'; end if;
  if normalized_status not in ('draft','pending_payment','confirmed','preparing','partially_shipped','shipped','delivered','completed','cancelled','refunded') then raise exception 'invalid_order_status' using errcode='22023'; end if;
  if char_length(coalesce(normalized_note,''))>1000 or char_length(coalesce(normalized_tracking,''))>120 then raise exception 'invalid_order_update_field' using errcode='22023'; end if;

  select * into target_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode='P0002'; end if;

  caller_is_admin := coalesce(private.has_permission('order.manage'),false);
  select producer.id into caller_producer_id
  from public.producers producer
  where producer.owner_user_id=caller_id and producer.deleted_at is null and producer.status='active'
  order by producer.created_at desc limit 1;

  if not caller_is_admin then
    if caller_producer_id is null or not exists(select 1 from public.order_items item where item.order_id=target_order.id and item.producer_id=caller_producer_id) then raise exception 'order_access_denied' using errcode='42501'; end if;
    if normalized_status not in ('preparing','shipped') then raise exception 'producer_fulfillment_status_only' using errcode='42501'; end if;
    if target_order.status in ('cancelled','refunded','completed') then raise exception 'order_is_terminal' using errcode='22023'; end if;
    if target_order.status not in ('confirmed','preparing','partially_shipped','shipped') then raise exception 'order_not_ready_for_fulfillment' using errcode='22023'; end if;

    if normalized_status='preparing' then
      update public.order_items set fulfillment_status='processing'
      where order_id=target_order.id and producer_id=caller_producer_id and fulfillment_status='unfulfilled';
      next_order_status := case when target_order.status='confirmed' then 'preparing' else target_order.status end;
      next_fulfillment_status := 'processing';
    else
      if normalized_tracking is null or char_length(normalized_tracking)<4 then raise exception 'tracking_number_required' using errcode='22023'; end if;
      insert into public.shipments(order_id,carrier,tracking_number,status,shipped_at)
      values(target_order.id,'other',normalized_tracking,'in_transit',timezone('utc',now()))
      on conflict(carrier,tracking_number) do update set status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,timezone('utc',now()))
      returning id into v_shipment_id;
      insert into public.shipment_items(shipment_id,order_item_id,quantity)
      select v_shipment_id,item.id,item.quantity from public.order_items item
      where item.order_id=target_order.id and item.producer_id=caller_producer_id and item.fulfillment_status<>'cancelled'
      on conflict(shipment_id,order_item_id) do update set quantity=excluded.quantity;
      update public.order_items set fulfillment_status='fulfilled'
      where order_id=target_order.id and producer_id=caller_producer_id and fulfillment_status<>'cancelled';
      select count(*) into unfulfilled_count from public.order_items item
      where item.order_id=target_order.id and item.fulfillment_status not in ('fulfilled','returned','cancelled');
      next_order_status := case when unfulfilled_count=0 then 'shipped' else 'partially_shipped' end;
      next_fulfillment_status := case when unfulfilled_count=0 then 'fulfilled' else 'partially_fulfilled' end;
    end if;
    update public.orders set status=next_order_status,fulfillment_status=next_fulfillment_status,updated_at=timezone('utc',now()) where id=target_order.id;
  else
    if target_order.status=normalized_status then return jsonb_build_object('id',target_order.id,'status',target_order.status,'unchanged',true); end if;
    if not (
      (target_order.status='draft' and normalized_status in ('pending_payment','cancelled')) or
      (target_order.status='pending_payment' and normalized_status in ('confirmed','cancelled')) or
      (target_order.status='confirmed' and normalized_status in ('preparing','cancelled')) or
      (target_order.status='preparing' and normalized_status in ('partially_shipped','shipped','cancelled')) or
      (target_order.status='partially_shipped' and normalized_status='shipped') or
      (target_order.status='shipped' and normalized_status='delivered') or
      (target_order.status='delivered' and normalized_status='completed')
    ) then raise exception 'invalid_order_status_transition:%:%',target_order.status,normalized_status using errcode='22023'; end if;

    if target_order.status='pending_payment' and normalized_status='confirmed' then
      if target_order.payment_status not in ('authorized','paid') then raise exception 'verified_payment_required_before_confirmation' using errcode='55000'; end if;
      perform private.consume_order_inventory_v1(target_order.id,caller_id);
    end if;
    if normalized_status='cancelled' then
      if target_order.payment_status<>'unpaid' then raise exception 'paid_order_requires_refund_workflow' using errcode='22023'; end if;
      perform private.release_order_inventory(target_order.id);
    end if;
    if normalized_status in ('partially_shipped','shipped') and (normalized_tracking is null or char_length(normalized_tracking)<4) then raise exception 'tracking_number_required' using errcode='22023'; end if;

    next_fulfillment_status := case normalized_status when 'preparing' then 'processing' when 'partially_shipped' then 'partially_fulfilled' when 'shipped' then 'fulfilled' when 'delivered' then 'fulfilled' when 'completed' then 'fulfilled' else target_order.fulfillment_status end;
    if normalized_status in ('partially_shipped','shipped') then
      insert into public.shipments(order_id,carrier,tracking_number,status,shipped_at)
      values(target_order.id,'other',normalized_tracking,'in_transit',timezone('utc',now()))
      on conflict(carrier,tracking_number) do update set status='in_transit',shipped_at=coalesce(public.shipments.shipped_at,timezone('utc',now()))
      returning id into v_shipment_id;
      insert into public.shipment_items(shipment_id,order_item_id,quantity)
      select v_shipment_id,item.id,item.quantity from public.order_items item where item.order_id=target_order.id and item.fulfillment_status<>'cancelled'
      on conflict(shipment_id,order_item_id) do update set quantity=excluded.quantity;
    end if;
    update public.order_items set fulfillment_status=case normalized_status when 'preparing' then 'processing' when 'shipped' then 'fulfilled' when 'cancelled' then 'cancelled' else fulfillment_status end where order_id=target_order.id;
    update public.orders set status=normalized_status,fulfillment_status=next_fulfillment_status,
      cancelled_at=case when normalized_status='cancelled' then timezone('utc',now()) else cancelled_at end,
      completed_at=case when normalized_status='completed' then timezone('utc',now()) else completed_at end,
      reservation_expires_at=case when normalized_status in ('confirmed','cancelled') then null else reservation_expires_at end,
      updated_at=timezone('utc',now()) where id=target_order.id;
    next_order_status:=normalized_status;
  end if;

  insert into public.order_status_history(order_id,from_status,to_status,note,visible_to_customer,actor_user_id)
  values(target_order.id,target_order.status,next_order_status,coalesce(normalized_note,case when caller_is_admin then 'Yönetim paneli durum güncellemesi.' else 'Satıcı gönderim durumu güncellemesi.' end),true,caller_id);
  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(target_order.user_id,case when next_order_status in ('partially_shipped','shipped','delivered') then 'shipment' else 'order' end,'Sipariş durumunuz güncellendi',target_order.order_number||' numaralı siparişinizin yeni durumu: '||next_order_status||'.','/account/orders',jsonb_build_object('orderId',target_order.id,'status',next_order_status,'trackingNumber',normalized_tracking));
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('order',target_order.id,'order.status_changed',jsonb_build_object('order_id',target_order.id,'from_status',target_order.status,'to_status',next_order_status,'actor_user_id',caller_id,'producer_id',caller_producer_id));
  return jsonb_build_object('id',target_order.id,'status',next_order_status,'fulfillmentStatus',next_fulfillment_status,'trackingNumber',normalized_tracking);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.management_upsert_category_v1(p_reference text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  v_category_id uuid := private.resolve_category_id_v1(p_reference);
  normalized_name text;
  normalized_slug text;
  category_row public.categories%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('content.update'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_category_payload' using errcode = '22023';
  end if;

  normalized_name := btrim(coalesce(p_payload ->> 'name', ''));
  if v_category_id is null and char_length(normalized_name) not between 2 and 120 then
    raise exception 'category_name_required' using errcode = '22023';
  end if;
  if p_payload ? 'name' and char_length(normalized_name) not between 2 and 120 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;
  if char_length(coalesce(p_payload ->> 'description', '')) > 3000
    or char_length(coalesce(p_payload ->> 'icon', '')) > 80
    or char_length(coalesce(p_payload ->> 'image', '')) > 2048 then
    raise exception 'invalid_category_field_length' using errcode = '22023';
  end if;
  if coalesce(p_payload ->> 'image', '') ~* '^(blob:|data:)' then
    raise exception 'persistent_category_image_required' using errcode = '22023';
  end if;

  if v_category_id is null then
    normalized_slug := private.slugify_tr_v1(coalesce(nullif(p_payload ->> 'targetCategory', ''), normalized_name));
    if normalized_slug = '' then
      raise exception 'invalid_category_slug' using errcode = '22023';
    end if;
    if exists (select 1 from public.categories category where category.slug = normalized_slug) then
      normalized_slug := normalized_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
    insert into public.categories(slug, name, description, icon, image_path, sort_order, is_active)
    values (
      normalized_slug,
      normalized_name,
      btrim(coalesce(p_payload ->> 'description', '')),
      nullif(btrim(coalesce(p_payload ->> 'icon', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'image', '')), ''),
      coalesce((p_payload ->> 'sortOrder')::integer, 0),
      coalesce((p_payload ->> 'is_active')::boolean, true)
    )
    returning * into category_row;
  else
    update public.categories
    set name = case when p_payload ? 'name' then normalized_name else name end,
        description = case when p_payload ? 'description' then btrim(coalesce(p_payload ->> 'description', '')) else description end,
        icon = case when p_payload ? 'icon' then nullif(btrim(coalesce(p_payload ->> 'icon', '')), '') else icon end,
        image_path = case when p_payload ? 'image' then nullif(btrim(coalesce(p_payload ->> 'image', '')), '') else image_path end,
        sort_order = case when p_payload ? 'sortOrder' then (p_payload ->> 'sortOrder')::integer else sort_order end,
        is_active = case when p_payload ? 'is_active' then (p_payload ->> 'is_active')::boolean else is_active end
    where id = v_category_id
    returning * into category_row;
  end if;

  return jsonb_build_object(
    'id', category_row.slug,
    'databaseId', category_row.id,
    'name', category_row.name,
    'is_active', category_row.is_active
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.record_order_producer_sales_v1(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_order public.orders%rowtype;
  item record;
  fee_minor bigint;
  merchandise_minor bigint;
  gross_minor bigint;
  net_minor bigint;
begin
  select * into target_order from public.orders where id=p_order_id;
  if target_order.id is null or target_order.payment_status<>'paid' then return; end if;

  for item in
    select oi.id,oi.producer_id,oi.unit_price_minor,oi.quantity,oi.discount_minor,oi.tax_minor,
           oi.commission_basis_points_snapshot as commission_basis_points
    from public.order_items oi
    where oi.order_id=target_order.id and oi.producer_id is not null
    order by oi.id
  loop
    merchandise_minor:=(item.unit_price_minor*item.quantity)-item.discount_minor;
    gross_minor:=merchandise_minor+item.tax_minor;
    fee_minor:=round((merchandise_minor::numeric*item.commission_basis_points::numeric)/10000)::bigint;
    net_minor:=gross_minor-fee_minor;

    insert into private.producer_ledger_entries(
      producer_id,order_id,order_item_id,entry_type,currency,merchandise_minor,tax_minor,
      producer_gross_minor,platform_fee_minor,producer_net_minor,commission_basis_points,
      availability_status,source_key,metadata
    ) values (
      item.producer_id,target_order.id,item.id,'sale',target_order.currency,merchandise_minor,item.tax_minor,
      gross_minor,fee_minor,net_minor,item.commission_basis_points,
      case when target_order.status='completed' then 'available' else 'pending' end,
      'sale:'||item.id::text,
      jsonb_build_object('order_number',target_order.order_number,'commission_snapshot_basis_points',item.commission_basis_points)
    )
    on conflict (source_key) do nothing;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.validate_product_change_payload_v1(p_product_id uuid, p_producer_id uuid, p_requested_by uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  producer_row public.producers%rowtype;
  product_row public.products%rowtype;
  key_name text;
  media_path text;
  gallery jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload='{}'::jsonb or pg_column_size(p_payload)>262144 then
    raise exception 'invalid_product_change_payload' using errcode='22023';
  end if;
  select * into product_row from public.products where id=p_product_id;
  select * into producer_row from public.producers where id=p_producer_id and deleted_at is null;
  if product_row.id is null or producer_row.id is null or product_row.producer_id<>producer_row.id or producer_row.owner_user_id<>p_requested_by then
    raise exception 'product_change_context_invalid' using errcode='42501';
  end if;
  if product_row.status<>'published' then raise exception 'only_published_product_uses_change_request' using errcode='55000'; end if;
  if producer_row.status<>'active' or not producer_row.is_verified then raise exception 'verified_active_producer_required' using errcode='42501'; end if;

  for key_name in select jsonb_object_keys(p_payload)
  loop
    if key_name not in (
      'name','description','story','origin','unit','video','price','originalPrice','tags','features',
      'category','categoryId','weight','weightOptions','cutOptions','preOrderTime','pricePrefix','preOrder',
      'gallery','image','is_active'
    ) then
      raise exception 'unsupported_product_change_field:%',key_name using errcode='22023';
    end if;
  end loop;

  if p_payload ? 'name' and char_length(btrim(coalesce(p_payload->>'name',''))) not between 2 and 180 then raise exception 'invalid_product_name' using errcode='22023'; end if;
  if p_payload ? 'description' and char_length(btrim(coalesce(p_payload->>'description',''))) not between 20 and 20000 then raise exception 'invalid_product_description' using errcode='22023'; end if;
  if p_payload ? 'story' and char_length(btrim(coalesce(p_payload->>'story',''))) not between 20 and 20000 then raise exception 'invalid_product_story' using errcode='22023'; end if;
  if p_payload ? 'origin' and char_length(btrim(coalesce(p_payload->>'origin',''))) not between 2 and 500 then raise exception 'invalid_product_origin' using errcode='22023'; end if;
  if p_payload ? 'unit' and char_length(btrim(coalesce(p_payload->>'unit',''))) not between 1 and 80 then raise exception 'invalid_product_unit' using errcode='22023'; end if;
  if p_payload ? 'price' and (jsonb_typeof(p_payload->'price')<>'number' or (p_payload->>'price')::numeric<=0 or (p_payload->>'price')::numeric>1000000) then raise exception 'invalid_product_price' using errcode='22023'; end if;
  if p_payload ? 'originalPrice' and (jsonb_typeof(p_payload->'originalPrice')<>'number' or (p_payload->>'originalPrice')::numeric<0 or (p_payload->>'originalPrice')::numeric>1000000) then raise exception 'invalid_compare_price' using errcode='22023'; end if;
  if p_payload ? 'weight' and (jsonb_typeof(p_payload->'weight')<>'number' or (p_payload->>'weight')::numeric<=0 or (p_payload->>'weight')::numeric>1000) then raise exception 'invalid_product_weight' using errcode='22023'; end if;
  if p_payload ? 'preOrder' and jsonb_typeof(p_payload->'preOrder')<>'boolean' then raise exception 'invalid_preorder_flag' using errcode='22023'; end if;
  if p_payload ? 'is_active' and jsonb_typeof(p_payload->'is_active')<>'boolean' then raise exception 'invalid_product_active_flag' using errcode='22023'; end if;
  if p_payload ? 'tags' and (jsonb_typeof(p_payload->'tags')<>'array' or jsonb_array_length(p_payload->'tags')>30) then raise exception 'invalid_product_tags' using errcode='22023'; end if;
  if p_payload ? 'features' and (jsonb_typeof(p_payload->'features')<>'array' or jsonb_array_length(p_payload->'features')>40) then raise exception 'invalid_product_features' using errcode='22023'; end if;
  if p_payload ? 'weightOptions' and jsonb_typeof(p_payload->'weightOptions') not in ('array','object') then raise exception 'invalid_weight_options' using errcode='22023'; end if;
  if p_payload ? 'cutOptions' and jsonb_typeof(p_payload->'cutOptions') not in ('array','object') then raise exception 'invalid_cut_options' using errcode='22023'; end if;
  if p_payload ? 'category' or p_payload ? 'categoryId' then
    if private.resolve_category_id_v1(coalesce(nullif(p_payload->>'categoryId',''),p_payload->>'category')) is null then raise exception 'category_not_found' using errcode='P0002'; end if;
  end if;
  if p_payload ? 'video' and nullif(btrim(coalesce(p_payload->>'video','')),'') is not null and coalesce(p_payload->>'video','') !~* '^https://' then raise exception 'https_product_video_required' using errcode='22023'; end if;

  if p_payload ? 'image' and nullif(btrim(coalesce(p_payload->>'image','')),'') is not null then
    media_path:=btrim(p_payload->>'image');
    if split_part(media_path,'/',1)<>producer_row.id::text or not exists(select 1 from storage.objects object where object.bucket_id='catalog-public' and object.name=media_path) then raise exception 'product_image_not_uploaded' using errcode='22023'; end if;
  end if;
  if p_payload ? 'gallery' then
    gallery:=p_payload->'gallery';
    if jsonb_typeof(gallery)<>'array' or jsonb_array_length(gallery)>10 then raise exception 'invalid_product_gallery' using errcode='22023'; end if;
    for media_path in select btrim(value) from jsonb_array_elements_text(gallery)
    loop
      if split_part(media_path,'/',1)<>producer_row.id::text or not exists(select 1 from storage.objects object where object.bucket_id='catalog-public' and object.name=media_path) then raise exception 'product_gallery_image_not_uploaded' using errcode='22023'; end if;
    end loop;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.management_update_order_status_v1(p_order_id uuid, p_status text, p_tracking_number text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_update_order_status_v1(p_order_id, p_status, p_tracking_number, p_note); $function$
;

CREATE OR REPLACE FUNCTION public.management_upsert_category_v1(p_reference text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_upsert_category_v1(p_reference, p_payload); $function$
;
