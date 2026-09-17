-- Drift closure: customer-initiated return requests (v1 whole-order, v2
-- per-item with cumulative quantity checks) and the event reservation intake
-- with capacity, waitlist, paid-ticket payment hold and idempotency handling.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION api_public_bridge.submit_event_reservation(p_idempotency_key text, p_request_hash text, p_event_reference text, p_guest_name text, p_guest_email text, p_guest_phone text, p_guest_count integer, p_notes text, p_ip_hash text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.submit_event_reservation(p_idempotency_key,p_request_hash,p_event_reference,p_guest_name,p_guest_email,p_guest_phone,p_guest_count,p_notes,p_ip_hash); $function$
;

CREATE OR REPLACE FUNCTION private.request_customer_return_v1(p_order_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_reason text := btrim(coalesce(p_reason, ''));
  target_order public.orders%rowtype;
  v_return_id uuid;
  v_return_number text;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(normalized_reason) not between 10 and 3000 then
    raise exception 'return_reason_required' using errcode = '22023';
  end if;

  select * into target_order
  from public.orders customer_order
  where customer_order.id = p_order_id
    and customer_order.user_id = caller_id
  for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if target_order.status not in ('delivered', 'completed') then
    raise exception 'order_not_returnable' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.return_requests request
    where request.order_id = target_order.id
      and request.status in ('requested', 'under_review', 'approved', 'in_transit', 'received')
  ) then
    raise exception 'active_return_already_exists' using errcode = '23505';
  end if;

  v_return_id := gen_random_uuid();
  v_return_number := 'RET-' || to_char(timezone('utc', now()), 'YYYY') || '-' || upper(substr(replace(v_return_id::text, '-', ''), 1, 10));
  insert into public.return_requests(
    id, return_number, order_id, user_id, reason_code, customer_message, status
  ) values (
    v_return_id, v_return_number, target_order.id, caller_id, 'other', normalized_reason, 'requested'
  );

  insert into public.return_items(return_id, order_item_id, quantity)
  select v_return_id, item.id, item.quantity
  from public.order_items item
  where item.order_id = target_order.id;

  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  select role.user_id,
    'return',
    'Yeni iade talebi',
    target_order.order_number || ' numaralı sipariş için iade talebi açıldı.',
    '/admin/returns',
    jsonb_build_object('orderId', target_order.id, 'returnId', v_return_id, 'returnNumber', v_return_number)
  from private.user_roles role
  join public.profiles profile on profile.id = role.user_id and profile.status = 'active'
  where role.role in ('admin', 'super_admin')
    and (role.expires_at is null or role.expires_at > timezone('utc', now()));

  insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
  values (
    'return_request', v_return_id, 'return.requested',
    jsonb_build_object('return_id', v_return_id, 'order_id', target_order.id, 'user_id', caller_id)
  );

  return jsonb_build_object(
    'id', v_return_id,
    'returnNumber', v_return_number,
    'orderId', target_order.id,
    'status', 'requested'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.request_customer_return_v2(p_order_id uuid, p_items jsonb, p_reason_code text, p_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  target_order public.orders%rowtype;
  normalized_reason text:=lower(btrim(coalesce(p_reason_code,'')));
  normalized_message text:=btrim(coalesce(p_message,''));
  item jsonb;
  order_item_id uuid;
  requested_quantity integer;
  target_item public.order_items%rowtype;
  already_returned integer;
  return_id uuid:=gen_random_uuid();
  return_number text;
  seen_ids uuid[]:='{}'::uuid[];
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if normalized_reason not in ('damaged','wrong_item','quality_issue','missing_item','changed_mind','delivery_issue','other') then raise exception 'invalid_return_reason' using errcode='22023'; end if;
  if char_length(normalized_message) not between 10 and 3000 then raise exception 'return_message_required' using errcode='22023'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'return_items_required' using errcode='22023'; end if;

  select * into target_order from public.orders customer_order
  where customer_order.id=p_order_id and customer_order.user_id=caller_id
  for update;
  if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.status not in ('delivered','completed') then raise exception 'order_not_returnable' using errcode='22023'; end if;
  if exists(select 1 from public.return_requests request where request.order_id=target_order.id and request.status in ('requested','under_review','approved','in_transit','received')) then raise exception 'active_return_already_exists' using errcode='23505'; end if;

  return_number:='RET-'||to_char(timezone('utc',now()),'YYYY')||'-'||upper(substr(replace(return_id::text,'-',''),1,10));
  insert into public.return_requests(id,return_number,order_id,user_id,reason_code,customer_message,status)
  values(return_id,return_number,target_order.id,caller_id,normalized_reason,normalized_message,'requested');

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item)<>'object' or coalesce(item->>'orderItemId','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(item->>'quantity','') !~ '^[0-9]{1,3}$' then raise exception 'invalid_return_item' using errcode='22023'; end if;
    order_item_id:=(item->>'orderItemId')::uuid;
    requested_quantity:=(item->>'quantity')::integer;
    if requested_quantity<=0 then raise exception 'invalid_return_quantity' using errcode='22023'; end if;
    if order_item_id=any(seen_ids) then raise exception 'duplicate_return_item' using errcode='22023'; end if;
    seen_ids:=array_append(seen_ids,order_item_id);

    select * into target_item from public.order_items order_item
    where order_item.id=order_item_id and order_item.order_id=target_order.id;
    if target_item.id is null then raise exception 'return_item_not_in_order' using errcode='22023'; end if;

    select coalesce(sum(returned_item.quantity),0)::integer into already_returned
    from public.return_items returned_item
    join public.return_requests request on request.id=returned_item.return_id
    where returned_item.order_item_id=target_item.id and request.status not in ('rejected');

    if requested_quantity+already_returned>target_item.quantity then raise exception 'return_quantity_exceeds_purchased' using errcode='22023'; end if;

    insert into public.return_items(return_id,order_item_id,quantity)
    values(return_id,target_item.id,requested_quantity);
  end loop;

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  select role.user_id,'return','Yeni iade talebi',target_order.order_number||' numaralı sipariş için ürün bazlı iade talebi açıldı.','/admin/returns',jsonb_build_object('orderId',target_order.id,'returnId',return_id,'returnNumber',return_number)
  from private.user_roles role
  join public.profiles profile on profile.id=role.user_id and profile.status='active'
  where role.role in ('admin','super_admin') and (role.expires_at is null or role.expires_at>timezone('utc',now()));

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('return_request',return_id,'return.requested',jsonb_build_object('return_id',return_id,'order_id',target_order.id,'user_id',caller_id,'reason_code',normalized_reason));

  return jsonb_build_object('id',return_id,'returnNumber',return_number,'orderId',target_order.id,'status','requested');
end;
$function$
;

CREATE OR REPLACE FUNCTION private.submit_event_reservation(p_idempotency_key text, p_request_hash text, p_event_reference text, p_guest_name text, p_guest_email text, p_guest_phone text, p_guest_count integer, p_notes text, p_ip_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid(); linked_user_id uuid; existing_key private.idempotency_keys%rowtype; target_event public.events%rowtype;
  reservation_id uuid; reservation_code_value text; reservation_status text; reserved_guest_count bigint; response_payload jsonb;
  normalized_email text:=lower(btrim(coalesce(p_guest_email,''))); is_paid boolean:=false; total_minor bigint:=0; commission_bps integer:=0; platform_fee bigint:=0; producer_net bigint:=0; payment_status_value text:='not_required'; payment_expires timestamptz:=null;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 200 then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  if p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_request_hash' using errcode='22023'; end if;
  if p_event_reference is null or char_length(btrim(p_event_reference)) not between 1 and 200 then raise exception 'invalid_event' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_guest_name,''))) not between 2 and 120 then raise exception 'invalid_name' using errcode='22023'; end if;
  if char_length(normalized_email)>254 or normalized_email !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then raise exception 'invalid_email' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_guest_phone,''))) not between 7 and 40 then raise exception 'invalid_phone' using errcode='22023'; end if;
  if p_guest_count is null or p_guest_count not between 1 and 20 then raise exception 'invalid_guest_count' using errcode='22023'; end if;
  if p_notes is not null and char_length(p_notes)>1000 then raise exception 'invalid_notes' using errcode='22023'; end if;
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_ip_hash' using errcode='22023'; end if;

  select * into existing_key from private.idempotency_keys where key=p_idempotency_key and scope='event_reservation';
  if existing_key.key is not null then if existing_key.request_hash<>p_request_hash then raise exception 'idempotency_key_reused' using errcode='22023'; end if; if existing_key.completed_at is not null then return existing_key.response_body; end if; end if;

  select e.* into target_event from public.events e where e.id::text=btrim(p_event_reference) or e.legacy_id=btrim(p_event_reference) or e.slug=btrim(p_event_reference)
  order by case when e.id::text=btrim(p_event_reference) then 0 when e.legacy_id=btrim(p_event_reference) then 1 else 2 end limit 1 for update;
  if target_event.id is null or target_event.status not in ('published','sold_out') then raise exception 'event_not_available' using errcode='22023'; end if;
  if target_event.starts_at<=timezone('utc',now()) then raise exception 'event_already_started' using errcode='22023'; end if;
  if target_event.reservation_deadline is not null and target_event.reservation_deadline<timezone('utc',now()) then raise exception 'reservation_deadline_passed' using errcode='22023'; end if;

  perform private.expire_event_payment_holds_v1(target_event.id);
  select coalesce(sum(r.guest_count),0) into reserved_guest_count from public.event_reservations r
   left join private.event_reservation_finance f on f.reservation_id=r.id
   where r.event_id=target_event.id and (r.status in ('pending','confirmed','attended') or (r.status='pending_payment' and f.payment_status='pending' and f.payment_expires_at>timezone('utc',now())));
  if target_event.status='sold_out' and (target_event.capacity is null or reserved_guest_count<target_event.capacity) then update public.events set status='published',updated_at=timezone('utc',now()) where id=target_event.id; target_event.status:='published'; end if;

  is_paid:=target_event.ticket_price_minor>0;
  if is_paid then
    if caller_id is null then raise exception 'authentication_required_for_paid_event' using errcode='42501'; end if;
    if not exists(select 1 from public.profiles p where p.id=caller_id and p.status='active' and p.deleted_at is null) then raise exception 'active_account_required' using errcode='42501'; end if;
    linked_user_id:=caller_id;
    total_minor:=target_event.ticket_price_minor*p_guest_count;
    if total_minor<=0 then raise exception 'invalid_event_payment_total' using errcode='55000'; end if;
    commission_bps:=case when target_event.producer_id is null then 10000 else target_event.platform_commission_basis_points end;
    if commission_bps not between 0 and 10000 then raise exception 'invalid_event_commission' using errcode='55000'; end if;
    platform_fee:=round((total_minor::numeric*commission_bps::numeric)/10000)::bigint;
    producer_net:=total_minor-platform_fee;
  elsif caller_id is not null and exists(select 1 from public.profiles p where p.id=caller_id and p.status='active' and p.deleted_at is null) then linked_user_id:=caller_id; end if;

  insert into private.idempotency_keys(key,scope,request_hash,locked_at,expires_at) values(p_idempotency_key,'event_reservation',p_request_hash,timezone('utc',now()),timezone('utc',now())+interval '24 hours') on conflict(key) do nothing;
  if not found then select * into existing_key from private.idempotency_keys where key=p_idempotency_key; if existing_key.scope<>'event_reservation' or existing_key.request_hash<>p_request_hash then raise exception 'idempotency_key_reused' using errcode='22023'; end if; if existing_key.completed_at is not null then return existing_key.response_body; end if; raise exception 'request_in_progress' using errcode='40001'; end if;
  if (select count(*) from private.submission_attempts where scope='event_reservation' and ip_hash=p_ip_hash and created_at>timezone('utc',now())-interval '1 hour')>=10 then raise exception 'rate_limit_exceeded' using errcode='P0001'; end if;
  if exists(select 1 from public.event_reservations r where r.event_id=target_event.id and lower(r.guest_email)=normalized_email and r.status in ('pending_payment','pending','confirmed','waitlisted','attended')) then raise exception 'duplicate_reservation' using errcode='23505'; end if;

  reservation_status:=case when target_event.status='sold_out' then 'waitlisted' when target_event.capacity is not null and reserved_guest_count+p_guest_count>target_event.capacity then 'waitlisted' when is_paid then 'pending_payment' else 'pending' end;
  if reservation_status='pending_payment' then payment_status_value:='pending'; payment_expires:=timezone('utc',now())+interval '20 minutes'; end if;
  reservation_code_value:='GOE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into private.submission_attempts(scope,ip_hash,request_hash) values('event_reservation',p_ip_hash,p_request_hash);
  insert into public.event_reservations(event_id,user_id,reservation_code,guest_name,guest_email,guest_phone,guest_count,notes,status)
  values(target_event.id,linked_user_id,reservation_code_value,btrim(p_guest_name),normalized_email,btrim(p_guest_phone),p_guest_count,nullif(btrim(coalesce(p_notes,'')),''),reservation_status) returning id into reservation_id;

  if is_paid then
    insert into private.event_reservation_finance(reservation_id,event_id,user_id,producer_id,ticket_price_minor,guest_count,total_minor,currency,commission_basis_points_snapshot,platform_fee_minor,producer_net_minor,payment_status,payment_expires_at)
    values(reservation_id,target_event.id,linked_user_id,target_event.producer_id,target_event.ticket_price_minor,p_guest_count,total_minor,target_event.currency,commission_bps,platform_fee,producer_net,payment_status_value,payment_expires);
  end if;

  if target_event.capacity is not null and reservation_status<>'waitlisted' and reserved_guest_count+p_guest_count>=target_event.capacity then update public.events set status='sold_out',updated_at=timezone('utc',now()) where id=target_event.id and status='published'; end if;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('event_reservation',reservation_id,'event.reservation_received',jsonb_build_object('reservation_id',reservation_id,'event_id',target_event.id,'status',reservation_status,'user_id',linked_user_id,'requires_payment',reservation_status='pending_payment'));
  response_payload:=jsonb_build_object('ok',true,'reservationId',reservation_id,'reservationCode',reservation_code_value,'status',reservation_status,'requiresPayment',reservation_status='pending_payment','amountMinor',case when is_paid then total_minor else 0 end,'currency',target_event.currency,'paymentExpiresAt',payment_expires);
  update private.idempotency_keys set response_status=201,response_body=response_payload,completed_at=timezone('utc',now()) where key=p_idempotency_key;
  return response_payload;
end;$function$
;

CREATE OR REPLACE FUNCTION public.submit_event_reservation(p_idempotency_key text, p_request_hash text, p_event_reference text, p_guest_name text, p_guest_email text, p_guest_phone text, p_guest_count integer, p_notes text, p_ip_hash text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.submit_event_reservation(p_idempotency_key, p_request_hash, p_event_reference, p_guest_name, p_guest_email, p_guest_phone, p_guest_count, p_notes, p_ip_hash); $function$
;
