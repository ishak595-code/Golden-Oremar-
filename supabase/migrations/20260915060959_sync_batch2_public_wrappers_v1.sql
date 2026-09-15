-- Batch 2 (part 2/3): public schema wrappers for the 56 functions in part 1.


CREATE OR REPLACE FUNCTION private.snapshot_order_item_commission_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  commission integer;
begin
  if new.producer_id is null then
    new.commission_basis_points_snapshot:=0;
    return new;
  end if;
  select producer.commission_basis_points into commission
  from public.producers producer
  where producer.id=new.producer_id;
  if commission is null then raise exception 'producer_not_found_for_order_item' using errcode='P0002'; end if;
  new.commission_basis_points_snapshot:=commission;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.sync_order_promotion_redemption_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status='confirmed' and new.payment_status='paid'
    and (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status) then
    perform private.consume_order_promotion_v1(new.id);
  elsif new.status='cancelled' and old.status is distinct from new.status then
    perform private.release_order_promotion_v1(new.id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.sync_producer_finance_from_refund_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status='succeeded' and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform private.record_refund_producer_reversal_v1(new.id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.unregister_push_token_v1(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); hash_value text; affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  hash_value:=private.hash_push_token_v1(p_token);
  update private.device_push_tokens set disabled_at=timezone('utc',now()),updated_at=timezone('utc',now()) where user_id=caller_id and token_hash=hash_value and disabled_at is null;
  get diagnostics affected=row_count;
  return affected>0;
end;
$function$;

CREATE OR REPLACE FUNCTION private.upsert_customer_address_impl_v1(p_address_id uuid, p_label text, p_recipient_name text, p_phone text, p_country_code text, p_province text, p_district text, p_neighborhood text, p_address_line text, p_postal_code text, p_delivery_notes text, p_is_default boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  address_row public.addresses%rowtype;
  make_default boolean;
  phone_digits text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_label,''))) not between 1 and 60
     or char_length(btrim(coalesce(p_recipient_name,''))) not between 2 and 120
     or char_length(coalesce(p_phone,''))>40
     or char_length(phone_digits) not between 10 and 15
     or upper(btrim(coalesce(p_country_code,''))) !~ '^[A-Z]{2}$'
     or char_length(btrim(coalesce(p_province,''))) not between 2 and 120
     or char_length(btrim(coalesce(p_district,''))) not between 2 and 120
     or char_length(coalesce(p_neighborhood,''))>160
     or char_length(btrim(coalesce(p_address_line,''))) not between 10 and 1000
     or char_length(coalesce(p_postal_code,''))>20
     or char_length(coalesce(p_delivery_notes,''))>500 then
    raise exception 'invalid_address' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text,85027));
  if p_address_id is not null and not exists(select 1 from public.addresses where id=p_address_id and user_id=caller_id and deleted_at is null) then raise exception 'address_not_found' using errcode='P0002'; end if;
  if p_address_id is null and (select count(*) from public.addresses where user_id=caller_id and deleted_at is null)>=20 then raise exception 'address_limit_exceeded' using errcode='54000'; end if;

  make_default:=coalesce(p_is_default,false) or not exists(select 1 from public.addresses where user_id=caller_id and deleted_at is null and is_default=true);
  if make_default then
    update public.addresses set is_default=false,updated_at=timezone('utc',now()) where user_id=caller_id and deleted_at is null and is_default=true;
  end if;

  if p_address_id is null then
    insert into public.addresses(user_id,label,recipient_name,phone,country_code,province,district,neighborhood,address_line,postal_code,delivery_notes,is_default)
    values(caller_id,btrim(p_label),btrim(p_recipient_name),btrim(p_phone),upper(btrim(p_country_code)),btrim(p_province),btrim(p_district),nullif(btrim(coalesce(p_neighborhood,'')),''),btrim(p_address_line),nullif(btrim(coalesce(p_postal_code,'')),''),nullif(btrim(coalesce(p_delivery_notes,'')),''),make_default)
    returning * into address_row;
  else
    update public.addresses
    set label=btrim(p_label),recipient_name=btrim(p_recipient_name),phone=btrim(p_phone),country_code=upper(btrim(p_country_code)),province=btrim(p_province),district=btrim(p_district),
        neighborhood=nullif(btrim(coalesce(p_neighborhood,'')),''),address_line=btrim(p_address_line),postal_code=nullif(btrim(coalesce(p_postal_code,'')),''),delivery_notes=nullif(btrim(coalesce(p_delivery_notes,'')),''),
        is_default=make_default,updated_at=timezone('utc',now())
    where id=p_address_id and user_id=caller_id and deleted_at is null
    returning * into address_row;
  end if;
  return to_jsonb(address_row);
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_order_export_eligibility_v1(p_order_id uuid, p_country_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  country_code text:=upper(btrim(coalesce(p_country_code,'')));
  item record;
  result jsonb;
  zone_row public.shipping_zones%rowtype;
begin
  if country_code='TR' then return; end if;
  zone_row:=private.resolve_shipping_zone_v1(country_code);
  if zone_row.id is null then raise exception 'shipping_zone_unavailable:%',country_code using errcode='55000'; end if;
  if zone_row.requires_manual_quote then raise exception 'manual_shipping_quote_required:%',country_code using errcode='55000'; end if;

  for item in select distinct order_item.product_id from public.order_items order_item where order_item.order_id=p_order_id and order_item.product_id is not null
  loop
    result:=private.check_product_export_eligibility_v1(item.product_id,country_code);
    if not coalesce((result->>'available')::boolean,false) then
      raise exception 'international_product_not_eligible:%:%',item.product_id,coalesce(result->>'reason','unknown') using errcode='55000';
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_paid_event_reservation_buyer_name_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare paid boolean:=false;
begin
 select e.ticket_price_minor>0 into paid from public.events e where e.id=new.event_id;
 if paid and (new.user_id is null or btrim(new.guest_name) !~ '^[^[:space:]]+[[:space:]]+[^[:space:]].*$') then raise exception 'paid_event_full_name_required' using errcode='22023'; end if;
 return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.validate_product_change_request_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.validate_product_change_payload_v1(new.product_id,new.producer_id,new.requested_by,new.proposed_payload);
  return new;
end;
$function$;

-- ============================================================
-- public schema wrappers
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_verified_refund_v1(p_return_id uuid, p_payment_id uuid, p_provider text, p_provider_reference text, p_amount_minor bigint, p_currency text, p_status text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.apply_verified_refund_v1(p_return_id,p_payment_id,p_provider,p_provider_reference,p_amount_minor,p_currency,p_status,null); $function$;

CREATE OR REPLACE FUNCTION public.cancel_my_stock_alert_v1(p_variant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.cancel_my_stock_alert_v1(p_variant_id); $function$;

CREATE OR REPLACE FUNCTION public.claim_push_deliveries_v1(p_limit integer, p_worker_id text)
 RETURNS TABLE(delivery_id bigint, provider text, platform text, environment text, push_token text, title text, body text, action_url text, metadata jsonb)
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from private.claim_push_deliveries_v1(p_limit,p_worker_id); $function$;

CREATE OR REPLACE FUNCTION public.complete_commerce_payment_for_service_v3(p_intent_id uuid, p_provider_reference text, p_payment_method_type text, p_status text, p_provider_payload jsonb DEFAULT '{}'::jsonb, p_failure_code text DEFAULT NULL::text, p_failure_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if; return private.complete_commerce_payment_for_service_v3(p_intent_id,p_provider_reference,p_payment_method_type,p_status,p_provider_payload,p_failure_code,p_failure_message); end;$function$;

CREATE OR REPLACE FUNCTION public.complete_event_refund_for_service_v1(p_reservation_id uuid, p_refund_transaction_id text, p_refund_reference text, p_provider_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f private.event_reservation_finance%rowtype; r public.event_reservations%rowtype; p public.payment_records%rowtype; tx text:=btrim(coalesce(p_refund_transaction_id,'')); ref text:=nullif(btrim(coalesce(p_refund_reference,'')),''); payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_reservation_id is null or char_length(tx) not between 4 and 220 or (ref is not null and char_length(ref)>220) or jsonb_typeof(payload)<>'object' then raise exception 'invalid_refund_context' using errcode='22023'; end if;
 select * into f from private.event_reservation_finance where reservation_id=p_reservation_id for update;
 select * into r from public.event_reservations where id=p_reservation_id for update;
 if f.reservation_id is null or r.id is null then raise exception 'event_refund_context_not_found' using errcode='P0002'; end if;
 if f.payment_status='refunded' then return jsonb_build_object('ok',true,'reservationId',r.id,'status','refunded','unchanged',true); end if;
 if f.payment_status<>'refund_required' or f.provider is null or f.provider_reference is null then raise exception 'event_refund_not_required' using errcode='55000'; end if;
 select * into p from public.payment_records where subject_type='event_reservation' and subject_id=r.id and provider=f.provider and provider_reference=f.provider_reference for update;
 if p.id is null then raise exception 'event_payment_record_not_found' using errcode='P0002'; end if;
 update private.event_reservation_finance set payment_status='refunded',refund_transaction_id=tx,refund_reference=ref,refunded_at=timezone('utc',now()),last_refund_error=null,last_refund_attempt_at=timezone('utc',now()),updated_at=timezone('utc',now()) where reservation_id=r.id;
 insert into private.payment_events(provider,provider_event_id,payment_id,event_type,payload,signature_verified,processing_status,processed_at)
 values(f.provider,'event-refund:'||r.id::text,p.id,'payment.refunded',payload,true,'processed',timezone('utc',now())) on conflict(provider,provider_event_id) do nothing;
 insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('event_reservation',r.id,'event.payment_refunded',jsonb_build_object('reservation_id',r.id,'event_id',r.event_id,'payment_id',p.id,'amount_minor',f.total_minor,'currency',f.currency));
 return jsonb_build_object('ok',true,'reservationId',r.id,'status','refunded','amountMinor',f.total_minor,'currency',f.currency);
end;$function$;

CREATE OR REPLACE FUNCTION public.complete_push_delivery_v1(p_delivery_id bigint, p_success boolean, p_error text DEFAULT NULL::text, p_disable_token boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.complete_push_delivery_v1(p_delivery_id,p_success,p_error,p_disable_token); $function$;

CREATE OR REPLACE FUNCTION public.fail_commerce_payment_intent_for_service_v2(p_intent_id uuid, p_failure_code text, p_failure_message text, p_provider_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare intent private.payment_intents%rowtype; begin if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if; select * into intent from private.payment_intents where id=p_intent_id; if intent.id is null then raise exception 'payment_intent_not_found' using errcode='P0002'; end if; if intent.subject_type='order' then return private.fail_order_payment_intent_for_service_v1(p_intent_id,p_failure_code,p_failure_message,p_provider_payload); elsif intent.subject_type='event_reservation' then return private.fail_event_reservation_payment_for_service_v1(p_intent_id,p_failure_code,p_failure_message,p_provider_payload); end if; raise exception 'unsupported_payment_subject_type' using errcode='55000'; end;$function$;

CREATE OR REPLACE FUNCTION public.get_event_reservation_payment_state_for_service_v1(p_user_id uuid, p_reservation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.event_reservations%rowtype; f private.event_reservation_finance%rowtype; e public.events%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_user_id is null or p_reservation_id is null then raise exception 'payment_context_required' using errcode='22023'; end if;
 select * into r from public.event_reservations where id=p_reservation_id and user_id=p_user_id;
 if r.id is null then raise exception 'event_reservation_not_found' using errcode='P0002'; end if;
 select * into e from public.events where id=r.event_id;
 select * into f from private.event_reservation_finance where reservation_id=r.id;
 return jsonb_build_object(
  'reservationId',r.id,'reservationCode',r.reservation_code,'reservationStatus',case when r.status='pending_payment' and f.payment_status='pending' and f.payment_expires_at<=timezone('utc',now()) then 'cancelled' else r.status end,
  'eventId',r.event_id,'eventTitle',e.title,
  'payment',case when f.reservation_id is null then jsonb_build_object('status','not_required','requiresPayment',false,'amountMinor',0,'currency',e.currency,'expiresAt',null)
    else jsonb_build_object('status',case when f.payment_status='pending' and f.payment_expires_at<=timezone('utc',now()) then 'expired' else f.payment_status end,'requiresPayment',f.payment_status='pending' and f.payment_expires_at>timezone('utc',now()),'amountMinor',f.total_minor,'currency',f.currency,'expiresAt',f.payment_expires_at) end
 );
end;$function$;

CREATE OR REPLACE FUNCTION public.get_my_account_closure_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.get_my_account_closure_v1(); $function$;

CREATE OR REPLACE FUNCTION public.get_my_producer_location_change_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.get_my_producer_location_change_v1(); $function$;

CREATE OR REPLACE FUNCTION public.get_product_traceability_v1(p_trace_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'trace_code', batch.trace_code,
    'batch_code', batch.batch_code,
    'status', batch.status,
    'harvest_date', batch.harvest_date,
    'production_date', batch.production_date,
    'packaging_date', batch.packaging_date,
    'best_before_date', batch.best_before_date,
    'origin', jsonb_build_object(
      'country_code', batch.origin_country_code,
      'province', batch.origin_province,
      'district', batch.origin_district,
      'village', batch.origin_village,
      'latitude', batch.origin_latitude,
      'longitude', batch.origin_longitude
    ),
    'production_method', batch.production_method,
    'public_notes', batch.public_notes,
    'released_at', batch.released_at,
    'product', jsonb_build_object(
      'id', product.id,
      'slug', product.slug,
      'name', product.name,
      'unit_label', product.unit_label,
      'origin', product.origin,
      'primary_image_path', (
        select image.storage_path from public.product_images image
        where image.product_id = product.id
        order by image.is_primary desc, image.sort_order asc, image.created_at asc
        limit 1
      )
    ),
    'producer', jsonb_build_object(
      'id', producer.id,
      'slug', producer.slug,
      'display_name', producer.display_name,
      'is_verified', producer.is_verified,
      'production_location', producer.production_location,
      'village', producer.production_village,
      'district', producer.production_district,
      'province', producer.production_province
    ),
    'certifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', certification.certificate_type,
        'issuer', certification.issuer,
        'certificate_number', certification.certificate_number,
        'issued_at', certification.issued_at,
        'expires_at', certification.expires_at,
        'verification_url', certification.verification_url,
        'status', certification.status
      ) order by certification.certificate_type, certification.issuer)
      from public.product_batch_certifications link
      join public.product_certifications certification on certification.id = link.certification_id
      where link.batch_id = batch.id
        and certification.status = 'valid'
        and (certification.expires_at is null or certification.expires_at >= current_date)
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', event.event_type,
        'at', event.event_at,
        'location', event.location_label,
        'note', event.public_note
      ) order by event.event_at, event.id)
      from public.product_batch_events event
      where event.batch_id = batch.id and event.visibility = 'public'
    ), '[]'::jsonb)
  ) into result
  from public.product_batches batch
  join public.products product on product.id = batch.product_id
  join public.producers producer on producer.id = batch.producer_id
  where batch.trace_code = upper(btrim(coalesce(p_trace_code, '')))
    and batch.status = 'released'
    and product.status = 'published' and product.is_active = true and product.deleted_at is null
    and producer.status = 'active' and producer.is_verified = true and producer.deleted_at is null;

  if result is null then raise exception 'traceability_not_found' using errcode = 'P0002'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_customer_returns_v1()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.list_customer_returns_v1(); $function$;

CREATE OR REPLACE FUNCTION public.list_event_refunds_required_for_service_v1(p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_limit not between 1 and 200 then raise exception 'invalid_limit' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('reservationId',f.reservation_id,'eventId',f.event_id,'userId',f.user_id,'producerId',f.producer_id,'amountMinor',f.total_minor,'currency',f.currency,'provider',f.provider,'providerReference',f.provider_reference,'attemptCount',f.refund_attempt_count,'lastError',f.last_refund_error,'lastAttemptAt',f.last_refund_attempt_at,'createdAt',f.created_at,'reservationCode',r.reservation_code,'eventTitle',e.title) order by f.created_at asc),'[]'::jsonb) into result
 from (select * from private.event_reservation_finance where payment_status='refund_required' order by created_at asc limit p_limit) f
 join public.event_reservations r on r.id=f.reservation_id join public.events e on e.id=f.event_id;
 return result;
end;$function$;

CREATE OR REPLACE FUNCTION public.list_my_conversations_v1(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.list_my_conversations_v1(p_limit,p_offset); $function$;

CREATE OR REPLACE FUNCTION public.mark_event_refund_attempt_for_service_v1(p_reservation_id uuid, p_error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f private.event_reservation_finance%rowtype; safe_error text:=nullif(btrim(coalesce(p_error,'')),'');
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_reservation_id is null then raise exception 'reservation_id_required' using errcode='22023'; end if;
 if safe_error is not null and (char_length(safe_error)>500 or safe_error ~ '[[:cntrl:]]') then safe_error:='refund_provider_error'; end if;
 select * into f from private.event_reservation_finance where reservation_id=p_reservation_id for update;
 if f.reservation_id is null or f.payment_status<>'refund_required' then raise exception 'event_refund_not_required' using errcode='55000'; end if;
 update private.event_reservation_finance set refund_attempt_count=refund_attempt_count+1,last_refund_error=safe_error,last_refund_attempt_at=timezone('utc',now()),updated_at=timezone('utc',now()) where reservation_id=p_reservation_id returning * into f;
 return jsonb_build_object('ok',true,'reservationId',f.reservation_id,'attemptCount',f.refund_attempt_count,'status',f.payment_status);
end;$function$;

CREATE OR REPLACE FUNCTION public.prepare_event_reservation_hosted_payment_for_service_v1(p_user_id uuid, p_reservation_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.prepare_event_reservation_hosted_payment_for_service_v1(p_user_id,p_reservation_id,p_idempotency_key); $function$;

CREATE OR REPLACE FUNCTION public.set_review_helpful_vote_v1(p_review_id uuid, p_helpful boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.set_review_helpful_vote_v1(p_review_id,p_helpful); $function$;

CREATE OR REPLACE FUNCTION public.store_hosted_payment_session_for_service_v2(p_intent_id uuid, p_token text, p_client_ip inet, p_provider_snapshot jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare intent private.payment_intents%rowtype; token_value text:=btrim(coalesce(p_token,'')); snapshot jsonb:=coalesce(p_provider_snapshot,'{}'::jsonb);
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_intent_id is null or char_length(token_value) not between 8 and 500 or p_client_ip is null or jsonb_typeof(snapshot)<>'object' then raise exception 'invalid_hosted_payment_session' using errcode='22023'; end if;
 select * into intent from private.payment_intents where id=p_intent_id for update;
 if intent.id is null or intent.payment_flow<>'checkout_form' or intent.status not in ('processing','authorized') then raise exception 'payment_intent_not_hosted' using errcode='55000'; end if;
 update private.payment_intents set provider_session_token=token_value,provider_result=provider_result||snapshot,client_ip=p_client_ip,updated_at=timezone('utc',now()) where id=intent.id;
 return jsonb_build_object('ok',true,'intentId',intent.id,'subjectType',intent.subject_type,'subjectId',intent.subject_id);
end;$function$;

CREATE OR REPLACE FUNCTION public.unregister_push_token_v1(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.unregister_push_token_v1(p_token); $function$;

CREATE OR REPLACE FUNCTION public.upsert_customer_address(p_address_id uuid, p_label text, p_recipient_name text, p_phone text, p_country_code text, p_province text, p_district text, p_neighborhood text, p_address_line text, p_postal_code text, p_delivery_notes text, p_is_default boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.upsert_customer_address_impl_v1(p_address_id,p_label,p_recipient_name,p_phone,p_country_code,p_province,p_district,p_neighborhood,p_address_line,p_postal_code,p_delivery_notes,p_is_default); $function$;
