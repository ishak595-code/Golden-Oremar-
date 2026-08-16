create or replace function private.request_customer_return_v3(
  p_order_id uuid,
  p_items jsonb,
  p_reason_code text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  base_result jsonb;
  return_id uuid;
  item jsonb;
  order_item_id uuid;
  evidence jsonb;
  evidence_path text;
  evidence_paths text[];
  evidence_count integer := 0;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'return_items_required' using errcode='22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'invalid_return_item' using errcode='22023';
    end if;

    if item ? 'evidencePaths' then
      if jsonb_typeof(item->'evidencePaths') <> 'array' or jsonb_array_length(item->'evidencePaths') > 5 then
        raise exception 'invalid_return_evidence' using errcode='22023';
      end if;
      evidence_count := evidence_count + jsonb_array_length(item->'evidencePaths');
    end if;
  end loop;

  if evidence_count > 15 then
    raise exception 'too_many_return_evidence_files' using errcode='22023';
  end if;

  base_result := private.request_customer_return_v2(p_order_id, p_items, p_reason_code, p_message);
  return_id := (base_result->>'id')::uuid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    order_item_id := (item->>'orderItemId')::uuid;
    evidence_paths := array[]::text[];

    if item ? 'evidencePaths' then
      for evidence in select value from jsonb_array_elements(item->'evidencePaths')
      loop
        if jsonb_typeof(evidence) <> 'string' then
          raise exception 'invalid_return_evidence_path' using errcode='22023';
        end if;

        evidence_path := btrim(evidence #>> '{}');
        if evidence_path = '' or split_part(evidence_path, '/', 1) <> caller_id::text then
          raise exception 'invalid_return_evidence_path' using errcode='22023';
        end if;

        if not exists (
          select 1
          from storage.objects object
          where object.bucket_id = 'return-evidence'
            and object.name = evidence_path
            and object.owner_id = caller_id::text
        ) then
          raise exception 'return_evidence_not_found' using errcode='P0002';
        end if;

        if exists (
          select 1
          from public.return_items existing_item
          where evidence_path = any(existing_item.evidence_paths)
        ) then
          raise exception 'return_evidence_already_used' using errcode='23505';
        end if;

        if evidence_path = any(evidence_paths) then
          raise exception 'duplicate_return_evidence' using errcode='22023';
        end if;

        evidence_paths := array_append(evidence_paths, evidence_path);
      end loop;
    end if;

    update public.return_items return_item
    set evidence_paths = evidence_paths
    where return_item.return_id = return_id
      and return_item.order_item_id = order_item_id;
  end loop;

  return base_result || jsonb_build_object('evidenceCount', evidence_count);
end;
$function$;

revoke all on function private.request_customer_return_v3(uuid,jsonb,text,text) from public;
revoke all on function private.request_customer_return_v3(uuid,jsonb,text,text) from anon;
revoke all on function private.request_customer_return_v3(uuid,jsonb,text,text) from authenticated;

create or replace function public.request_customer_return_v3(
  p_order_id uuid,
  p_items jsonb,
  p_reason_code text,
  p_message text
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.request_customer_return_v3(p_order_id,p_items,p_reason_code,p_message);
$function$;

revoke all on function public.request_customer_return_v3(uuid,jsonb,text,text) from public;
revoke all on function public.request_customer_return_v3(uuid,jsonb,text,text) from anon;
grant execute on function public.request_customer_return_v3(uuid,jsonb,text,text) to authenticated;

create or replace function private.get_my_return_detail_v1(p_return_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  request_row public.return_requests%rowtype;
  result jsonb;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select * into request_row
  from public.return_requests request
  where request.id = p_return_id and request.user_id = caller_id;

  if request_row.id is null then
    raise exception 'return_not_found' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'id',request_row.id,
    'returnNumber',request_row.return_number,
    'orderId',request_row.order_id,
    'reasonCode',request_row.reason_code,
    'customerMessage',request_row.customer_message,
    'status',request_row.status,
    'resolution',request_row.resolution,
    'resolutionNote',request_row.resolution_note,
    'reviewReason',request_row.review_reason,
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
      join public.orders customer_order on customer_order.id=order_item.order_id
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
  ) into result;

  return result;
end;
$function$;

revoke all on function private.get_my_return_detail_v1(uuid) from public;
revoke all on function private.get_my_return_detail_v1(uuid) from anon;
revoke all on function private.get_my_return_detail_v1(uuid) from authenticated;

create or replace function public.get_my_return_detail_v1(p_return_id uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.get_my_return_detail_v1(p_return_id);
$function$;

revoke all on function public.get_my_return_detail_v1(uuid) from public;
revoke all on function public.get_my_return_detail_v1(uuid) from anon;
grant execute on function public.get_my_return_detail_v1(uuid) to authenticated;
