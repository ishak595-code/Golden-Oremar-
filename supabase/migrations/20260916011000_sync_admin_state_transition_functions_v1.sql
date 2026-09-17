-- Drift closure: admin state-transition functions - platform user activate/block,
-- return request status machine, account closure workflow (including the KVKK-style
-- data minimisation step performed at ready_for_auth_deletion), and producer
-- payout scheduling with available-balance enforcement.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_schedule_producer_payout_v1(p_producer_id uuid, p_currency text, p_amount_minor bigint, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  producer_row public.producers%rowtype;
  currency_code text:=upper(btrim(coalesce(p_currency,'')));
  balance jsonb;
  available bigint;
  payout_row private.producer_payouts%rowtype;
begin
  if caller_id is null or not private.has_permission('payout.review') then raise exception 'permission_required:payout.review' using errcode='42501'; end if;
  if currency_code !~ '^[A-Z]{3}$' or p_amount_minor is null or p_amount_minor<=0 then raise exception 'invalid_payout_request' using errcode='22023'; end if;
  if char_length(coalesce(p_note,''))>1000 then raise exception 'payout_note_too_long' using errcode='22023'; end if;
  select * into producer_row from public.producers where id=p_producer_id and deleted_at is null for update;
  if producer_row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  balance:=private.get_producer_balance_v1(producer_row.id,currency_code);
  available:=(balance->>'availableToPayoutMinor')::bigint;
  if p_amount_minor>available then raise exception 'payout_exceeds_available_balance' using errcode='22023'; end if;
  insert into private.producer_payouts(producer_id,currency,amount_minor,status,note,created_by)
  values(producer_row.id,currency_code,p_amount_minor,'scheduled',nullif(btrim(coalesce(p_note,'')),''),caller_id)
  returning * into payout_row;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('producer_payout',payout_row.id,'producer_payout.scheduled',jsonb_build_object('payout_id',payout_row.id,'producer_id',producer_row.id,'currency',currency_code,'amount_minor',p_amount_minor,'actor_user_id',caller_id));
  return jsonb_build_object('id',payout_row.id,'producerId',producer_row.id,'currency',currency_code,'amountMinor',p_amount_minor,'status',payout_row.status);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_set_platform_user_status_v1(p_user_id uuid, p_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  normalized_reason text := btrim(coalesce(p_reason, ''));
  target_is_super_admin boolean;
  caller_is_super_admin boolean;
  updated_profile public.profiles%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('user.manage'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_user_id is null or normalized_status not in ('active', 'blocked') then
    raise exception 'invalid_user_status' using errcode = '22023';
  end if;
  if char_length(normalized_reason) not between 8 and 500 then
    raise exception 'status_reason_required' using errcode = '22023';
  end if;
  if p_user_id = caller_id and normalized_status = 'blocked' then
    raise exception 'cannot_block_current_user' using errcode = '42501';
  end if;
  select exists (
    select 1 from private.user_roles role
    where role.user_id = p_user_id and role.role = 'super_admin'
      and (role.expires_at is null or role.expires_at > timezone('utc', now()))
  ) into target_is_super_admin;
  caller_is_super_admin := coalesce(private.has_permission('role.manage'), false);
  if target_is_super_admin and not caller_is_super_admin then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;
  update public.profiles set status = normalized_status, deleted_at = null where id = p_user_id
  returning * into updated_profile;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (
    p_user_id, 'system',
    case when normalized_status = 'active' then 'Hesabınız yeniden etkinleştirildi' else 'Hesabınıza erişim kısıtlandı' end,
    case when normalized_status = 'active'
      then 'Hesabınız yönetim incelemesinin ardından yeniden etkinleştirildi.'
      else 'Hesabınız yönetim incelemesi nedeniyle geçici olarak kısıtlandı. Destek ekibiyle iletişime geçebilirsiniz.'
    end,
    '/account', jsonb_build_object('reason', normalized_reason, 'actorUserId', caller_id)
  );
  return jsonb_build_object('id', updated_profile.id, 'status', case when updated_profile.status = 'active' then 'active' else 'blocked' end, 'updatedAt', updated_profile.updated_at);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_set_return_status_v1(p_order_id uuid, p_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_input text := lower(btrim(coalesce(p_status, '')));
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  next_status text;
  target_return public.return_requests%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('refund.approve'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  next_status := case normalized_input
    when 'requested' then 'under_review' when 'approved' then 'approved' when 'rejected' then 'rejected'
    when 'completed' then 'closed' when 'under_review' then 'under_review' when 'in_transit' then 'in_transit'
    when 'received' then 'received' when 'closed' then 'closed' else null
  end;
  if next_status is null then raise exception 'invalid_return_status' using errcode = '22023'; end if;
  if next_status = 'rejected' and char_length(coalesce(normalized_reason, '')) < 8 then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;
  select * into target_return from public.return_requests request where request.order_id = p_order_id
  order by request.created_at desc limit 1 for update;
  if not found then raise exception 'return_request_not_found' using errcode = 'P0002'; end if;
  if not (
    (target_return.status = 'requested' and next_status in ('under_review', 'approved', 'rejected'))
    or (target_return.status = 'under_review' and next_status in ('approved', 'rejected'))
    or (target_return.status = 'approved' and next_status in ('in_transit', 'received', 'closed'))
    or (target_return.status = 'in_transit' and next_status in ('received', 'closed'))
    or (target_return.status = 'received' and next_status = 'closed')
  ) then
    raise exception 'invalid_return_status_transition:%:%', target_return.status, next_status using errcode = '22023';
  end if;
  update public.return_requests
  set status = next_status,
      review_reason = coalesce(normalized_reason, review_reason),
      reviewed_by = caller_id, reviewed_at = timezone('utc', now()),
      resolution = case when next_status = 'rejected' then 'none' when next_status = 'closed' then coalesce(resolution, 'none') else resolution end
  where id = target_return.id returning * into target_return;
  if next_status = 'closed' then
    update public.order_items item
    set fulfillment_status = case when exists (select 1 from public.return_items returned where returned.return_id = target_return.id and returned.order_item_id = item.id) then 'returned' else item.fulfillment_status end
    where item.order_id = target_return.order_id;
  end if;
  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (target_return.user_id, 'return', 'İade talebiniz güncellendi',
    target_return.return_number || ' numaralı iade talebinizin yeni durumu: ' || next_status || '.',
    '/account/orders', jsonb_build_object('returnId', target_return.id, 'orderId', target_return.order_id, 'status', next_status));
  insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
  values ('return_request', target_return.id, 'return.status_changed', jsonb_build_object('return_id', target_return.id, 'status', next_status, 'actor_user_id', caller_id));
  return jsonb_build_object('id', target_return.id, 'orderId', target_return.order_id, 'status', target_return.status, 'returnNumber', target_return.return_number);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_update_account_closure_v1(p_request_id uuid, p_status text, p_admin_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  next_status text:=lower(btrim(coalesce(p_status,'')));
  note_value text:=nullif(btrim(coalesce(p_admin_note,'')),'');
  request_row private.account_closure_requests%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('user.manage'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if next_status not in ('processing','ready_for_auth_deletion','completed','rejected') then raise exception 'invalid_account_closure_status' using errcode='22023'; end if;
  if note_value is not null and char_length(note_value)>4000 then raise exception 'account_closure_admin_note_too_long' using errcode='22023'; end if;
  select * into request_row from private.account_closure_requests where id=p_request_id for update;
  if request_row.id is null then raise exception 'account_closure_not_found' using errcode='P0002'; end if;
  if not (
    (request_row.status='requested' and next_status in ('processing','rejected'))
    or (request_row.status='processing' and next_status in ('ready_for_auth_deletion','rejected'))
    or (request_row.status='ready_for_auth_deletion' and next_status='completed')
  ) then raise exception 'invalid_account_closure_transition:%:%',request_row.status,next_status using errcode='22023'; end if;
  if next_status='ready_for_auth_deletion' then
    update public.profiles
    set status='deleted',display_name='Silinmiş Kullanıcı',phone=null,avatar_path=null,marketing_consent=false,marketing_consent_at=null,deleted_at=timezone('utc',now()),updated_at=timezone('utc',now())
    where id=request_row.user_id;
    update public.addresses set deleted_at=coalesce(deleted_at,timezone('utc',now())),is_default=false,updated_at=timezone('utc',now()) where user_id=request_row.user_id and deleted_at is null;
    delete from public.favorites where user_id=request_row.user_id;
    update public.carts set status='abandoned',updated_at=timezone('utc',now()) where user_id=request_row.user_id and status='active';
    delete from private.device_push_tokens where user_id=request_row.user_id;
    update private.user_notification_preferences set push_enabled=false,campaign_push=false,updated_at=timezone('utc',now()) where user_id=request_row.user_id;
    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('account_closure',request_row.id,'account_closure.auth_deletion_required',jsonb_build_object('request_id',request_row.id,'user_id',request_row.user_id));
  end if;
  update private.account_closure_requests
  set status=next_status,admin_note=note_value,updated_at=timezone('utc',now()),processed_by=caller_id,
      processed_at=case when next_status in ('completed','rejected') then timezone('utc',now()) else processed_at end
  where id=request_row.id returning * into request_row;
  return jsonb_build_object('id',request_row.id,'userId',request_row.user_id,'status',request_row.status,'updatedAt',request_row.updated_at,'processedAt',request_row.processed_at);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_schedule_producer_payout_v1(p_producer_id uuid, p_currency text, p_amount_minor bigint, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_schedule_producer_payout_v1(p_producer_id,p_currency,p_amount_minor,p_note); $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_platform_user_status_v1(p_user_id uuid, p_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_set_platform_user_status_v1(p_user_id, p_status, p_reason);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_return_status_v1(p_order_id uuid, p_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_set_return_status_v1(p_order_id, p_status, p_reason); $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_account_closure_v1(p_request_id uuid, p_status text, p_admin_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_update_account_closure_v1(p_request_id,p_status,p_admin_note); $function$
;
