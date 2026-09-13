-- Reconciliation migration: captures 34 customer/producer/messaging RPC
-- function pairs (private implementation + public wrapper) that were
-- created live in the early Supabase bootstrap phase (on/before 2026-08-16)
-- but were never committed as a versioned migration. Verified against the
-- live "golden-oremar" project (rmfcziawxjgcnxexbrvw) on 2026-09-13: every
-- statement below is CREATE OR REPLACE, byte-for-byte matching what is
-- currently running in production, so applying this migration is a no-op
-- against the live database and only closes the repo/live drift.
--
-- Scope note: this closes drift for the specific 34 functions that active
-- application code (src/**) calls via supabase.rpc(...) and that were
-- confirmed absent from every prior migration file. It does not certify
-- that the remaining ~470 functions in public/private/api_public_bridge
-- have no drift of their own - that is a larger audit that still needs to
-- be done, ideally with proper schema-diff tooling (supabase db diff)
-- rather than manual reconstruction.

-- ============================================================
-- private schema implementations
-- ============================================================

CREATE OR REPLACE FUNCTION private.cancel_account_closure_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); request_row private.account_closure_requests%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into request_row from private.account_closure_requests where user_id=caller_id and status='requested' order by requested_at desc limit 1 for update;
  if request_row.id is null then raise exception 'cancellable_account_closure_not_found' using errcode='P0002'; end if;
  update private.account_closure_requests set status='cancelled',updated_at=timezone('utc',now()),processed_at=timezone('utc',now()) where id=request_row.id returning * into request_row;
  return jsonb_build_object('id',request_row.id,'status',request_row.status,'cancelledAt',request_row.processed_at);
end;
$function$;

CREATE OR REPLACE FUNCTION private.cancel_customer_order(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_order public.orders%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select customer_order.*
  into target_order
  from public.orders customer_order
  where customer_order.id = p_order_id
    and customer_order.user_id = current_user_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = '22023';
  end if;

  if target_order.status = 'cancelled' then
    return true;
  end if;

  if target_order.status <> 'pending_payment' or target_order.payment_status <> 'unpaid' then
    raise exception 'order_cannot_be_cancelled' using errcode = '22023';
  end if;

  perform private.release_order_inventory(target_order.id);

  update public.orders
  set status = 'cancelled',
      cancelled_at = timezone('utc', now()),
      reservation_expires_at = null,
      updated_at = timezone('utc', now())
  where id = target_order.id;

  insert into public.order_status_history(
    order_id,
    from_status,
    to_status,
    note,
    visible_to_customer,
    actor_user_id
  ) values (
    target_order.id,
    target_order.status,
    'cancelled',
    'Müşteri ödeme öncesinde sipariş talebini iptal etti.',
    true,
    current_user_id
  );

  insert into private.outbox_events(
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'order',
    target_order.id,
    'order.cancelled_by_customer',
    jsonb_build_object('order_id', target_order.id, 'user_id', current_user_id)
  );

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.clear_my_cart_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); cart_row public.carts%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  cart_row:=private.get_or_create_customer_cart_v1(caller_id);
  delete from public.cart_items where cart_id=cart_row.id;
  update public.carts set expires_at=timezone('utc',now())+interval '30 days',updated_at=timezone('utc',now()) where id=cart_row.id;
  return private.get_customer_cart_snapshot_v1(caller_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.delete_customer_address_impl_v1(p_address_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); was_default boolean;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text,85027));
  select is_default into was_default from public.addresses where id=p_address_id and user_id=caller_id and deleted_at is null for update;
  if not found then raise exception 'address_not_found' using errcode='P0002'; end if;
  update public.addresses set is_default=false,deleted_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=p_address_id and user_id=caller_id;
  if was_default then
    update public.addresses set is_default=true,updated_at=timezone('utc',now())
    where id=(select id from public.addresses where user_id=caller_id and deleted_at is null order by created_at desc limit 1);
  end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_conversation_messages_v1(p_conversation_id uuid, p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  if not exists(select 1 from public.conversation_participants where conversation_id=p_conversation_id and user_id=caller_id) then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(item order by created_at asc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',message.id,'senderUserId',message.sender_user_id,'senderName',profile.display_name,'isMine',message.sender_user_id=caller_id,
      'body',case when message.deleted_at is null then message.body else 'Mesaj kaldırıldı' end,
      'attachmentPaths',case when message.deleted_at is null then message.attachment_paths else '{}'::text[] end,
      'messageType',message.message_type,'createdAt',message.created_at,'editedAt',message.edited_at,'deletedAt',message.deleted_at
    ) item,message.created_at
    from public.messages message join public.profiles profile on profile.id=message.sender_user_id
    where message.conversation_id=p_conversation_id and (p_before is null or message.created_at<p_before)
    order by message.created_at desc limit p_limit
  ) rows;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_cart_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); cart_row public.carts%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  cart_row:=private.get_or_create_customer_cart_v1(caller_id);
  return private.get_customer_cart_snapshot_v1(caller_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_newsletter_status_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  email_value text:=lower(btrim(coalesce(auth.jwt()->>'email','')));
  sub private.newsletter_subscriptions%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into sub
  from private.newsletter_subscriptions subscription
  where subscription.user_id=caller_id or (email_value<>'' and subscription.email_normalized=email_value)
  order by case when subscription.user_id=caller_id then 0 else 1 end,subscription.updated_at desc
  limit 1;

  if sub.id is null then
    return jsonb_build_object('status','none','email',nullif(email_value,''));
  end if;
  return jsonb_build_object(
    'status',sub.status,
    'email',sub.email_normalized,
    'locale',sub.locale,
    'consentVersion',sub.consent_version,
    'consentedAt',sub.consented_at,
    'confirmedAt',sub.confirmed_at,
    'unsubscribedAt',sub.unsubscribed_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_notification_preferences_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); pref private.user_notification_preferences%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into pref from private.user_notification_preferences where user_id=caller_id;
  return jsonb_build_object(
    'pushEnabled',coalesce(pref.push_enabled,true),'orderPush',coalesce(pref.order_push,true),'paymentPush',coalesce(pref.payment_push,true),
    'shipmentPush',coalesce(pref.shipment_push,true),'returnPush',coalesce(pref.return_push,true),'messagePush',coalesce(pref.message_push,true),
    'reviewPush',coalesce(pref.review_push,true),'producerPush',coalesce(pref.producer_push,true),'systemPush',coalesce(pref.system_push,true),
    'campaignPush',coalesce(pref.campaign_push,false)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_order_detail_v1(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); o public.orders%rowtype; result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into o from public.orders where id=p_order_id and user_id=caller_id;
 if o.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
 select jsonb_build_object(
   'id',o.id,'orderNumber',o.order_number,'status',o.status,'paymentStatus',o.payment_status,'fulfillmentStatus',o.fulfillment_status,
   'currency',o.currency,'subtotalMinor',o.subtotal_minor,'discountMinor',o.discount_minor,'taxMinor',o.tax_minor,'shippingMinor',o.shipping_minor,'totalMinor',o.total_minor,
   'shippingAddress',o.shipping_address,'customerNote',o.customer_note,'placedAt',o.placed_at,'createdAt',o.created_at,'updatedAt',o.updated_at,
   'cancelledAt',o.cancelled_at,'completedAt',o.completed_at,'reservationExpiresAt',o.reservation_expires_at,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'productId',i.product_id,'variantId',i.variant_id,'producerId',i.producer_id,'productName',i.product_name,'variantName',i.variant_name,
      'sku',i.sku,'imagePath',i.image_path,'quantity',i.quantity,'unitPriceMinor',i.unit_price_minor,'discountMinor',i.discount_minor,'taxMinor',i.tax_minor,
      'lineTotalMinor',i.line_total_minor,'fulfillmentStatus',i.fulfillment_status,'snapshot',i.snapshot,
      'reviewed',exists(select 1 from public.reviews r where r.order_item_id=i.id)
    ) order by i.created_at) from public.order_items i where i.order_id=o.id),'[]'::jsonb),
   'statusHistory',coalesce((select jsonb_agg(jsonb_build_object('from',h.from_status,'to',h.to_status,'note',h.note,'at',h.created_at) order by h.created_at) from public.order_status_history h where h.order_id=o.id and h.visible_to_customer=true),'[]'::jsonb),
   'shipments',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'carrier',s.carrier,'trackingNumber',s.tracking_number,'trackingUrl',s.tracking_url,'status',s.status,'shippedAt',s.shipped_at,'deliveredAt',s.delivered_at,'estimatedDeliveryAt',s.estimated_delivery_at) order by s.created_at) from public.shipments s where s.order_id=o.id),'[]'::jsonb),
   'returns',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'returnNumber',r.return_number,'reasonCode',r.reason_code,'customerMessage',r.customer_message,'status',r.status,'resolution',r.resolution,'requestedAt',r.requested_at,'resolutionNote',r.resolution_note) order by r.created_at desc) from public.return_requests r where r.order_id=o.id and r.user_id=caller_id),'[]'::jsonb),
   'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amountMinor',r.amount_minor,'currency',r.currency,'status',r.status,'reason',r.reason,'processedAt',r.processed_at) order by r.created_at desc) from public.refunds r where r.order_id=o.id),'[]'::jsonb),
   'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'provider',p.provider,'paymentMethodType',p.payment_method_type,'amountMinor',p.amount_minor,'currency',p.currency,'status',p.status,'authorizedAt',p.authorized_at,'capturedAt',p.captured_at,'createdAt',p.created_at) order by p.created_at desc) from public.payment_records p where p.order_id=o.id and p.user_id=caller_id),'[]'::jsonb),
   'gift',(select jsonb_build_object('recipientName',g.recipient_name,'recipientPhone',g.recipient_phone,'recipientEmail',g.recipient_email,'message',g.gift_message,'senderName',g.sender_name,'hidePrice',g.hide_price) from private.order_gifts g where g.order_id=o.id and g.user_id=caller_id)
 ) into result;
 return result;
end; $function$;

CREATE OR REPLACE FUNCTION private.list_customer_favorite_references_impl_v1()
 RETURNS TABLE(product_reference text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return query
  select coalesce(product.legacy_id,product.id::text)
  from public.favorites favorite
  join public.products product on product.id=favorite.product_id
  join public.producers producer on producer.id=product.producer_id
  where favorite.user_id=caller_id and product.status='published' and product.is_active=true and product.deleted_at is null
    and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
  order by favorite.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_my_content_favorite_references_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',entry.id,'slug',entry.slug,'type',entry.content_type) order by favorite.created_at desc),'[]'::jsonb)
  into result
  from private.content_favorites favorite
  join public.content_entries entry on entry.id=favorite.content_id
  where favorite.user_id=caller_id and entry.status='published' and entry.deleted_at is null
    and (entry.published_at is null or entry.published_at<=timezone('utc',now()));
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_my_gift_orders_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'orderId',o.id,'orderNumber',o.order_number,'status',o.status,'paymentStatus',o.payment_status,'fulfillmentStatus',o.fulfillment_status,
   'currency',o.currency,'totalMinor',o.total_minor,'placedAt',o.placed_at,'createdAt',o.created_at,
   'recipientName',g.recipient_name,'recipientPhone',g.recipient_phone,'recipientEmail',g.recipient_email,'message',g.gift_message,'senderName',g.sender_name,'hidePrice',g.hide_price,
   'items',coalesce((select jsonb_agg(jsonb_build_object('productName',i.product_name,'variantName',i.variant_name,'quantity',i.quantity,'imagePath',i.image_path) order by i.created_at) from public.order_items i where i.order_id=o.id),'[]'::jsonb)
 ) order by o.created_at desc),'[]'::jsonb) into result
 from private.order_gifts g join public.orders o on o.id=g.order_id where g.user_id=caller_id;
 return result;
end; $function$;

CREATE OR REPLACE FUNCTION private.list_my_notifications_v1(p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb; unread_count bigint;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select count(*) into unread_count from public.notifications where user_id=caller_id and read_at is null and (expires_at is null or expires_at>timezone('utc',now()));
  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into result from (
    select jsonb_build_object('id',n.id,'type',n.type,'title',n.title,'message',n.message,'actionUrl',n.action_url,'metadata',n.metadata,'readAt',n.read_at,'createdAt',n.created_at,'expiresAt',n.expires_at) item,n.created_at
    from public.notifications n where n.user_id=caller_id and (n.expires_at is null or n.expires_at>timezone('utc',now())) and (p_before is null or n.created_at<p_before)
    order by n.created_at desc limit p_limit
  ) rows;
  return jsonb_build_object('unreadCount',unread_count,'items',result);
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_my_orders_v1(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
 with base as (
   select o.* from public.orders o where o.user_id=caller_id
 ), page as (
   select * from base order by created_at desc limit p_limit offset p_offset
 )
 select jsonb_build_object(
   'total',(select count(*) from base),'limit',p_limit,'offset',p_offset,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'id',o.id,'orderNumber',o.order_number,'status',o.status,'paymentStatus',o.payment_status,
     'fulfillmentStatus',o.fulfillment_status,'currency',o.currency,'subtotalMinor',o.subtotal_minor,
     'discountMinor',o.discount_minor,'shippingMinor',o.shipping_minor,'taxMinor',o.tax_minor,'totalMinor',o.total_minor,
     'placedAt',o.placed_at,'createdAt',o.created_at,'updatedAt',o.updated_at,'cancelledAt',o.cancelled_at,'completedAt',o.completed_at,
     'reservationExpiresAt',o.reservation_expires_at,
     'itemCount',(select coalesce(sum(i.quantity),0) from public.order_items i where i.order_id=o.id),
     'previewItems',coalesce((select jsonb_agg(x.item order by x.created_at) from (
       select jsonb_build_object('id',i.id,'productName',i.product_name,'variantName',i.variant_name,'quantity',i.quantity,'imagePath',i.image_path,'lineTotalMinor',i.line_total_minor) item,i.created_at
       from public.order_items i where i.order_id=o.id order by i.created_at limit 3
     ) x),'[]'::jsonb),
     'gift',exists(select 1 from private.order_gifts g where g.order_id=o.id),
     'shipmentStatus',(select s.status from public.shipments s where s.order_id=o.id order by s.created_at desc limit 1),
     'trackingNumber',(select s.tracking_number from public.shipments s where s.order_id=o.id order by s.created_at desc limit 1)
   ) order by o.created_at desc) from page o),'[]'::jsonb)
 ) into result;
 return result;
end; $function$;

CREATE OR REPLACE FUNCTION private.list_my_payment_activity_v1(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
 with base as (
   select p.*,o.order_number from public.payment_records p join public.orders o on o.id=p.order_id
   where p.user_id=caller_id and o.user_id=caller_id
 ), page as (
   select * from base order by created_at desc limit p_limit offset p_offset
 )
 select jsonb_build_object(
   'total',(select count(*) from base),'limit',p_limit,'offset',p_offset,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'id',id,'orderId',order_id,'orderNumber',order_number,'provider',provider,
     'paymentMethodType',payment_method_type,'amountMinor',amount_minor,'currency',currency,
     'status',status,'failureCode',failure_code,'failureMessage',failure_message,
     'authorizedAt',authorized_at,'capturedAt',captured_at,'createdAt',created_at,'updatedAt',updated_at
   ) order by created_at desc) from page),'[]'::jsonb)
 ) into result;
 return result;
end; $function$;

CREATE OR REPLACE FUNCTION private.list_my_reviewable_order_items_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'orderItemId', item.id,
    'orderId', customer_order.id,
    'orderNumber', customer_order.order_number,
    'deliveredAt', coalesce(customer_order.completed_at, customer_order.updated_at),
    'productId', item.product_id,
    'productName', item.product_name,
    'variantName', item.variant_name,
    'imagePath', item.image_path,
    'producerId', item.producer_id,
    'producerName', producer.display_name,
    'quantity', item.quantity
  ) order by customer_order.updated_at desc,item.product_name),'[]'::jsonb)
  into result
  from public.order_items item
  join public.orders customer_order on customer_order.id=item.order_id
  join public.producers producer on producer.id=item.producer_id
  where customer_order.user_id=caller_id
    and customer_order.status in ('delivered','completed')
    and not exists(select 1 from public.reviews review where review.order_item_id=item.id);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_my_reviews_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', review.id,
    'productId', review.product_id,
    'productName', product.name,
    'productSlug', product.slug,
    'orderItemId', review.order_item_id,
    'rating', review.rating,
    'title', review.title,
    'body', review.body,
    'mediaPaths', review.media_paths,
    'status', review.status,
    'verifiedPurchase', review.is_verified_purchase,
    'merchantReply', review.merchant_reply,
    'merchantRepliedAt', review.merchant_replied_at,
    'createdAt', review.created_at,
    'updatedAt', review.updated_at,
    'editedAt', review.edited_at,
    'moderationReason', review.moderation_reason
  ) order by review.created_at desc),'[]'::jsonb)
  into result
  from public.reviews review
  join public.products product on product.id=review.product_id
  where review.user_id=caller_id;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.mark_all_notifications_read_v1()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.notifications set read_at=timezone('utc',now()) where user_id=caller_id and read_at is null;
  get diagnostics affected=row_count;
  return affected;
end;
$function$;

CREATE OR REPLACE FUNCTION private.mark_conversation_read_v1(p_conversation_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); read_time timestamptz:=timezone('utc',now()); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.conversation_participants set last_read_at=read_time where conversation_id=p_conversation_id and user_id=caller_id;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  return read_time;
end;
$function$;

CREATE OR REPLACE FUNCTION private.mark_notification_read_v1(p_notification_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); read_time timestamptz:=timezone('utc',now()); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.notifications set read_at=coalesce(read_at,read_time) where id=p_notification_id and user_id=caller_id;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'notification_not_found' using errcode='P0002'; end if;
  return read_time;
end;
$function$;

CREATE OR REPLACE FUNCTION private.producer_update_inventory_v1(p_variant_id uuid, p_available_quantity integer, p_reorder_level integer, p_expected_version bigint, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  scoped_key text;
  request_hash text;
  existing_key private.idempotency_keys%rowtype;
  inserted_count integer:=0;
  producer_id_value uuid;
  product_id_value uuid;
  product_name_value text;
  variant_name_value text;
  stock_mode_value text;
  inventory_row public.product_inventory%rowtype;
  old_sellable integer;
  new_sellable integer;
  delta integer;
  response_payload jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_available_quantity is null or p_available_quantity not between 0 and 100000000 then raise exception 'invalid_available_quantity' using errcode='22023'; end if;
  if p_reorder_level is null or p_reorder_level not between 0 and 100000000 then raise exception 'invalid_reorder_level' using errcode='22023'; end if;
  if p_expected_version is null or p_expected_version<1 then raise exception 'invalid_inventory_version' using errcode='22023'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 160 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;

  scoped_key:='producer_stock:'||caller_id::text||':'||p_idempotency_key;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('user',caller_id,'variant',p_variant_id,'available',p_available_quantity,'reorder',p_reorder_level,'version',p_expected_version)::text,'UTF8'),'sha256'),'hex');
  select * into existing_key from private.idempotency_keys where key=scoped_key;
  if existing_key.key is not null then
    if existing_key.scope<>'producer_inventory_update' or existing_key.user_id is distinct from caller_id or existing_key.request_hash<>request_hash then raise exception 'idempotency_key_reused' using errcode='22023'; end if;
    if existing_key.completed_at is not null then return existing_key.response_body; end if;
    raise exception 'request_in_progress' using errcode='40001';
  end if;
  insert into private.idempotency_keys(key,scope,user_id,request_hash,locked_at,expires_at)
  values(scoped_key,'producer_inventory_update',caller_id,request_hash,timezone('utc',now()),timezone('utc',now())+interval '7 days')
  on conflict(key) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=0 then raise exception 'request_in_progress' using errcode='40001'; end if;

  select producer.id,product.id,product.name,variant.name,product.stock_mode
  into producer_id_value,product_id_value,product_name_value,variant_name_value,stock_mode_value
  from public.product_variants variant
  join public.products product on product.id=variant.product_id and product.deleted_at is null
  join public.producers producer on producer.id=product.producer_id and producer.owner_user_id=caller_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
  where variant.id=p_variant_id and variant.is_active=true;
  if producer_id_value is null then raise exception 'variant_access_denied' using errcode='42501'; end if;
  if stock_mode_value not in ('tracked','seasonal') then raise exception 'inventory_not_used_for_stock_mode' using errcode='22023'; end if;

  select * into inventory_row from public.product_inventory where variant_id=p_variant_id for update;
  if inventory_row.variant_id is null then raise exception 'inventory_record_missing' using errcode='P0002'; end if;
  if inventory_row.version<>p_expected_version then raise exception 'inventory_version_conflict:%',inventory_row.version using errcode='40001'; end if;
  if p_available_quantity<inventory_row.reserved_quantity then raise exception 'available_quantity_below_reserved:%',inventory_row.reserved_quantity using errcode='22023'; end if;

  old_sellable:=inventory_row.available_quantity-inventory_row.reserved_quantity;
  delta:=p_available_quantity-inventory_row.available_quantity;
  update public.product_inventory
  set available_quantity=p_available_quantity,reorder_level=p_reorder_level,version=version+1,updated_at=timezone('utc',now())
  where variant_id=p_variant_id returning * into inventory_row;
  new_sellable:=inventory_row.available_quantity-inventory_row.reserved_quantity;

  if delta<>0 then
    insert into private.inventory_movements(variant_id,movement_type,quantity_delta,reference_type,reference_id,reason,idempotency_key,actor_user_id)
    values(p_variant_id,'adjustment',delta,'product',product_id_value,'Producer stock count update',scoped_key,caller_id);
  end if;
  if old_sellable>p_reorder_level and new_sellable<=p_reorder_level then
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(caller_id,'producer','Stok seviyesi düştü',product_name_value||' - '||variant_name_value||' için satılabilir stok '||new_sellable::text||' seviyesine düştü.','/producer/products',jsonb_build_object('productId',product_id_value,'variantId',p_variant_id,'sellableQuantity',new_sellable,'reorderLevel',p_reorder_level));
  end if;

  response_payload:=jsonb_build_object('variantId',p_variant_id,'productId',product_id_value,'availableQuantity',inventory_row.available_quantity,'reservedQuantity',inventory_row.reserved_quantity,'sellableQuantity',new_sellable,'reorderLevel',inventory_row.reorder_level,'version',inventory_row.version);
  update private.idempotency_keys set response_status=200,response_body=response_payload,completed_at=timezone('utc',now()) where key=scoped_key;
  return response_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION private.producer_withdraw_product_change_v1(p_change_request_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.product_change_requests request
  set status='withdrawn',updated_at=timezone('utc',now())
  where request.id=p_change_request_id and request.status='pending'
    and exists(select 1 from public.producers producer where producer.id=request.producer_id and producer.owner_user_id=caller_id);
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'pending_product_change_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.register_push_token_v1(p_provider text, p_platform text, p_token text, p_environment text DEFAULT 'production'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid(); provider_value text:=lower(btrim(coalesce(p_provider,''))); platform_value text:=lower(btrim(coalesce(p_platform,'')));
  environment_value text:=lower(btrim(coalesce(p_environment,'production'))); token_value text:=btrim(coalesce(p_token,'')); hash_value text; token_row private.device_push_tokens%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if provider_value not in ('fcm','apns') or platform_value not in ('android','ios') or environment_value not in ('development','production') then raise exception 'invalid_push_registration' using errcode='22023'; end if;
  if (platform_value='android' and provider_value<>'fcm') then raise exception 'android_push_requires_fcm' using errcode='22023'; end if;
  hash_value:=private.hash_push_token_v1(token_value);
  insert into private.device_push_tokens(user_id,token_hash,token_ciphertext,provider,platform,environment,last_seen_at,disabled_at,updated_at)
  values(caller_id,hash_value,extensions.pgp_sym_encrypt(token_value,private.get_push_token_key_v1(),'cipher-algo=aes256'),provider_value,platform_value,environment_value,timezone('utc',now()),null,timezone('utc',now()))
  on conflict(token_hash) do update
  set user_id=excluded.user_id,token_ciphertext=excluded.token_ciphertext,provider=excluded.provider,platform=excluded.platform,environment=excluded.environment,last_seen_at=excluded.last_seen_at,disabled_at=null,updated_at=excluded.updated_at
  returning * into token_row;
  return jsonb_build_object('id',token_row.id,'provider',token_row.provider,'platform',token_row.platform,'environment',token_row.environment,'registered',true);
end;
$function$;

CREATE OR REPLACE FUNCTION private.remove_my_cart_item_v1(p_cart_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); cart_id_value uuid; affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select cart.id into cart_id_value from public.carts cart join public.cart_items item on item.cart_id=cart.id where item.id=p_cart_item_id and cart.user_id=caller_id and cart.status='active' for update of cart;
  if cart_id_value is null then raise exception 'cart_item_not_found' using errcode='P0002'; end if;
  delete from public.cart_items where id=p_cart_item_id and cart_id=cart_id_value;
  update public.carts set expires_at=timezone('utc',now())+interval '30 days',updated_at=timezone('utc',now()) where id=cart_id_value;
  return private.get_customer_cart_snapshot_v1(caller_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.request_account_closure_v1(p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  reason_value text:=nullif(btrim(coalesce(p_reason,'')),'');
  request_row private.account_closure_requests%rowtype;
  active_order_count bigint;
  active_return_count bigint;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if reason_value is not null and char_length(reason_value)>2000 then raise exception 'account_closure_reason_too_long' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  if exists(select 1 from public.producers where owner_user_id=caller_id and deleted_at is null and status='active') then
    raise exception 'producer_account_requires_transfer_or_suspension' using errcode='55000';
  end if;

  select count(*) into active_order_count from public.orders
  where user_id=caller_id and status not in ('completed','cancelled','refunded');
  select count(*) into active_return_count from public.return_requests
  where user_id=caller_id and status not in ('rejected','refunded','closed');
  if active_order_count>0 or active_return_count>0 then
    raise exception 'account_closure_has_active_transactions:%:%',active_order_count,active_return_count using errcode='55000';
  end if;

  select * into request_row from private.account_closure_requests
  where user_id=caller_id and status in ('requested','processing','ready_for_auth_deletion')
  order by requested_at desc limit 1;
  if request_row.id is not null then
    return jsonb_build_object('id',request_row.id,'status',request_row.status,'requestedAt',request_row.requested_at,'unchanged',true);
  end if;

  insert into private.account_closure_requests(user_id,status,reason)
  values(caller_id,'requested',reason_value)
  returning * into request_row;

  update private.device_push_tokens set disabled_at=timezone('utc',now()),updated_at=timezone('utc',now())
  where user_id=caller_id and disabled_at is null;
  update private.user_notification_preferences
  set push_enabled=false,campaign_push=false,updated_at=timezone('utc',now())
  where user_id=caller_id;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('account_closure',request_row.id,'account_closure.requested',jsonb_build_object('request_id',request_row.id,'user_id',caller_id));

  return jsonb_build_object('id',request_row.id,'status',request_row.status,'requestedAt',request_row.requested_at,'activeOrders',active_order_count,'activeReturns',active_return_count);
end;
$function$;

CREATE OR REPLACE FUNCTION private.set_conversation_open_state_v1(p_conversation_id uuid, p_open boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); conversation_row public.conversations%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into conversation_row from public.conversations conversation
  where conversation.id=p_conversation_id and exists(select 1 from public.conversation_participants participant where participant.conversation_id=conversation.id and participant.user_id=caller_id)
  for update;
  if conversation_row.id is null then raise exception 'conversation_access_denied' using errcode='42501'; end if;
  update public.conversations
  set status=case when coalesce(p_open,false) then 'open' else 'closed' end,
      closed_at=case when coalesce(p_open,false) then null else timezone('utc',now()) end,
      closed_by=case when coalesce(p_open,false) then null else caller_id end,
      updated_at=timezone('utc',now())
  where id=conversation_row.id returning * into conversation_row;
  return jsonb_build_object('conversationId',conversation_row.id,'status',conversation_row.status,'closedAt',conversation_row.closed_at);
end;
$function$;

CREATE OR REPLACE FUNCTION private.start_support_conversation_v1(p_order_id uuid, p_subject text, p_initial_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  context_value text;
  conversation_row public.conversations%rowtype;
  message_row public.messages%rowtype;
  admin_count integer:=0;
  subject_value text:=btrim(coalesce(p_subject,''));
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if char_length(subject_value) not between 2 and 200 then raise exception 'support_subject_required' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_initial_message,''))) not between 1 and 5000 then raise exception 'initial_message_required' using errcode='22023'; end if;
  if p_order_id is not null and not exists(select 1 from public.orders where id=p_order_id and user_id=caller_id) then raise exception 'order_not_found' using errcode='P0002'; end if;
  context_value:='support:'||caller_id::text||':'||coalesce(p_order_id::text,'general');

  insert into public.conversations(conversation_type,order_id,subject,status,created_by,context_key)
  values('support',p_order_id,subject_value,'open',caller_id,context_value)
  on conflict (context_key) where context_key is not null do update
  set status='open',closed_at=null,closed_by=null,subject=excluded.subject,updated_at=timezone('utc',now())
  returning * into conversation_row;

  insert into public.conversation_participants(conversation_id,user_id,participant_role,last_read_at)
  values(conversation_row.id,caller_id,'customer',timezone('utc',now()))
  on conflict(conversation_id,user_id) do update set participant_role='customer';

  insert into public.conversation_participants(conversation_id,user_id,participant_role)
  select conversation_row.id,role.user_id,'admin'
  from private.user_roles role
  join public.profiles profile on profile.id=role.user_id and profile.status='active' and profile.deleted_at is null
  where role.role in ('admin','super_admin') and (role.expires_at is null or role.expires_at>timezone('utc',now()))
  on conflict(conversation_id,user_id) do update set participant_role='admin';
  get diagnostics admin_count=row_count;

  message_row:=private.insert_conversation_message_v1(conversation_row.id,caller_id,p_initial_message,'{}'::text[],'text');
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('conversation',conversation_row.id,'support_conversation.opened',jsonb_build_object('conversation_id',conversation_row.id,'order_id',p_order_id,'customer_user_id',caller_id,'assigned_admin_participants',admin_count));
  return jsonb_build_object('conversationId',conversation_row.id,'messageId',message_row.id,'status',conversation_row.status,'orderId',p_order_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.toggle_customer_favorite_impl_v1(p_product_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); product_id_value uuid; reference_value text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_product_reference,''))) not between 1 and 200 then raise exception 'invalid_product_reference' using errcode='22023'; end if;
  select product.id,coalesce(product.legacy_id,product.id::text) into product_id_value,reference_value
  from public.products product
  join public.producers producer on producer.id=product.producer_id
  where (product.id::text=btrim(p_product_reference) or product.legacy_id=btrim(p_product_reference) or product.slug=btrim(p_product_reference))
    and product.status='published' and product.is_active=true and product.deleted_at is null
    and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
  order by case when product.legacy_id=btrim(p_product_reference) then 0 else 1 end limit 1;
  if product_id_value is null then raise exception 'product_not_available' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text||':'||product_id_value::text,85028));
  if exists(select 1 from public.favorites where user_id=caller_id and product_id=product_id_value) then
    delete from public.favorites where user_id=caller_id and product_id=product_id_value;
    return jsonb_build_object('productReference',reference_value,'isFavorite',false);
  end if;
  if (select count(*) from public.favorites where user_id=caller_id)>=500 then raise exception 'favorite_limit_exceeded' using errcode='54000'; end if;
  insert into public.favorites(user_id,product_id) values(caller_id,product_id_value);
  return jsonb_build_object('productReference',reference_value,'isFavorite',true);
end;
$function$;

CREATE OR REPLACE FUNCTION private.toggle_my_content_favorite_v1(p_content_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  entry public.content_entries%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_content_reference,''))) not between 1 and 240 then raise exception 'invalid_content_reference' using errcode='22023'; end if;

  select item.* into entry
  from public.content_entries item
  where (item.id::text=btrim(p_content_reference) or item.legacy_id=btrim(p_content_reference) or item.slug=btrim(p_content_reference))
    and item.status='published' and item.deleted_at is null
    and item.content_type in ('recipe','health_guide','product_health')
    and (item.published_at is null or item.published_at<=timezone('utc',now()))
  order by case when item.id::text=btrim(p_content_reference) then 0 when item.slug=btrim(p_content_reference) then 1 else 2 end
  limit 1;
  if entry.id is null then raise exception 'content_not_found' using errcode='P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text||':'||entry.id::text,92418));
  if exists(select 1 from private.content_favorites where user_id=caller_id and content_id=entry.id) then
    delete from private.content_favorites where user_id=caller_id and content_id=entry.id;
    return jsonb_build_object('contentId',entry.id,'slug',entry.slug,'isFavorite',false);
  end if;
  if (select count(*) from private.content_favorites where user_id=caller_id)>=500 then raise exception 'content_favorite_limit_exceeded' using errcode='54000'; end if;
  insert into private.content_favorites(user_id,content_id) values(caller_id,entry.id);
  return jsonb_build_object('contentId',entry.id,'slug',entry.slug,'isFavorite',true);
end;
$function$;

CREATE OR REPLACE FUNCTION private.toggle_producer_follow_v1(p_producer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); removed integer;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.producers p where p.id=p_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null) then raise exception 'producer_not_available' using errcode='P0002'; end if;
 delete from private.producer_follows where user_id=caller_id and producer_id=p_producer_id;
 get diagnostics removed=row_count;
 if removed>0 then return jsonb_build_object('producerId',p_producer_id,'following',false); end if;
 insert into private.producer_follows(user_id,producer_id) values(caller_id,p_producer_id) on conflict do nothing;
 return jsonb_build_object('producerId',p_producer_id,'following',true);
end; $function$;

CREATE OR REPLACE FUNCTION private.unsubscribe_my_newsletter_v1()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); email_value text:=lower(btrim(coalesce(auth.jwt()->>'email',''))); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update private.newsletter_subscriptions set status='unsubscribed',unsubscribed_at=timezone('utc',now()),updated_at=timezone('utc',now())
  where (user_id=caller_id or (email_value<>'' and email_normalized=email_value)) and status in ('pending','active');
  get diagnostics affected=row_count;
  update public.profiles set marketing_consent=false,marketing_consent_at=null,updated_at=timezone('utc',now()) where id=caller_id;
  update private.user_notification_preferences set campaign_push=false,updated_at=timezone('utc',now()) where user_id=caller_id;
  return affected>0;
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_customer_profile_impl_v1(p_display_name text, p_phone text, p_locale text, p_marketing_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  profile_row public.profiles%rowtype;
  phone_digits text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_display_name,''))) not between 2 and 120
     or char_length(coalesce(p_phone,''))>40
     or (phone_digits<>'' and char_length(phone_digits) not between 10 and 15)
     or p_locale not in ('tr','en','de','fr','ku','ar') then
    raise exception 'invalid_profile' using errcode='22023';
  end if;

  update public.profiles
  set display_name=btrim(p_display_name),
      phone=nullif(btrim(coalesce(p_phone,'')),''),
      locale=p_locale,
      marketing_consent=coalesce(p_marketing_consent,false),
      marketing_consent_at=case when coalesce(p_marketing_consent,false) then coalesce(marketing_consent_at,timezone('utc',now())) else null end,
      updated_at=timezone('utc',now())
  where id=caller_id and status='active' and deleted_at is null
  returning * into profile_row;
  if profile_row.id is null then raise exception 'active_profile_required' using errcode='42501'; end if;

  if not coalesce(p_marketing_consent,false) then
    update private.user_notification_preferences set campaign_push=false,updated_at=timezone('utc',now()) where user_id=caller_id and campaign_push=true;
  end if;

  return jsonb_build_object('userId',profile_row.id,'displayName',profile_row.display_name,'phone',coalesce(profile_row.phone,''),'locale',profile_row.locale,'marketingConsent',profile_row.marketing_consent);
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_my_notification_preferences_v1(p_push_enabled boolean, p_order_push boolean, p_payment_push boolean, p_shipment_push boolean, p_return_push boolean, p_message_push boolean, p_review_push boolean, p_producer_push boolean, p_system_push boolean, p_campaign_push boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); marketing_allowed boolean;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select marketing_consent into marketing_allowed from public.profiles where id=caller_id and status='active' and deleted_at is null;
  if coalesce(p_campaign_push,false) and not coalesce(marketing_allowed,false) then raise exception 'campaign_push_requires_marketing_consent' using errcode='22023'; end if;
  insert into private.user_notification_preferences(user_id,push_enabled,order_push,payment_push,shipment_push,return_push,message_push,review_push,producer_push,system_push,campaign_push,updated_at)
  values(caller_id,coalesce(p_push_enabled,true),coalesce(p_order_push,true),coalesce(p_payment_push,true),coalesce(p_shipment_push,true),coalesce(p_return_push,true),coalesce(p_message_push,true),coalesce(p_review_push,true),coalesce(p_producer_push,true),coalesce(p_system_push,true),coalesce(p_campaign_push,false),timezone('utc',now()))
  on conflict(user_id) do update set push_enabled=excluded.push_enabled,order_push=excluded.order_push,payment_push=excluded.payment_push,shipment_push=excluded.shipment_push,return_push=excluded.return_push,message_push=excluded.message_push,review_push=excluded.review_push,producer_push=excluded.producer_push,system_push=excluded.system_push,campaign_push=excluded.campaign_push,updated_at=excluded.updated_at;
  return private.get_my_notification_preferences_v1();
end;
$function$;

CREATE OR REPLACE FUNCTION private.withdraw_my_review_v1(p_review_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.reviews set status='withdrawn',updated_at=timezone('utc',now()) where id=p_review_id and user_id=caller_id and status<>'withdrawn';
  get diagnostics affected=row_count;
  if affected=0 and not exists(select 1 from public.reviews where id=p_review_id and user_id=caller_id) then raise exception 'review_not_found' using errcode='P0002'; end if;
  return true;
end;
$function$;

-- ============================================================
-- public schema wrappers (SECURITY INVOKER, thin pass-through)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_account_closure_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.cancel_account_closure_v1(); $function$;

CREATE OR REPLACE FUNCTION public.cancel_customer_order(p_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.cancel_customer_order(p_order_id);
$function$;

CREATE OR REPLACE FUNCTION public.clear_my_cart_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.clear_my_cart_v1(); $function$;

CREATE OR REPLACE FUNCTION public.delete_customer_address(p_address_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.delete_customer_address_impl_v1(p_address_id); $function$;

CREATE OR REPLACE FUNCTION public.get_conversation_messages_v1(p_conversation_id uuid, p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.get_conversation_messages_v1(p_conversation_id,p_limit,p_before); $function$;

CREATE OR REPLACE FUNCTION public.get_my_cart_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.get_my_cart_v1(); $function$;

CREATE OR REPLACE FUNCTION public.get_my_newsletter_status_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.get_my_newsletter_status_v1(); $function$;

CREATE OR REPLACE FUNCTION public.get_my_notification_preferences_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.get_my_notification_preferences_v1(); $function$;

CREATE OR REPLACE FUNCTION public.get_my_order_detail_v1(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.get_my_order_detail_v1(p_order_id); $function$;

CREATE OR REPLACE FUNCTION public.list_customer_favorite_references()
 RETURNS TABLE(product_reference text)
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from private.list_customer_favorite_references_impl_v1(); $function$;

CREATE OR REPLACE FUNCTION public.list_my_content_favorite_references_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.list_my_content_favorite_references_v1(); $function$;

CREATE OR REPLACE FUNCTION public.list_my_gift_orders_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.list_my_gift_orders_v1(); $function$;

CREATE OR REPLACE FUNCTION public.list_my_notifications_v1(p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.list_my_notifications_v1(p_limit,p_before); $function$;

CREATE OR REPLACE FUNCTION public.list_my_orders_v1(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.list_my_orders_v1(p_limit,p_offset); $function$;

CREATE OR REPLACE FUNCTION public.list_my_payment_activity_v1(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.list_my_payment_activity_v1(p_limit,p_offset); $function$;

CREATE OR REPLACE FUNCTION public.list_my_reviewable_order_items_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.list_my_reviewable_order_items_v1(); $function$;

CREATE OR REPLACE FUNCTION public.list_my_reviews_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.list_my_reviews_v1(); $function$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read_v1()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.mark_all_notifications_read_v1(); $function$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read_v1(p_conversation_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.mark_conversation_read_v1(p_conversation_id); $function$;

CREATE OR REPLACE FUNCTION public.mark_notification_read_v1(p_notification_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.mark_notification_read_v1(p_notification_id); $function$;

CREATE OR REPLACE FUNCTION public.producer_update_inventory_v1(p_variant_id uuid, p_available_quantity integer, p_reorder_level integer, p_expected_version bigint, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.producer_update_inventory_v1(p_variant_id,p_available_quantity,p_reorder_level,p_expected_version,p_idempotency_key); $function$;

CREATE OR REPLACE FUNCTION public.producer_withdraw_product_change_v1(p_change_request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.producer_withdraw_product_change_v1(p_change_request_id); $function$;

CREATE OR REPLACE FUNCTION public.register_push_token_v1(p_provider text, p_platform text, p_token text, p_environment text DEFAULT 'production'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.register_push_token_v1(p_provider,p_platform,p_token,p_environment); $function$;

CREATE OR REPLACE FUNCTION public.remove_my_cart_item_v1(p_cart_item_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.remove_my_cart_item_v1(p_cart_item_id); $function$;

CREATE OR REPLACE FUNCTION public.request_account_closure_v1(p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.request_account_closure_v1(p_reason); $function$;

CREATE OR REPLACE FUNCTION public.set_conversation_open_state_v1(p_conversation_id uuid, p_open boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.set_conversation_open_state_v1(p_conversation_id,p_open); $function$;

CREATE OR REPLACE FUNCTION public.start_support_conversation_v1(p_order_id uuid, p_subject text, p_initial_message text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.start_support_conversation_v1(p_order_id,p_subject,p_initial_message); $function$;

CREATE OR REPLACE FUNCTION public.toggle_customer_favorite(p_product_reference text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.toggle_customer_favorite_impl_v1(p_product_reference); $function$;

CREATE OR REPLACE FUNCTION public.toggle_my_content_favorite_v1(p_content_reference text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.toggle_my_content_favorite_v1(p_content_reference); $function$;

CREATE OR REPLACE FUNCTION public.toggle_producer_follow_v1(p_producer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.toggle_producer_follow_v1(p_producer_id); $function$;

CREATE OR REPLACE FUNCTION public.unsubscribe_my_newsletter_v1()
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.unsubscribe_my_newsletter_v1(); $function$;

CREATE OR REPLACE FUNCTION public.update_customer_profile(p_display_name text, p_phone text, p_locale text, p_marketing_consent boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.update_customer_profile_impl_v1(p_display_name,p_phone,p_locale,p_marketing_consent); $function$;

CREATE OR REPLACE FUNCTION public.update_my_notification_preferences_v1(p_push_enabled boolean, p_order_push boolean, p_payment_push boolean, p_shipment_push boolean, p_return_push boolean, p_message_push boolean, p_review_push boolean, p_producer_push boolean, p_system_push boolean, p_campaign_push boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.update_my_notification_preferences_v1(p_push_enabled,p_order_push,p_payment_push,p_shipment_push,p_return_push,p_message_push,p_review_push,p_producer_push,p_system_push,p_campaign_push); $function$;

CREATE OR REPLACE FUNCTION public.withdraw_my_review_v1(p_review_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.withdraw_my_review_v1(p_review_id); $function$;

-- ============================================================
-- grants: match live production (authenticated only, no anon)
-- ============================================================

REVOKE ALL ON FUNCTION public.cancel_account_closure_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_account_closure_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_customer_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.clear_my_cart_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_cart_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.delete_customer_address(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_customer_address(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_conversation_messages_v1(uuid,integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages_v1(uuid,integer,timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_cart_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_cart_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_newsletter_status_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_newsletter_status_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_notification_preferences_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_notification_preferences_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_order_detail_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_order_detail_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_customer_favorite_references() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_favorite_references() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_content_favorite_references_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_content_favorite_references_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_gift_orders_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_gift_orders_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_notifications_v1(integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_notifications_v1(integer,timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_orders_v1(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_orders_v1(integer,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_payment_activity_v1(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_payment_activity_v1(integer,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_reviewable_order_items_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_reviewable_order_items_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_reviews_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_reviews_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.mark_conversation_read_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_notification_read_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.producer_update_inventory_v1(uuid,integer,integer,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.producer_update_inventory_v1(uuid,integer,integer,bigint,text) TO authenticated;

REVOKE ALL ON FUNCTION public.producer_withdraw_product_change_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.producer_withdraw_product_change_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.register_push_token_v1(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_token_v1(text,text,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_my_cart_item_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_my_cart_item_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.request_account_closure_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_closure_v1(text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_conversation_open_state_v1(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_conversation_open_state_v1(uuid,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.start_support_conversation_v1(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_support_conversation_v1(uuid,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_customer_favorite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_customer_favorite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_my_content_favorite_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_my_content_favorite_v1(text) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_producer_follow_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_producer_follow_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.unsubscribe_my_newsletter_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_my_newsletter_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.update_customer_profile(text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_profile(text,text,text,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.update_my_notification_preferences_v1(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_notification_preferences_v1(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.withdraw_my_review_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_my_review_v1(uuid) TO authenticated;
