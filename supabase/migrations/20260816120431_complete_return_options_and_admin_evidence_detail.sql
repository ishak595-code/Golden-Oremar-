create or replace function private.get_my_order_return_options_v1(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  target_order public.orders%rowtype;
  active_return boolean;
  result jsonb;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select * into target_order
  from public.orders customer_order
  where customer_order.id = p_order_id and customer_order.user_id = caller_id;

  if target_order.id is null then
    raise exception 'order_not_found' using errcode='P0002';
  end if;

  select exists(
    select 1
    from public.return_requests request
    where request.order_id = target_order.id
      and request.user_id = caller_id
      and request.status in ('requested','under_review','approved','in_transit','received')
  ) into active_return;

  select jsonb_build_object(
    'orderId',target_order.id,
    'orderNumber',target_order.order_number,
    'orderStatus',target_order.status,
    'eligibleStatus',target_order.status in ('delivered','completed'),
    'activeReturnExists',active_return,
    'canRequest',(target_order.status in ('delivered','completed')) and not active_return and exists(
      select 1
      from public.order_items item
      where item.order_id = target_order.id
        and item.quantity > coalesce((
          select sum(return_item.quantity)::integer
          from public.return_items return_item
          join public.return_requests request on request.id=return_item.return_id
          where return_item.order_item_id=item.id and request.status <> 'rejected'
        ),0)
    ),
    'reasonCodes',jsonb_build_array('damaged','wrong_item','quality_issue','missing_item','changed_mind','delivery_issue','other'),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'orderItemId',item.id,
        'productId',item.product_id,
        'variantId',item.variant_id,
        'productName',item.product_name,
        'variantName',item.variant_name,
        'imagePath',item.image_path,
        'purchasedQuantity',item.quantity,
        'returnedQuantity',returned.returned_quantity,
        'remainingQuantity',greatest(0,item.quantity-returned.returned_quantity),
        'unitPriceMinor',item.unit_price_minor,
        'lineTotalMinor',item.line_total_minor,
        'currency',target_order.currency
      ) order by item.created_at)
      from public.order_items item
      cross join lateral (
        select coalesce(sum(return_item.quantity),0)::integer as returned_quantity
        from public.return_items return_item
        join public.return_requests request on request.id=return_item.return_id
        where return_item.order_item_id=item.id and request.status <> 'rejected'
      ) returned
      where item.order_id=target_order.id
    ),'[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

revoke all on function private.get_my_order_return_options_v1(uuid) from public;
revoke all on function private.get_my_order_return_options_v1(uuid) from anon;
revoke all on function private.get_my_order_return_options_v1(uuid) from authenticated;

create or replace function public.get_my_order_return_options_v1(p_order_id uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.get_my_order_return_options_v1(p_order_id);
$function$;

revoke all on function public.get_my_order_return_options_v1(uuid) from public;
revoke all on function public.get_my_order_return_options_v1(uuid) from anon;
grant execute on function public.get_my_order_return_options_v1(uuid) to authenticated;

create or replace function private.admin_get_return_detail_v1(p_return_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  request_row public.return_requests%rowtype;
  result jsonb;
begin
  if not coalesce(private.is_admin(),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  select * into request_row
  from public.return_requests request
  where request.id=p_return_id;

  if request_row.id is null then
    raise exception 'return_not_found' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'id',request_row.id,
    'returnNumber',request_row.return_number,
    'orderId',request_row.order_id,
    'orderNumber',customer_order.order_number,
    'customer',jsonb_build_object(
      'userId',request_row.user_id,
      'displayName',profile.display_name,
      'phone',profile.phone
    ),
    'reasonCode',request_row.reason_code,
    'customerMessage',request_row.customer_message,
    'status',request_row.status,
    'resolution',request_row.resolution,
    'resolutionNote',request_row.resolution_note,
    'reviewReason',request_row.review_reason,
    'restockApproved',request_row.restock_approved,
    'requestedAt',request_row.requested_at,
    'reviewedAt',request_row.reviewed_at,
    'receivedAt',request_row.received_at,
    'closedAt',request_row.closed_at,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',return_item.id,
        'orderItemId',return_item.order_item_id,
        'productName',order_item.product_name,
        'variantName',order_item.variant_name,
        'quantity',return_item.quantity,
        'purchasedQuantity',order_item.quantity,
        'condition',return_item.condition,
        'evidencePaths',to_jsonb(return_item.evidence_paths),
        'refundAmountMinor',return_item.refund_amount_minor,
        'currency',customer_order.currency
      ) order by return_item.created_at)
      from public.return_items return_item
      join public.order_items order_item on order_item.id=return_item.order_item_id
      where return_item.return_id=request_row.id
    ),'[]'::jsonb),
    'refunds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',refund.id,
        'amountMinor',refund.amount_minor,
        'currency',refund.currency,
        'status',refund.status,
        'reason',refund.reason,
        'processedAt',refund.processed_at
      ) order by refund.created_at desc)
      from public.refunds refund
      where refund.return_id=request_row.id
    ),'[]'::jsonb)
  ) into result
  from public.orders customer_order
  left join public.profiles profile on profile.id=request_row.user_id
  where customer_order.id=request_row.order_id;

  return result;
end;
$function$;

revoke all on function private.admin_get_return_detail_v1(uuid) from public;
revoke all on function private.admin_get_return_detail_v1(uuid) from anon;
revoke all on function private.admin_get_return_detail_v1(uuid) from authenticated;

create or replace function public.admin_get_return_detail_v1(p_return_id uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.admin_get_return_detail_v1(p_return_id);
$function$;

revoke all on function public.admin_get_return_detail_v1(uuid) from public;
revoke all on function public.admin_get_return_detail_v1(uuid) from anon;
grant execute on function public.admin_get_return_detail_v1(uuid) to authenticated;
