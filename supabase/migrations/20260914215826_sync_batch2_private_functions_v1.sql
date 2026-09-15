-- Batch 2 (part 1/3): 56 customer/producer/messaging/payment RPC functions
-- confirmed live in "golden-oremar" (rmfcziawxjgcnxexbrvw) but absent from
-- every prior migration (verified via full-text search across the whole
-- migrations/ folder, not just a CREATE FUNCTION regex). Definitions pulled
-- via pg_get_functiondef on 2026-09-14/15; applying is a no-op against the
-- live database, only closes repo/live drift.

-- Reconciliation migration (batch 2): captures 56 additional functions and
-- 51 trigger bindings that exist live in the "golden-oremar" project
-- (rmfcziawxjgcnxexbrvw) but were never committed as versioned migrations.
-- Verified via pg_get_functiondef / pg_get_triggerdef against the live
-- project on 2026-09-14, so applying is a no-op against the live database
-- and only closes repo/live drift.
--
-- Scope note: closes drift for the 56 functions confirmed absent via
-- full-text search across every prior migration, plus every trigger
-- attached to any of them. Does not certify zero drift across the
-- remaining ~350 functions elsewhere in public/private/api_public_bridge.

-- ============================================================
-- private schema implementations
-- ============================================================

CREATE OR REPLACE FUNCTION private.apply_verified_refund_v1(p_return_id uuid, p_payment_id uuid, p_provider text, p_provider_reference text, p_amount_minor bigint, p_currency text, p_status text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_return public.return_requests%rowtype;
  target_payment public.payment_records%rowtype;
  target_order public.orders%rowtype;
  normalized_provider text:=lower(btrim(coalesce(p_provider,'')));
  normalized_reference text:=btrim(coalesce(p_provider_reference,''));
  normalized_currency text:=upper(btrim(coalesce(p_currency,'')));
  normalized_status text:=lower(btrim(coalesce(p_status,'')));
  refund_row public.refunds%rowtype;
  succeeded_total bigint;
  payment_refunded_total bigint;
  new_payment_status text;
begin
  if p_amount_minor is null or p_amount_minor<=0 then raise exception 'invalid_refund_amount' using errcode='22023'; end if;
  if char_length(normalized_provider) not between 2 and 80 or char_length(normalized_reference) not between 4 and 180 then raise exception 'invalid_refund_reference' using errcode='22023'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_refund_currency' using errcode='22023'; end if;
  if normalized_status not in ('pending','processing','succeeded','failed','cancelled') then raise exception 'invalid_refund_status' using errcode='22023'; end if;

  select * into target_return from public.return_requests where id=p_return_id for update;
  if target_return.id is null then raise exception 'return_request_not_found' using errcode='P0002'; end if;
  if target_return.status not in ('approved','in_transit','received','refunded','closed') then raise exception 'return_not_ready_for_refund' using errcode='55000'; end if;
  if target_return.resolution not in ('refund','partial_refund') then raise exception 'return_resolution_not_refundable' using errcode='55000'; end if;

  select * into target_payment from public.payment_records payment where payment.id=p_payment_id and payment.order_id=target_return.order_id for update;
  if target_payment.id is null then raise exception 'payment_not_found_for_return' using errcode='P0002'; end if;
  if target_payment.status not in ('captured','partially_refunded','refunded') then raise exception 'payment_not_refundable' using errcode='55000'; end if;
  if target_payment.currency<>normalized_currency then raise exception 'refund_currency_mismatch' using errcode='22023'; end if;

  select * into target_order from public.orders where id=target_return.order_id for update;

  select coalesce(sum(refund.amount_minor),0)::bigint into payment_refunded_total
  from public.refunds refund
  where refund.payment_id=target_payment.id and refund.status='succeeded'
    and not (refund.provider=normalized_provider and refund.provider_reference=normalized_reference);
  if payment_refunded_total+p_amount_minor>target_payment.amount_minor then raise exception 'refund_exceeds_payment' using errcode='22023'; end if;

  select * into refund_row from public.refunds refund
  where refund.provider=normalized_provider and refund.provider_reference=normalized_reference for update;

  if refund_row.id is null then
    insert into public.refunds(order_id,return_id,payment_id,amount_minor,currency,reason,provider,provider_reference,status,processed_at)
    values(target_return.order_id,target_return.id,target_payment.id,p_amount_minor,normalized_currency,coalesce(target_return.resolution_note,target_return.customer_message),normalized_provider,normalized_reference,normalized_status,case when normalized_status in ('succeeded','failed','cancelled') then timezone('utc',now()) end)
    returning * into refund_row;
  else
    if refund_row.order_id<>target_return.order_id or refund_row.payment_id is distinct from target_payment.id or refund_row.amount_minor<>p_amount_minor or refund_row.currency<>normalized_currency then raise exception 'refund_reference_reused' using errcode='23505'; end if;
    if refund_row.status<>normalized_status then
      if not ((refund_row.status='pending' and normalized_status in ('processing','succeeded','failed','cancelled')) or (refund_row.status='processing' and normalized_status in ('succeeded','failed','cancelled'))) then raise exception 'invalid_refund_transition:%:%',refund_row.status,normalized_status using errcode='22023'; end if;
      update public.refunds set status=normalized_status,processed_at=case when normalized_status in ('succeeded','failed','cancelled') then timezone('utc',now()) else processed_at end,updated_at=timezone('utc',now()) where id=refund_row.id returning * into refund_row;
    end if;
  end if;

  if normalized_status='succeeded' then
    select coalesce(sum(refund.amount_minor),0)::bigint into succeeded_total from public.refunds refund where refund.order_id=target_order.id and refund.status='succeeded';
    new_payment_status:=case when succeeded_total>=target_order.total_minor then 'refunded' else 'partially_refunded' end;
    update public.orders set payment_status=new_payment_status,status=case when succeeded_total>=target_order.total_minor then 'refunded' else status end,updated_at=timezone('utc',now()) where id=target_order.id;
    update public.payment_records set status=case when payment_refunded_total+p_amount_minor>=amount_minor then 'refunded' else 'partially_refunded' end,updated_at=timezone('utc',now()) where id=target_payment.id;
    update public.return_requests set status='refunded',reviewed_at=timezone('utc',now()) where id=target_return.id and status<>'closed';
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(target_return.user_id,'return','Ödeme iadeniz işlendi',target_return.return_number||' numaralı iade talebiniz için ödeme iadesi işlendi.','/account/orders',jsonb_build_object('returnId',target_return.id,'refundId',refund_row.id,'amountMinor',p_amount_minor,'currency',normalized_currency));
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('refund',refund_row.id,'refund.'||normalized_status,jsonb_build_object('refund_id',refund_row.id,'return_id',target_return.id,'order_id',target_order.id,'status',normalized_status,'amount_minor',p_amount_minor,'currency',normalized_currency));

  return jsonb_build_object('refundId',refund_row.id,'returnId',target_return.id,'orderId',target_order.id,'status',refund_row.status,'amountMinor',refund_row.amount_minor,'currency',refund_row.currency);
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  old_row jsonb;
  new_row jsonb;
  row_id text;
  jwt_claims jsonb;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_id := coalesce(new_row ->> 'id', old_row ->> 'id', new_row ->> 'user_id', old_row ->> 'user_id');
  jwt_claims := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);

  insert into private.audit_log(
    table_schema,
    table_name,
    record_id,
    action,
    actor_user_id,
    actor_role,
    old_data,
    new_data,
    request_id
  ) values (
    tg_table_schema,
    tg_table_name,
    row_id,
    tg_op,
    auth.uid(),
    coalesce(jwt_claims ->> 'role', current_user),
    old_row,
    new_row,
    coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb) ->> 'x-request-id'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION private.cancel_my_stock_alert_v1(p_variant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); affected integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update private.stock_alert_subscriptions set status='cancelled' where user_id=caller_id and variant_id=p_variant_id and status='active';
  get diagnostics affected=row_count;
  return affected>0;
