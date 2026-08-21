create or replace function private.management_orders_snapshot_v2()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  caller_is_admin boolean;
  caller_producer_id uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  caller_is_admin:=coalesce(private.is_admin(),false);
  select producer.id into caller_producer_id
  from public.producers producer
  where producer.owner_user_id=caller_id
    and producer.deleted_at is null
    and producer.status in ('active','suspended')
  order by producer.created_at desc
  limit 1;
  if not caller_is_admin and caller_producer_id is null then raise exception 'management_role_required' using errcode='42501'; end if;

  return jsonb_build_object(
    'orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',customer_order.id,
        'orderNumber',customer_order.order_number,
        'customer',case when caller_is_admin then coalesce(nullif(profile.display_name,''),auth_user.email,'Müşteri') else coalesce(nullif(profile.display_name,''),customer_order.shipping_address->>'recipientName',customer_order.shipping_address->>'recipient_name','Müşteri') end,
        'customerEmail',case when caller_is_admin then auth_user.email else null end,
        'date',coalesce(customer_order.placed_at,customer_order.created_at),
        'status',customer_order.status,
        'paymentStatus',customer_order.payment_status,
        'fulfillmentStatus',customer_order.fulfillment_status,
        'currency',customer_order.currency,
        'total',(case when caller_is_admin then customer_order.total_minor else coalesce(item_summary.producer_total_minor,0) end)::numeric/100,
        'totalMinor',case when caller_is_admin then customer_order.total_minor else coalesce(item_summary.producer_total_minor,0) end,
        'reservationExpiresAt',customer_order.reservation_expires_at,
        'shippingAddress',customer_order.shipping_address,
        'customerNote',customer_order.customer_note,
        'items',coalesce(item_summary.items,'[]'::jsonb),
        'gift',case when gift.order_id is null then null else jsonb_strip_nulls(jsonb_build_object(
          'recipientName',gift.recipient_name,
          'message',gift.gift_message,
          'senderName',gift.sender_name,
          'hidePrice',gift.hide_price,
          'occasion',gift.occasion,
          'presentationStyle',gift.presentation_style,
          'cardTitle',gift.card_title
        )) end,
        'paymentMethod',case when caller_is_admin and payment_pref.order_id is not null then jsonb_strip_nulls(jsonb_build_object(
          'provider',payment_pref.provider,
          'brand',payment_method.brand,
          'last4',payment_method.last4,
          'nickname',payment_method.nickname,
          'expMonth',payment_method.exp_month,
          'expYear',payment_method.exp_year,
          'status',payment_method.status
        )) else null end,
        'returnStatus',case when return_request.status in ('requested','under_review') then 'Requested' when return_request.status in ('approved','in_transit','received') then 'Approved' when return_request.status='rejected' then 'Rejected' when return_request.status in ('refunded','closed') then 'Completed' else null end,
        'returnReason',return_request.customer_message,
        'returnId',return_request.id,
        'vendorId',case when caller_is_admin then null else caller_producer_id end,
        'userId',customer_order.user_id,
        'trackingNumber',shipment.tracking_number,
        'trackingUrl',shipment.tracking_url
      ) order by customer_order.created_at desc)
      from public.orders customer_order
      join public.profiles profile on profile.id=customer_order.user_id
      join auth.users auth_user on auth_user.id=customer_order.user_id
      left join lateral (
        select sum(item.line_total_minor) as producer_total_minor,
          jsonb_agg(jsonb_build_object(
            'id',item.id,'productId',item.product_id,'name',item.product_name,'title',item.product_name,'variantName',item.variant_name,'image',item.image_path,
            'quantity',item.quantity,'price',item.unit_price_minor::numeric/100,'lineTotal',item.line_total_minor::numeric/100,'fulfillmentStatus',item.fulfillment_status,'producerId',item.producer_id
          ) order by item.created_at) as items
        from public.order_items item
        where item.order_id=customer_order.id and (caller_is_admin or item.producer_id=caller_producer_id)
      ) item_summary on true
      left join private.order_gifts gift on gift.order_id=customer_order.id
      left join private.order_payment_preferences payment_pref on payment_pref.order_id=customer_order.id
      left join private.customer_payment_methods payment_method on payment_method.id=payment_pref.payment_method_id and payment_method.user_id=customer_order.user_id
      left join lateral (
        select request.id,request.status,request.customer_message
        from public.return_requests request where request.order_id=customer_order.id order by request.created_at desc limit 1
      ) return_request on true
      left join lateral (
        select delivery.tracking_number,delivery.tracking_url
        from public.shipments delivery where delivery.order_id=customer_order.id order by delivery.created_at desc limit 1
      ) shipment on true
      where caller_is_admin or (
        customer_order.status not in ('draft','pending_payment') and exists(
          select 1 from public.order_items own_item where own_item.order_id=customer_order.id and own_item.producer_id=caller_producer_id
        )
      )
    ),'[]'::jsonb),
    'role',case when caller_is_admin then 'admin' else 'producer' end,
    'producerId',caller_producer_id,
    'loadedAt',timezone('utc',now())
  );
end;
$$;

revoke all on function private.management_orders_snapshot_v2() from public,anon;
grant execute on function private.management_orders_snapshot_v2() to authenticated;

create or replace function public.management_orders_snapshot_v2()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.management_orders_snapshot_v2(); $$;
revoke all on function public.management_orders_snapshot_v2() from public,anon;
grant execute on function public.management_orders_snapshot_v2() to authenticated;