end;
$function$;

CREATE OR REPLACE FUNCTION private.claim_push_deliveries_v1(p_limit integer, p_worker_id text)
 RETURNS TABLE(delivery_id bigint, provider text, platform text, environment text, push_token text, title text, body text, action_url text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_limit not between 1 and 500 or char_length(btrim(coalesce(p_worker_id,''))) not between 2 and 120 then raise exception 'invalid_push_worker_request' using errcode='22023'; end if;
  return query
  with claimed as (
    select delivery.id from private.push_deliveries delivery
    join private.device_push_tokens token on token.id=delivery.device_token_id and token.disabled_at is null
    where delivery.status='pending' and delivery.available_at<=timezone('utc',now()) and delivery.attempts<5
    order by delivery.id for update of delivery skip locked limit p_limit
  ), updated as (
    update private.push_deliveries delivery
    set status='processing',attempts=attempts+1,locked_at=timezone('utc',now()),locked_by=btrim(p_worker_id),updated_at=timezone('utc',now())
    from claimed where delivery.id=claimed.id returning delivery.*
  )
  select updated.id,token.provider,token.platform,token.environment,
         extensions.pgp_sym_decrypt(token.token_ciphertext,private.get_push_token_key_v1())::text,
         notification.title,notification.message,notification.action_url,notification.metadata
  from updated
  join private.device_push_tokens token on token.id=updated.device_token_id
  join public.notifications notification on notification.id=updated.notification_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.complete_commerce_payment_for_service_v3(p_intent_id uuid, p_provider_reference text, p_payment_method_type text, p_status text, p_provider_payload jsonb DEFAULT '{}'::jsonb, p_failure_code text DEFAULT NULL::text, p_failure_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare intent private.payment_intents%rowtype;
begin select * into intent from private.payment_intents where id=p_intent_id; if intent.id is null then raise exception 'payment_intent_not_found' using errcode='P0002'; end if; if intent.subject_type='order' then return private.complete_order_payment_for_service_v2(p_intent_id,p_provider_reference,p_payment_method_type,p_status,p_provider_payload,p_failure_code,p_failure_message); elsif intent.subject_type='event_reservation' then if lower(btrim(coalesce(p_status,''))) in ('failed','cancelled') then return private.fail_event_reservation_payment_for_service_v1(p_intent_id,coalesce(p_failure_code,'provider_rejected'),p_failure_message,p_provider_payload); end if; return private.complete_event_reservation_payment_for_service_v1(p_intent_id,p_provider_reference,p_payment_method_type,p_status,p_provider_payload); end if; raise exception 'unsupported_payment_subject_type' using errcode='55000'; end;$function$;

CREATE OR REPLACE FUNCTION private.complete_push_delivery_v1(p_delivery_id bigint, p_success boolean, p_error text DEFAULT NULL::text, p_disable_token boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare delivery_row private.push_deliveries%rowtype;
begin
  select * into delivery_row from private.push_deliveries where id=p_delivery_id for update;
  if delivery_row.id is null then raise exception 'push_delivery_not_found' using errcode='P0002'; end if;
  if delivery_row.status not in ('processing','pending') then return true; end if;
  if coalesce(p_success,false) then
    update private.push_deliveries set status='sent',sent_at=timezone('utc',now()),locked_at=null,locked_by=null,last_error=null,updated_at=timezone('utc',now()) where id=delivery_row.id;
  else
    if coalesce(p_disable_token,false) then update private.device_push_tokens set disabled_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=delivery_row.device_token_id; end if;
    update private.push_deliveries set status=case when attempts>=5 or coalesce(p_disable_token,false) then 'failed' else 'pending' end,
      available_at=case when attempts>=5 or coalesce(p_disable_token,false) then available_at else timezone('utc',now())+(interval '1 minute'*least(60,power(2,greatest(0,attempts-1))::integer)) end,
      locked_at=null,locked_by=null,last_error=left(coalesce(p_error,'push_delivery_failed'),2000),updated_at=timezone('utc',now()) where id=delivery_row.id;
  end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.consume_order_promotion_v1(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update private.promotion_redemptions redemption
  set status='consumed',
      consumed_at=coalesce(consumed_at,timezone('utc',now())),
      expires_at=null,
      updated_at=timezone('utc',now())
  where redemption.order_id=p_order_id
    and redemption.status='reserved';
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_customer_order_guarded_v1(p_items jsonb, p_shipping_address jsonb, p_customer_note text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  country_code text;
  item jsonb;
  product_reference text;
  target_product public.products%rowtype;
  target_variant public.product_variants%rowtype;
  quantity_value integer;
  active_variant_count integer;
  subtotal_value bigint := 0;
  weight_value integer := 0;
  quote jsonb;
  result jsonb;
  brand_shipping bigint := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address)<>'object' then raise exception 'invalid_shipping_address' using errcode='22023'; end if;

  country_code := upper(coalesce(nullif(btrim(coalesce(p_shipping_address->>'country_code',p_shipping_address->>'countryCode','')),''),'TR'));
  if country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_shipping_country' using errcode='22023'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid_cart_items' using errcode='22023'; end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    product_reference := btrim(coalesce(item->>'productReference',item->>'productId',item->>'id',''));
    if coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'invalid_cart_item' using errcode='22023'; end if;
    quantity_value := (item->>'quantity')::integer;
    if quantity_value not between 1 and 99 then raise exception 'invalid_cart_quantity' using errcode='22023'; end if;

    select product.* into target_product
    from public.products product
    join public.producers producer on producer.id=product.producer_id
    where (product.id::text=product_reference or product.legacy_id=product_reference or product.slug=product_reference)
      and product.status='published' and product.is_active=true and product.deleted_at is null
      and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
    limit 1;
    if target_product.id is null then raise exception 'product_not_available' using errcode='22023'; end if;

    select count(*)::integer into active_variant_count
    from public.product_variants variant where variant.product_id=target_product.id and variant.is_active=true;
    if active_variant_count <> 1 then
      raise exception 'explicit_variant_checkout_required:%',target_product.id using errcode='55000';
    end if;

    select variant.* into target_variant
    from public.product_variants variant
    where variant.product_id=target_product.id and variant.is_active=true
    order by variant.is_default desc,variant.created_at asc limit 1;

    subtotal_value := subtotal_value + (target_variant.price_minor * quantity_value);
    weight_value := weight_value + (coalesce(target_variant.weight_grams,1000) * quantity_value);
  end loop;

  quote := public.get_shipping_quote_v1(country_code,greatest(weight_value,1),subtotal_value,'TRY');
  if not coalesce((quote->>'available')::boolean,false) then
    if coalesce((quote->>'manualQuoteRequired')::boolean,false) then
      raise exception 'manual_shipping_quote_required:%',country_code using errcode='55000';
    end if;
    raise exception 'shipping_not_available:%',coalesce(quote->>'reason','unknown') using errcode='55000';
  end if;

  select coalesce((settings.public_config#>>'{checkout,shippingMinor}')::bigint,0)
  into brand_shipping
  from public.brand_settings settings
  where settings.slug='golden-oremar';

  if (quote->>'shippingMinor')::bigint <> brand_shipping then
    raise exception 'shipping_rate_sync_required' using errcode='55000';
  end if;

  result := private.create_customer_order(p_items,p_shipping_address,p_customer_note,p_idempotency_key);
  return result || jsonb_build_object(
    'shippingZoneCode',quote->>'zoneCode',
    'shippingCountryCode',country_code,
    'shippingWeightGrams',weight_value
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.dispatch_stock_alerts_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old_sellable integer:=greatest(0,old.available_quantity-old.reserved_quantity); new_sellable integer:=greatest(0,new.available_quantity-new.reserved_quantity); subscription record; product_row record; token_raw text;
begin
  if old_sellable>0 or new_sellable<=0 then return new; end if;
  select product.id product_id,product.name product_name,product.slug,variant.name variant_name into product_row
  from public.product_variants variant join public.products product on product.id=variant.product_id
  where variant.id=new.variant_id;
  if product_row.product_id is null then return new; end if;

  for subscription in select * from private.stock_alert_subscriptions where variant_id=new.variant_id and status='active' for update
  loop
    if subscription.user_id is not null and exists(select 1 from public.profiles where id=subscription.user_id and status='active' and deleted_at is null) then
      insert into public.notifications(user_id,type,title,message,action_url,metadata)
      values(subscription.user_id,'system','Stok geldi',product_row.product_name||' yeniden stokta.','/product/'||product_row.slug,jsonb_build_object('productId',product_row.product_id,'variantId',new.variant_id,'sellableQuantity',new_sellable));
    end if;
    if subscription.email_normalized is not null then
      token_raw:=encode(extensions.gen_random_bytes(24),'hex');
      update private.stock_alert_subscriptions set unsubscribe_token_hash=private.hash_marketing_token_v1(token_raw) where id=subscription.id;
      insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
      values('stock_alert',subscription.id,'stock_alert.available_email',jsonb_build_object('subscription_id',subscription.id,'email',subscription.email_normalized,'locale',subscription.locale,'unsubscribeToken',token_raw,'productId',product_row.product_id,'productName',product_row.product_name,'variantId',new.variant_id,'variantName',product_row.variant_name,'slug',product_row.slug));
    end if;
    update private.stock_alert_subscriptions set status='notified',notified_at=timezone('utc',now()) where id=subscription.id;
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_content_claim_policy()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  published_text text;
  claim_evidence jsonb;
  claim_reviewed boolean;
begin
  if new.status <> 'published' or new.content_type not in ('health_guide', 'product_health') then
    return new;
  end if;

  published_text := lower(concat_ws(' ', new.title, new.summary, new.body_markdown, new.body_html_sanitized));
  claim_evidence := coalesce(new.metadata -> 'claimEvidenceIds', '[]'::jsonb);
  claim_reviewed := coalesce(new.metadata ->> 'claimReviewStatus', '') = 'verified'
    and jsonb_typeof(claim_evidence) = 'array'
    and jsonb_array_length(claim_evidence) > 0;

  if published_text ~ '(şifa (deposu|kaynağı|iksiri|harikası)|doğal antibiyotik|bağışıklık.{0,40}(güçlendirir|destekler|artırır|korur)|(hastalık|kanser|diyabet|astım|bronşit|kolesterol|tansiyon|damar|romatizma|ağrı|yara|aft).{0,45}(önler|tedavi eder|iyileştirir|korur|hafifletir|giderir|düşürür|dengeler|açar|temizler))'
    and not claim_reviewed then
    raise exception using
      errcode = 'check_violation',
      message = 'İçerik sağlık beyanı, doğrulanmış inceleme ve kanıt kaydı olmadan yayımlanamaz.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_product_claim_policy()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  published_text text;
  claim_evidence jsonb;
  verification_evidence jsonb;
  claim_reviewed boolean;
  product_verified boolean;
begin
  if new.status <> 'published' then
    return new;
  end if;

  published_text := lower(concat_ws(
    ' ',
    new.name,
    new.short_description,
    new.description,
    new.story,
    array_to_string(new.tags, ' '),
    new.features::text
  ));

  claim_evidence := coalesce(new.specifications -> 'claimEvidenceIds', '[]'::jsonb);
  verification_evidence := coalesce(new.specifications -> 'verificationDocumentIds', '[]'::jsonb);
  claim_reviewed := coalesce(new.specifications ->> 'claimReviewStatus', '') = 'verified'
    and jsonb_typeof(claim_evidence) = 'array'
    and jsonb_array_length(claim_evidence) > 0;
  product_verified := coalesce(new.specifications ->> 'verificationStatus', '') = 'verified'
    and jsonb_typeof(verification_evidence) = 'array'
    and jsonb_array_length(verification_evidence) > 0;

  if published_text ~ '(şifa (deposu|kaynağı|iksiri|harikası)|doğal antibiyotik|bağışıklık.{0,40}(güçlendirir|destekler|artırır|korur)|(hastalık|kanser|diyabet|astım|bronşit|kolesterol|tansiyon|damar|romatizma|ağrı|yara|aft).{0,45}(önler|tedavi eder|iyileştirir|korur|hafifletir|giderir|düşürür|dengeler|açar|temizler))'
    and not claim_reviewed then
    raise exception using
      errcode = 'check_violation',
      message = 'Sağlık beyanı, doğrulanmış inceleme ve kanıt kaydı olmadan yayımlanamaz.';
  end if;

  if published_text ~ '(%100[[:space:]]+saf|laboratuvar onaylı|akredite laboratuvar.{0,30}mevcut|tamamen ilaçsız|sıfır müdahale)'
    and not product_verified then
    raise exception using
      errcode = 'check_violation',
      message = 'Kalite veya sertifika beyanı, doğrulanmış üretici belgesi olmadan yayımlanamaz.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enqueue_admin_domain_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_table_name = 'campaigns' then
    insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
    values (
      'campaign',
      new.id,
      case when tg_op = 'INSERT' then 'campaign.created' else 'campaign.updated' end,
      jsonb_build_object('campaign_id', new.id, 'status', new.status, 'target_scope', new.target_scope)
    );
  elsif tg_table_name = 'reviews' then
    insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
    values (
      'review',
      new.id,
      'review.moderated',
      jsonb_build_object('review_id', new.id, 'status', new.status)
    );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.evaluate_campaign_for_order_v1(p_order_id uuid, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_order public.orders%rowtype;
  campaign public.campaigns%rowtype;
  eligible_subtotal bigint:=0;
  product_discount bigint:=0;
  shipping_discount bigint:=0;
  total_discount bigint:=0;
begin
  select * into target_order from public.orders where id=p_order_id;
  if target_order.id is null then return jsonb_build_object('eligible',false,'reason','order_not_found'); end if;
  select * into campaign from public.campaigns where id=p_campaign_id;
  if campaign.id is null then return jsonb_build_object('eligible',false,'reason','campaign_not_found'); end if;
  if campaign.status<>'active' or timezone('utc',now())<campaign.starts_at or timezone('utc',now())>campaign.ends_at then
    return jsonb_build_object('eligible',false,'reason','campaign_inactive');
  end if;
  if target_order.subtotal_minor<campaign.minimum_order_minor then
    return jsonb_build_object('eligible',false,'reason','minimum_order_not_met');
  end if;
  if campaign.discount_type='fixed' and campaign.currency is distinct from target_order.currency then
    return jsonb_build_object('eligible',false,'reason','campaign_currency_mismatch');
  end if;

  if campaign.target_scope='all' then
    eligible_subtotal:=target_order.subtotal_minor;
  elsif campaign.target_scope='products' then
    select coalesce(sum(item.unit_price_minor*item.quantity),0)::bigint into eligible_subtotal
    from public.order_items item
    where item.order_id=target_order.id
      and exists(select 1 from public.campaign_products link where link.campaign_id=campaign.id and link.product_id=item.product_id);
  else
    select coalesce(sum(item.unit_price_minor*item.quantity),0)::bigint into eligible_subtotal
    from public.order_items item
    join public.products product on product.id=item.product_id
    where item.order_id=target_order.id
      and exists(select 1 from public.campaign_categories link where link.campaign_id=campaign.id and link.category_id=product.category_id);
  end if;

  if eligible_subtotal<=0 and campaign.discount_type<>'free_shipping' then
    return jsonb_build_object('eligible',false,'reason','no_eligible_items');
  end if;

  if campaign.discount_type='percentage' then
    product_discount:=floor((eligible_subtotal::numeric*campaign.discount_value::numeric)/10000)::bigint;
    if campaign.max_discount_minor is not null then product_discount:=least(product_discount,campaign.max_discount_minor); end if;
    product_discount:=least(product_discount,eligible_subtotal);
  elsif campaign.discount_type='fixed' then
    product_discount:=least(campaign.discount_value::bigint,eligible_subtotal);
  else
    shipping_discount:=target_order.shipping_minor;
  end if;

  total_discount:=product_discount+shipping_discount;
  if total_discount<=0 then return jsonb_build_object('eligible',false,'reason','zero_discount'); end if;
  if target_order.subtotal_minor-target_order.discount_minor+target_order.shipping_minor-total_discount<=0 then
    return jsonb_build_object('eligible',false,'reason','zero_total_checkout_not_supported');
  end if;

  return jsonb_build_object(
    'eligible',true,
    'campaignId',campaign.id,
    'title',campaign.title,
    'activationMode',campaign.activation_mode,
    'targetScope',campaign.target_scope,
    'discountType',campaign.discount_type,
    'discountValue',campaign.discount_value,
    'eligibleSubtotalMinor',eligible_subtotal,
    'productDiscountMinor',product_discount,
    'shippingDiscountMinor',shipping_discount,
    'totalDiscountMinor',total_discount,
    'priority',campaign.priority
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.expire_event_payment_holds_v1(p_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare expired_count integer:=0;
begin
  with expired as (
    select f.reservation_id
    from private.event_reservation_finance f
    join public.event_reservations r on r.id=f.reservation_id
    where f.event_id=p_event_id and f.payment_status='pending' and f.payment_expires_at<=timezone('utc',now()) and r.status='pending_payment'
    for update of f,r
  ), finance_update as (
    update private.event_reservation_finance f set payment_status='expired',updated_at=timezone('utc',now()) where f.reservation_id in (select reservation_id from expired) returning f.reservation_id
  )
  update public.event_reservations r set status='cancelled',updated_at=timezone('utc',now()) where r.id in (select reservation_id from expired);
  get diagnostics expired_count=row_count;
  return expired_count;
end;$function$;

CREATE OR REPLACE FUNCTION private.fail_event_reservation_payment_for_service_v1(p_intent_id uuid, p_failure_code text, p_failure_message text, p_provider_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare intent private.payment_intents%rowtype; f private.event_reservation_finance%rowtype; r public.event_reservations%rowtype; safe_code text:=nullif(btrim(coalesce(p_failure_code,'')),''); safe_message text:=nullif(btrim(coalesce(p_failure_message,'')),''); payload jsonb:=coalesce(p_provider_payload,'{}'::jsonb);
begin
 select * into intent from private.payment_intents where id=p_intent_id for update; if intent.id is null or intent.subject_type<>'event_reservation' then raise exception 'payment_intent_not_found' using errcode='P0002'; end if;
 if intent.status='captured' then raise exception 'captured_payment_cannot_fail' using errcode='55000'; end if;
 if intent.status='failed' then return jsonb_build_object('ok',true,'intentId',intent.id,'status','failed','subjectType','event_reservation','reservationId',intent.subject_id,'unchanged',true); end if;
 if intent.status not in ('created','processing','authorized') then raise exception 'invalid_intent_transition' using errcode='22023'; end if;
 select * into f from private.event_reservation_finance where reservation_id=intent.subject_id for update; select * into r from public.event_reservations where id=intent.subject_id for update;
 if f.reservation_id is null or r.id is null then raise exception 'event_payment_context_not_found' using errcode='P0002'; end if;
 update private.payment_intents set status='failed',failure_code=safe_code,failure_message=safe_message,provider_result=provider_result||payload,completed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=intent.id;
 if f.payment_status not in ('paid','refunded','refund_required') then update private.event_reservation_finance set payment_status='failed',updated_at=timezone('utc',now()) where reservation_id=r.id; if r.status='pending_payment' then update public.event_reservations set status='cancelled',updated_at=timezone('utc',now()) where id=r.id; end if; end if;
 insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('event_reservation',r.id,'event.payment_failed',jsonb_build_object('reservation_id',r.id,'event_id',r.event_id,'failure_code',safe_code));
 return jsonb_build_object('ok',true,'intentId',intent.id,'status','failed','subjectType','event_reservation','reservationId',r.id);
end;$function$;

CREATE OR REPLACE FUNCTION private.generate_batch_code_v1()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  candidate text;
begin
  loop
    candidate := 'GO-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.product_batches batch where batch.batch_code = candidate);
  end loop;
  return candidate;
end;
$function$;

CREATE OR REPLACE FUNCTION private.generate_trace_code_v1()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  candidate text;
begin
  loop
    candidate := 'GO-TRC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14));
    exit when not exists (select 1 from public.product_batches batch where batch.trace_code = candidate);
  end loop;
  return candidate;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_account_closure_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); request_row private.account_closure_requests%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into request_row from private.account_closure_requests where user_id=caller_id order by requested_at desc limit 1;
  if request_row.id is null then return jsonb_build_object('status','none'); end if;
  return jsonb_build_object('id',request_row.id,'status',request_row.status,'reason',request_row.reason,'requestedAt',request_row.requested_at,'updatedAt',request_row.updated_at);
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_producer_location_change_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  producer_id_value uuid;
  request public.producer_location_change_requests%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select producer.id into producer_id_value from public.producers producer where producer.owner_user_id=caller_id and producer.deleted_at is null order by producer.created_at desc limit 1;
  if producer_id_value is null then raise exception 'producer_profile_not_found' using errcode='P0002'; end if;
  select r.* into request from public.producer_location_change_requests r where r.producer_id=producer_id_value order by r.created_at desc limit 1;
  if request.id is null then return null; end if;
  return jsonb_build_object(
    'id',request.id,'status',request.status,'countryCode',request.country_code,'province',request.province,
    'district',request.district,'village',request.village,'villageIsCustom',request.village_is_custom,
    'reason',request.reason,'reviewReason',request.review_reason,'createdAt',request.created_at,'reviewedAt',request.reviewed_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.hash_marketing_token_v1(p_token text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pepper text; token_value text:=btrim(coalesce(p_token,''));
begin
  if char_length(token_value) not between 20 and 200 then raise exception 'invalid_marketing_token' using errcode='22023'; end if;
  select operational_config->>'marketingTokenPepper' into pepper from private.brand_secrets where brand_slug='golden-oremar';
  if char_length(coalesce(pepper,''))<32 then raise exception 'marketing_token_secret_missing' using errcode='55000'; end if;
  return encode(extensions.hmac(convert_to(token_value,'UTF8'),convert_to(pepper,'UTF8'),'sha256'),'hex');
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_customer_returns_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', request.id,
        'returnNumber', request.return_number,
        'orderId', request.order_id,
        'status', request.status,
        'reason', request.customer_message,
        'resolution', request.resolution,
        'requestedAt', request.requested_at,
        'reviewedAt', request.reviewed_at
      )
      order by request.created_at desc
    )
    from public.return_requests request
    where request.user_id = caller_id
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_my_conversations_v1(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select coalesce(jsonb_agg(item order by sort_time desc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',conversation.id,'type',conversation.conversation_type,'orderId',conversation.order_id,'producerId',conversation.producer_id,'productId',conversation.product_id,
      'subject',conversation.subject,'status',conversation.status,'updatedAt',conversation.updated_at,'lastMessageAt',conversation.last_message_at,
      'title',case when conversation.conversation_type='support' then 'Golden Oremar Destek' else coalesce(producer.display_name,'Üretici') end,
      'lastMessage',coalesce((select case when m.deleted_at is null then left(m.body,180) else 'Mesaj kaldırıldı' end from public.messages m where m.conversation_id=conversation.id order by m.created_at desc limit 1),''),
      'unreadCount',(select count(*) from public.messages m where m.conversation_id=conversation.id and m.sender_user_id<>caller_id and m.created_at>coalesce(participant.last_read_at,'epoch'::timestamptz))
    ) item,coalesce(conversation.last_message_at,conversation.updated_at) sort_time
    from public.conversation_participants participant
    join public.conversations conversation on conversation.id=participant.conversation_id
    left join public.producers producer on producer.id=conversation.producer_id
    where participant.user_id=caller_id
    order by coalesce(conversation.last_message_at,conversation.updated_at) desc
    limit p_limit offset p_offset
  ) rows;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.message_contains_disallowed_contact_v1(p_body text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  value text:=lower(btrim(coalesce(p_body,'')));
begin
  if value='' then return false; end if;

  if value ~* '(^|[^[:alnum:]_.+-])[[:alnum:]_.+-]+@[[:alnum:]-]+(\.[[:alnum:]-]+)+([^[:alnum:]_.+-]|$)' then
    return true;
  end if;

  if value ~* '(^|[^[:alnum:]])(mailto:|tel:)' then
    return true;
  end if;

  if value ~* '(^|[^0-9])\+?[0-9]([ .()/-]*[0-9]){9,14}([^0-9]|$)' then
    return true;
  end if;

  if value ~* '(^|[^[:alnum:]])(whatsapp|wa\.me|telegram|t\.me)[[:space:]:=@/+_-]*[[:alnum:]@+_.-]{3,}' then
    return true;
  end if;

  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION private.normalize_coupon_code_v1(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  normalized text := upper(regexp_replace(btrim(coalesce(p_code,'')), '\s+', '', 'g'));
begin
  if char_length(normalized) not between 4 and 40
    or normalized !~ '^[A-Z0-9_-]+$' then
    raise exception 'invalid_coupon_code' using errcode='22023';
  end if;
  return normalized;
end;
$function$;

CREATE OR REPLACE FUNCTION private.prepare_event_reservation_hosted_payment_for_service_v1(p_user_id uuid, p_reservation_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 r public.event_reservations%rowtype; f private.event_reservation_finance%rowtype; e public.events%rowtype; pa private.producer_payment_accounts%rowtype; a public.addresses%rowtype; p public.profiles%rowtype; u auth.users%rowtype; cfg jsonb; intent private.payment_intents%rowtype; intent_id uuid; action_value text; sub_key text:=null;
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_user_id is null or p_reservation_id is null then raise exception 'payment_context_required' using errcode='22023'; end if;
 if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 120 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid_payment_idempotency_key' using errcode='22023'; end if;
 select private.default_payment_control_v1()||coalesce(bs.public_config->'payments','{}'::jsonb) into cfg from public.brand_settings bs where bs.slug='golden-oremar' limit 1;
 if cfg is null or cfg->>'provider'<>'iyzico' or not coalesce((cfg->>'checkout_form_enabled')::boolean,false) then raise exception 'hosted_checkout_not_configured' using errcode='55000'; end if;
 select * into r from public.event_reservations where id=p_reservation_id and user_id=p_user_id for update;
 if r.id is null then raise exception 'event_reservation_not_found' using errcode='P0002'; end if;
 select * into f from private.event_reservation_finance where reservation_id=r.id for update;
 if f.reservation_id is null or f.user_id<>p_user_id or f.total_minor<=0 then raise exception 'event_reservation_payment_not_required' using errcode='55000'; end if;
 if f.payment_status='paid' then return jsonb_build_object('action','terminal','status','captured','intentId',(select i.id from private.payment_intents i where i.subject_type='event_reservation' and i.subject_id=r.id and i.status='captured' order by i.created_at desc limit 1),'reservationId',r.id,'reservationCode',r.reservation_code,'paymentStatus','paid'); end if;
 if r.status<>'pending_payment' or f.payment_status not in ('pending','authorized') then raise exception 'event_reservation_not_payable' using errcode='55000'; end if;
 if f.payment_status='pending' and (f.payment_expires_at is null or f.payment_expires_at<=timezone('utc',now())) then raise exception 'payment_reservation_expired' using errcode='55000'; end if;
 select * into e from public.events where id=r.event_id for update;
 if e.id is null or e.status not in ('published','sold_out') or e.starts_at<=timezone('utc',now()) then raise exception 'event_not_available' using errcode='55000'; end if;
 if f.producer_id is not null then select * into pa from private.producer_payment_accounts where producer_id=f.producer_id and provider='iyzico' and status='ready' and submerchant_key is not null; if pa.producer_id is null then raise exception 'producer_payment_account_not_ready' using errcode='55000'; end if; sub_key:=pa.submerchant_key; end if;
 select * into a from public.addresses where user_id=p_user_id and deleted_at is null order by is_default desc,updated_at desc limit 1;
 if a.id is null then raise exception 'payment_billing_address_required' using errcode='55000'; end if;
 if nullif(btrim(coalesce(a.postal_code,'')),'') is null then raise exception 'payment_postal_code_required' using errcode='55000'; end if;
 select * into p from public.profiles where id=p_user_id; select * into u from auth.users where id=p_user_id;
 if p.id is null or u.id is null or u.email is null then raise exception 'payment_buyer_profile_incomplete' using errcode='55000'; end if;
 select * into intent from private.payment_intents where user_id=p_user_id and idempotency_key=p_idempotency_key for update;
 if intent.id is not null then
   if intent.subject_type<>'event_reservation' or intent.subject_id<>r.id or intent.order_id is not null or intent.payment_method_id is not null or intent.payment_flow<>'checkout_form' or intent.amount_minor<>f.total_minor or intent.currency<>f.currency or intent.provider<>'iyzico' then raise exception 'payment_idempotency_key_reused' using errcode='23505'; end if;
   intent_id:=intent.id;
   if intent.status='created' then update private.payment_intents set status='processing',attempt_count=attempt_count+1,updated_at=timezone('utc',now()) where id=intent.id; action_value:='initialize';
   elsif intent.status in ('processing','authorized') then action_value:='reconcile'; else action_value:='terminal'; end if;
 else
   insert into private.payment_intents(user_id,subject_type,subject_id,order_id,payment_method_id,payment_flow,provider,idempotency_key,amount_minor,currency,status,attempt_count)
   values(p_user_id,'event_reservation',r.id,null,null,'checkout_form','iyzico',p_idempotency_key,f.total_minor,f.currency,'processing',1) returning id into intent_id;
   action_value:='initialize';
 end if;
 return jsonb_build_object('action',action_value,'intentId',intent_id,'intentStatus',coalesce(intent.status,'processing'),'subjectType','event_reservation','subjectId',r.id,'reservationId',r.id,'reservationCode',r.reservation_code,'eventId',e.id,'eventTitle',e.title,'amountMinor',f.total_minor,'priceMinor',f.total_minor,'currency',f.currency,'paymentExpiresAt',f.payment_expires_at,'buyer',jsonb_build_object('id',p_user_id,'displayName',coalesce(nullif(btrim(r.guest_name),''),p.display_name),'phone',r.guest_phone,'email',u.email,'createdAt',u.created_at),'billingAddress',jsonb_build_object('recipient_name',a.recipient_name,'phone',a.phone,'country_code',a.country_code,'province',a.province,'district',a.district,'neighborhood',a.neighborhood,'address_line',a.address_line,'postal_code',a.postal_code),'items',jsonb_build_array(jsonb_build_object('id',r.id,'name',e.title,'quantity',r.guest_count,'lineTotalMinor',f.total_minor,'producerId',f.producer_id,'subMerchantKey',sub_key,'subMerchantPriceMinor',f.producer_net_minor)),'splitTotalMinor',f.producer_net_minor,'providerReference',intent.provider_reference);
end;$function$;

CREATE OR REPLACE FUNCTION private.producer_kyc_key()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  encryption_key text;
begin
  select secret.decrypted_secret
  into encryption_key
  from vault.decrypted_secrets secret
  where secret.name = 'golden_oremar_producer_kyc_key'
  limit 1;

  if encryption_key is null then
    raise exception 'producer_kyc_key_missing' using errcode = '55000';
  end if;

  return encryption_key;
end;
$function$;

CREATE OR REPLACE FUNCTION private.queue_notification_push_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.should_queue_push_v1(new.user_id,new.type) then
    insert into private.push_deliveries(notification_id,user_id,device_token_id)
    select new.id,new.user_id,token.id from private.device_push_tokens token
    where token.user_id=new.user_id and token.disabled_at is null
    on conflict(notification_id,device_token_id) do nothing;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.record_refund_producer_reversal_v1(p_refund_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  refund_row public.refunds%rowtype;
  candidate record;
  candidate_total bigint:=0;
  target_total bigint:=0;
  allocated_total bigint:=0;
  gross_reversal bigint;
  fee_reversal bigint;
  merchandise_reversal bigint;
  tax_reversal bigint;
  net_reversal bigint;
  is_last boolean;
  candidate_count integer:=0;
  candidate_index integer:=0;
begin
  select * into refund_row from public.refunds where id=p_refund_id;
  if refund_row.id is null or refund_row.status<>'succeeded' or refund_row.return_id is null then return; end if;
  if exists(select 1 from private.producer_ledger_entries e where e.refund_id=refund_row.id and e.entry_type='refund') then return; end if;

  select coalesce(sum(round((sale.producer_gross_minor::numeric*ri.quantity::numeric)/oi.quantity::numeric)),0)::bigint,
         count(*)::integer
  into candidate_total,candidate_count
  from public.return_items ri
  join public.order_items oi on oi.id=ri.order_item_id
  join private.producer_ledger_entries sale on sale.order_item_id=oi.id and sale.entry_type='sale'
  where ri.return_id=refund_row.return_id;

  if candidate_total<=0 or candidate_count=0 then return; end if;
  target_total:=least(refund_row.amount_minor,candidate_total);

  for candidate in
    select ri.quantity as return_quantity,oi.quantity as purchased_quantity,
           sale.id as sale_entry_id,sale.producer_id,sale.order_id,sale.order_item_id,
           sale.currency,sale.merchandise_minor,sale.tax_minor,sale.producer_gross_minor,
           sale.platform_fee_minor,sale.producer_net_minor,sale.commission_basis_points
    from public.return_items ri
    join public.order_items oi on oi.id=ri.order_item_id
    join private.producer_ledger_entries sale on sale.order_item_id=oi.id and sale.entry_type='sale'
    where ri.return_id=refund_row.return_id
    order by sale.id
  loop
    candidate_index:=candidate_index+1;
    is_last:=candidate_index=candidate_count;
    if is_last then
      gross_reversal:=target_total-allocated_total;
    else
      gross_reversal:=floor(
        target_total::numeric*
        round((candidate.producer_gross_minor::numeric*candidate.return_quantity::numeric)/candidate.purchased_quantity::numeric)
        /candidate_total::numeric
      )::bigint;
      allocated_total:=allocated_total+gross_reversal;
    end if;

    if gross_reversal<=0 then continue; end if;

    merchandise_reversal:=least(
      gross_reversal,
      round((candidate.merchandise_minor::numeric*candidate.return_quantity::numeric)/candidate.purchased_quantity::numeric)::bigint
    );
    tax_reversal:=gross_reversal-merchandise_reversal;
    fee_reversal:=case when candidate.merchandise_minor=0 then 0 else
      round((merchandise_reversal::numeric*candidate.platform_fee_minor::numeric)/candidate.merchandise_minor::numeric)::bigint end;
    net_reversal:=gross_reversal-fee_reversal;

    insert into private.producer_ledger_entries(
      producer_id,order_id,order_item_id,return_id,refund_id,entry_type,currency,
      merchandise_minor,tax_minor,producer_gross_minor,platform_fee_minor,producer_net_minor,
      commission_basis_points,availability_status,available_at,source_key,metadata
    ) values (
      candidate.producer_id,candidate.order_id,candidate.order_item_id,refund_row.return_id,refund_row.id,'refund',candidate.currency,
      -merchandise_reversal,-tax_reversal,-gross_reversal,-fee_reversal,-net_reversal,
      candidate.commission_basis_points,'available',timezone('utc',now()),
      'refund:'||refund_row.id::text||':'||candidate.order_item_id::text,
      jsonb_build_object('refund_amount_minor',refund_row.amount_minor,'return_quantity',candidate.return_quantity,'purchased_quantity',candidate.purchased_quantity)
    ) on conflict (source_key) do nothing;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_product_search_text_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.search_text:=lower(concat_ws(' ',new.name,new.short_description,new.description,new.story,new.origin,array_to_string(new.tags,' '),new.translations::text));
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.release_expired_order_reservations(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_order record;
  released_count integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'invalid_release_limit' using errcode = '22023';
  end if;

  for target_order in
    select customer_order.id, customer_order.status
    from public.orders customer_order
    where customer_order.status = 'pending_payment'
      and customer_order.payment_status = 'unpaid'
      and customer_order.reservation_expires_at <= timezone('utc', now())
    order by customer_order.reservation_expires_at, customer_order.id
    for update skip locked
    limit p_limit
  loop
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
      visible_to_customer
    ) values (
      target_order.id,
      target_order.status,
      'cancelled',
      'Ödeme süresi dolduğu için stok rezervasyonu otomatik bırakıldı.',
      true
    );

    insert into private.outbox_events(
      aggregate_type,
      aggregate_id,
      event_type,
      payload
    ) values (
      'order',
      target_order.id,
      'order.reservation_expired',
      jsonb_build_object('order_id', target_order.id)
    );

    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$function$;

CREATE OR REPLACE FUNCTION private.release_order_promotion_v1(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update private.promotion_redemptions redemption
  set status='released',
      released_at=coalesce(released_at,timezone('utc',now())),
      updated_at=timezone('utc',now())
  where redemption.order_id=p_order_id
    and redemption.status='reserved';
end;
$function$;

CREATE OR REPLACE FUNCTION private.reserve_order_promotion_v1(p_order_id uuid, p_coupon_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  target_order public.orders%rowtype;
  existing public.order_promotions%rowtype;
  promotion jsonb;
  campaign_row public.campaigns%rowtype;
  coupon_row public.coupons%rowtype;
  campaign_id uuid;
  coupon_id uuid;
  product_discount bigint;
  shipping_discount bigint;
  total_discount bigint;
  campaign_usage bigint;
  campaign_user_usage bigint;
  coupon_usage bigint;
  coupon_user_usage bigint;
  eligible_total bigint;
  allocated_total bigint;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target_order from public.orders where id=p_order_id and user_id=caller_id for update;
  if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if target_order.status<>'pending_payment' or target_order.payment_status not in ('unpaid','authorized') then raise exception 'order_not_promotion_eligible' using errcode='55000'; end if;

  select * into existing from public.order_promotions where order_id=target_order.id;
  if existing.id is not null then
    return jsonb_build_object('applied',true,'campaignId',existing.campaign_id,'couponId',existing.coupon_id,'productDiscountMinor',existing.product_discount_minor,'shippingDiscountMinor',existing.shipping_discount_minor,'totalDiscountMinor',existing.total_discount_minor,'orderTotalMinor',target_order.total_minor,'unchanged',true);
  end if;

  update private.promotion_redemptions
  set status='released',released_at=coalesce(released_at,timezone('utc',now())),updated_at=timezone('utc',now())
  where status='reserved' and expires_at is not null and expires_at<=timezone('utc',now());

  promotion:=private.resolve_order_promotion_v1(target_order.id,p_coupon_code);
  if not coalesce((promotion->>'eligible')::boolean,false) then
    return jsonb_build_object('applied',false,'totalDiscountMinor',0,'orderTotalMinor',target_order.total_minor);
  end if;

  campaign_id:=(promotion->>'campaignId')::uuid;
  coupon_id:=nullif(promotion->>'couponId','')::uuid;
  product_discount:=(promotion->>'productDiscountMinor')::bigint;
  shipping_discount:=(promotion->>'shippingDiscountMinor')::bigint;
  total_discount:=product_discount+shipping_discount;

  select * into campaign_row from public.campaigns where id=campaign_id for update;
  promotion:=private.evaluate_campaign_for_order_v1(target_order.id,campaign_id)||case when coupon_id is null then '{}'::jsonb else jsonb_build_object('couponId',coupon_id) end;
  if not coalesce((promotion->>'eligible')::boolean,false) then raise exception 'promotion_became_unavailable' using errcode='40001'; end if;
  product_discount:=(promotion->>'productDiscountMinor')::bigint;
  shipping_discount:=(promotion->>'shippingDiscountMinor')::bigint;
  total_discount:=product_discount+shipping_discount;

  if coupon_id is not null then
    select * into coupon_row from public.coupons where id=coupon_id for update;
    if coupon_row.id is null or coupon_row.status<>'active'
      or (coupon_row.starts_at is not null and timezone('utc',now())<coupon_row.starts_at)
      or (coupon_row.ends_at is not null and timezone('utc',now())>coupon_row.ends_at) then
      raise exception 'coupon_invalid_or_unavailable' using errcode='22023';
    end if;
  end if;

  select count(*) into campaign_usage from private.promotion_redemptions r where r.campaign_id=campaign_id and r.status in ('reserved','consumed');
  select count(*) into campaign_user_usage from private.promotion_redemptions r where r.campaign_id=campaign_id and r.user_id=caller_id and r.status in ('reserved','consumed');
  if campaign_row.usage_limit is not null and campaign_usage>=campaign_row.usage_limit then raise exception 'campaign_usage_limit_reached' using errcode='55000'; end if;
  if campaign_user_usage>=campaign_row.per_user_limit then raise exception 'campaign_user_limit_reached' using errcode='55000'; end if;

  if coupon_id is not null then
    select count(*) into coupon_usage from private.promotion_redemptions r where r.coupon_id=coupon_id and r.status in ('reserved','consumed');
    select count(*) into coupon_user_usage from private.promotion_redemptions r where r.coupon_id=coupon_id and r.user_id=caller_id and r.status in ('reserved','consumed');
    if coupon_row.usage_limit is not null and coupon_usage>=coupon_row.usage_limit then raise exception 'coupon_usage_limit_reached' using errcode='55000'; end if;
    if coupon_user_usage>=coupon_row.per_user_limit then raise exception 'coupon_user_limit_reached' using errcode='55000'; end if;
  end if;

  if product_discount>0 then
    with eligible as (
      select item.id,(item.unit_price_minor*item.quantity)::bigint gross
      from public.order_items item
      left join public.products product on product.id=item.product_id
      where item.order_id=target_order.id and (
        campaign_row.target_scope='all'
        or (campaign_row.target_scope='products' and exists(select 1 from public.campaign_products link where link.campaign_id=campaign_id and link.product_id=item.product_id))
        or (campaign_row.target_scope='categories' and exists(select 1 from public.campaign_categories link where link.campaign_id=campaign_id and link.category_id=product.category_id))
      )
    ), basis as (
      select coalesce(sum(gross),0)::bigint total from eligible
    ), raw_alloc as (
      select e.id,e.gross,
             floor((product_discount::numeric*e.gross::numeric)/nullif(b.total,0))::bigint base_alloc,
             row_number() over(order by e.gross desc,e.id) rn
      from eligible e cross join basis b
    ), totals as (
      select coalesce(sum(base_alloc),0)::bigint allocated from raw_alloc
    ), final_alloc as (
      select r.id,r.base_alloc+case when r.rn=1 then product_discount-t.allocated else 0 end as discount
      from raw_alloc r cross join totals t
    )
    update public.order_items item
    set discount_minor=allocation.discount,
        line_total_minor=(item.unit_price_minor*item.quantity)-allocation.discount+item.tax_minor
    from final_alloc allocation
    where item.id=allocation.id;
  end if;

  select coalesce(sum(item.discount_minor),0)::bigint into allocated_total from public.order_items item where item.order_id=target_order.id;
  if allocated_total<>product_discount then raise exception 'promotion_allocation_mismatch' using errcode='55000'; end if;

  update public.orders
  set discount_minor=total_discount,
      total_minor=subtotal_minor-total_discount+tax_minor+shipping_minor,
      updated_at=timezone('utc',now())
  where id=target_order.id
  returning * into target_order;

  insert into public.order_promotions(order_id,campaign_id,coupon_id,product_discount_minor,shipping_discount_minor,total_discount_minor,snapshot)
  values(target_order.id,campaign_id,coupon_id,product_discount,shipping_discount,total_discount,jsonb_build_object(
    'campaignTitle',campaign_row.title,'activationMode',campaign_row.activation_mode,'discountType',campaign_row.discount_type,
    'discountValue',campaign_row.discount_value,'targetScope',campaign_row.target_scope,'couponDisplayHint',coupon_row.display_hint
  ));

  insert into private.promotion_redemptions(campaign_id,coupon_id,user_id,order_id,status,product_discount_minor,shipping_discount_minor,total_discount_minor,expires_at)
  values(campaign_id,coupon_id,caller_id,target_order.id,'reserved',product_discount,shipping_discount,total_discount,target_order.reservation_expires_at);

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('order',target_order.id,'order.promotion_reserved',jsonb_build_object('order_id',target_order.id,'campaign_id',campaign_id,'coupon_id',coupon_id,'discount_minor',total_discount));

  return jsonb_build_object('applied',true,'campaignId',campaign_id,'couponId',coupon_id,'productDiscountMinor',product_discount,'shippingDiscountMinor',shipping_discount,'totalDiscountMinor',total_discount,'orderTotalMinor',target_order.total_minor);
end;
$function$;

CREATE OR REPLACE FUNCTION private.resolve_category_id_v1(p_reference text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select category.id
  from public.categories category
  where category.id::text = btrim(coalesce(p_reference, ''))
     or category.slug = private.slugify_tr_v1(p_reference)
     or lower(category.name) = lower(btrim(coalesce(p_reference, '')))
  order by category.created_at
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.resolve_order_promotion_v1(p_order_id uuid, p_coupon_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  coupon_row public.coupons%rowtype;
  candidate record;
  evaluation jsonb;
  best jsonb:=jsonb_build_object('eligible',false,'totalDiscountMinor',0);
  best_discount bigint:=0;
  best_priority integer:=-1001;
  code_hash_value text;
begin
  if nullif(btrim(coalesce(p_coupon_code,'')),'') is not null then
    code_hash_value:=private.hash_coupon_code_v1(p_coupon_code);
    select coupon.* into coupon_row
    from public.coupons coupon
    where coupon.code_hash=code_hash_value
      and coupon.status='active'
      and (coupon.starts_at is null or timezone('utc',now())>=coupon.starts_at)
      and (coupon.ends_at is null or timezone('utc',now())<=coupon.ends_at);
    if coupon_row.id is null then raise exception 'coupon_invalid_or_unavailable' using errcode='22023'; end if;

    if not exists(select 1 from public.campaigns campaign where campaign.id=coupon_row.campaign_id and campaign.activation_mode='coupon') then
      raise exception 'coupon_invalid_or_unavailable' using errcode='22023';
    end if;
    evaluation:=private.evaluate_campaign_for_order_v1(p_order_id,coupon_row.campaign_id);
    if not coalesce((evaluation->>'eligible')::boolean,false) then
      raise exception 'coupon_not_applicable:%',coalesce(evaluation->>'reason','unknown') using errcode='22023';
    end if;
    return evaluation||jsonb_build_object('couponId',coupon_row.id,'couponDisplayHint',coupon_row.display_hint);
  end if;

  for candidate in
    select campaign.id,campaign.priority
    from public.campaigns campaign
    where campaign.activation_mode='automatic'
      and campaign.status='active'
      and timezone('utc',now()) between campaign.starts_at and campaign.ends_at
    order by campaign.priority desc,campaign.created_at asc
  loop
    evaluation:=private.evaluate_campaign_for_order_v1(p_order_id,candidate.id);
    if coalesce((evaluation->>'eligible')::boolean,false) then
      if (evaluation->>'totalDiscountMinor')::bigint>best_discount
        or ((evaluation->>'totalDiscountMinor')::bigint=best_discount and candidate.priority>best_priority) then
        best:=evaluation;
        best_discount:=(evaluation->>'totalDiscountMinor')::bigint;
        best_priority:=candidate.priority;
      end if;
    end if;
  end loop;
  return best;
end;
$function$;

CREATE OR REPLACE FUNCTION private.resolve_product_export_rule_v1(p_product_id uuid, p_country_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  product_row public.products%rowtype;
  rule_row private.product_export_country_rules%rowtype;
  country_code text:=upper(btrim(coalesce(p_country_code,'')));
begin
  select * into product_row from public.products where id=p_product_id;
  if product_row.id is null then return jsonb_build_object('decision','prohibited','publicNote','Ürün bulunamadı.'); end if;

  select * into rule_row from private.product_export_country_rules rule
  where rule.product_id=product_row.id and rule.country_code=country_code
  limit 1;
  if rule_row.id is null then
    select * into rule_row from private.product_export_country_rules rule
    where rule.category_id=product_row.category_id and rule.country_code=country_code
    limit 1;
  end if;
  if rule_row.id is null then
    return jsonb_build_object('decision','manual_review','publicNote','Bu ülke için ürün uygunluğu henüz doğrulanmadı.');
  end if;
  return jsonb_build_object('decision',rule_row.decision,'publicNote',rule_row.public_note);
end;
$function$;

CREATE OR REPLACE FUNCTION private.resolve_shipping_zone_v1(p_country_code text)
 RETURNS shipping_zones
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  country_code text:=upper(btrim(coalesce(p_country_code,'')));
  zone_row public.shipping_zones%rowtype;
begin
  if country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_country_code' using errcode='22023'; end if;
  select zone.* into zone_row
  from public.shipping_zones zone
  join public.shipping_zone_countries link on link.zone_id=zone.id and link.country_code=country_code
  where zone.is_active=true
  order by zone.created_at asc limit 1;
  if zone_row.id is null then
    select zone.* into zone_row from public.shipping_zones zone
    where zone.is_active=true and zone.is_rest_of_world=true
    order by zone.created_at asc limit 1;
  end if;
  return zone_row;
end;
$function$;

CREATE OR REPLACE FUNCTION private.restock_return_inventory_v1(p_return_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  returned record;
  movement_id bigint;
begin
  for returned in
    select item.variant_id,sum(returned_item.quantity)::integer as quantity
    from public.return_items returned_item
    join public.order_items item on item.id=returned_item.order_item_id
    join public.products product on product.id=item.product_id
    where returned_item.return_id=p_return_id
      and item.variant_id is not null
      and product.stock_mode in ('tracked','seasonal')
    group by item.variant_id
    order by item.variant_id
  loop
    movement_id:=null;
    insert into private.inventory_movements(
      variant_id,movement_type,quantity_delta,reference_type,reference_id,
      reason,idempotency_key,actor_user_id
    ) values (
      returned.variant_id,'return',returned.quantity,'return_request',p_return_id,
      'Approved returned goods restored to sellable inventory',
      'return:'||p_return_id::text||':restock:'||returned.variant_id::text,
      p_actor_user_id
    )
    on conflict(idempotency_key) do nothing
    returning id into movement_id;

    if movement_id is not null then
      update public.product_inventory inventory
      set available_quantity=inventory.available_quantity+returned.quantity,
          version=inventory.version+1,
          updated_at=timezone('utc',now())
      where inventory.variant_id=returned.variant_id;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.set_review_helpful_vote_v1(p_review_id uuid, p_helpful boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); review_row public.reviews%rowtype; vote_count bigint;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into review_row from public.reviews where id=p_review_id and status='published';
  if review_row.id is null then raise exception 'published_review_not_found' using errcode='P0002'; end if;
  if review_row.user_id=caller_id then raise exception 'cannot_vote_own_review' using errcode='22023'; end if;
  if coalesce(p_helpful,false) then
    insert into private.review_helpful_votes(review_id,user_id) values(review_row.id,caller_id) on conflict do nothing;
  else
    delete from private.review_helpful_votes where review_id=review_row.id and user_id=caller_id;
  end if;
  select count(*) into vote_count from private.review_helpful_votes where review_id=review_row.id;
  return jsonb_build_object('reviewId',review_row.id,'helpful',coalesce(p_helpful,false),'helpfulCount',vote_count);
end;
$function$;

CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.should_queue_push_v1(p_user_id uuid, p_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pref private.user_notification_preferences%rowtype; marketing_allowed boolean:=false;
begin
  select * into pref from private.user_notification_preferences where user_id=p_user_id;
  if pref.user_id is not null and not pref.push_enabled then return false; end if;
  if p_type='campaign' then
    select marketing_consent into marketing_allowed from public.profiles where id=p_user_id;
    return coalesce(marketing_allowed,false) and coalesce(pref.campaign_push,false);
  elsif p_type='order' then return coalesce(pref.order_push,true);
  elsif p_type='payment' then return coalesce(pref.payment_push,true);
  elsif p_type='shipment' then return coalesce(pref.shipment_push,true);
  elsif p_type='return' then return coalesce(pref.return_push,true);
  elsif p_type='message' then return coalesce(pref.message_push,true);
  elsif p_type='review' then return coalesce(pref.review_push,true);
  elsif p_type='producer' then return coalesce(pref.producer_push,true);
  else return coalesce(pref.system_push,true);
  end if;
end;
$function$;
