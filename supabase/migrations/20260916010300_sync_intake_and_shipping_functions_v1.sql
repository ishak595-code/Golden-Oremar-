-- Drift closure: public-facing intake and shipping functions - contact form
-- submission (idempotency + rate limiting), newsletter subscribe, stock-alert
-- subscribe, and the shipping quote calculator (zone lookup, per-kg pricing,
-- free-shipping threshold, manual-quote handling).
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION api_public_bridge.submit_contact_message(p_idempotency_key text, p_request_hash text, p_name text, p_email text, p_phone text, p_subject text, p_message text, p_locale text, p_source text, p_ip_hash text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.submit_contact_message(p_idempotency_key,p_request_hash,p_name,p_email,p_phone,p_subject,p_message,p_locale,p_source,p_ip_hash,p_user_agent); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.subscribe_newsletter_v1(p_email text, p_locale text, p_consent_version text, p_source text DEFAULT 'app'::text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.subscribe_newsletter_v1(p_email,p_locale,p_consent_version,p_source); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.subscribe_stock_alert_v1(p_variant_id uuid, p_email text DEFAULT NULL::text, p_locale text DEFAULT 'tr'::text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.subscribe_stock_alert_v1(p_variant_id,p_email,p_locale); $function$
;

CREATE OR REPLACE FUNCTION private.submit_contact_message(p_idempotency_key text, p_request_hash text, p_name text, p_email text, p_phone text, p_subject text, p_message text, p_locale text, p_source text, p_ip_hash text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  existing_key private.idempotency_keys%rowtype;
  message_id uuid;
  response_payload jsonb;
  normalized_email text := lower(trim(p_email));
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'invalid_idempotency_key';
  end if;

  if p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_request_hash';
  end if;

  select *
  into existing_key
  from private.idempotency_keys
  where key = p_idempotency_key
    and scope = 'contact_submission';

  if found then
    if existing_key.request_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'idempotency_key_reused';
    end if;
    if existing_key.completed_at is not null then
      return existing_key.response_body;
    end if;
  end if;

  if p_name is null or char_length(trim(p_name)) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'invalid_name';
  end if;
  if normalized_email is null
     or char_length(normalized_email) > 254
     or normalized_email !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception using errcode = '22023', message = 'invalid_email';
  end if;
  if p_phone is not null and char_length(trim(p_phone)) > 40 then
    raise exception using errcode = '22023', message = 'invalid_phone';
  end if;
  if p_subject is null or char_length(trim(p_subject)) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'invalid_subject';
  end if;
  if p_message is null or char_length(trim(p_message)) not between 10 and 5000 then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;
  if p_locale is null or p_locale !~ '^[a-z]{2}(-[A-Z]{2})?$' then
    raise exception using errcode = '22023', message = 'invalid_locale';
  end if;
  if p_source is null or char_length(p_source) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'invalid_source';
  end if;
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_ip_hash';
  end if;

  insert into private.idempotency_keys(
    key, scope, request_hash, locked_at, expires_at
  ) values (
    p_idempotency_key,
    'contact_submission',
    p_request_hash,
    timezone('utc', now()),
    timezone('utc', now()) + interval '24 hours'
  )
  on conflict (key) do nothing;

  if not found then
    select *
    into existing_key
    from private.idempotency_keys
    where key = p_idempotency_key;

    if existing_key.scope <> 'contact_submission' or existing_key.request_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'idempotency_key_reused';
    end if;
    if existing_key.completed_at is not null then
      return existing_key.response_body;
    end if;
    raise exception using errcode = '40001', message = 'request_in_progress';
  end if;

  if (
    select count(*)
    from private.submission_attempts
    where scope = 'contact'
      and ip_hash = p_ip_hash
      and created_at > timezone('utc', now()) - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;

  insert into private.submission_attempts(scope, ip_hash, request_hash)
  values ('contact', p_ip_hash, p_request_hash);

  insert into private.contact_messages(
    name,
    email,
    phone,
    subject,
    message,
    locale,
    source,
    ip_hash,
    user_agent
  ) values (
    trim(p_name),
    normalized_email,
    nullif(trim(p_phone), ''),
    trim(p_subject),
    trim(p_message),
    p_locale,
    p_source,
    p_ip_hash,
    left(coalesce(p_user_agent, ''), 500)
  )
  returning id into message_id;

  insert into private.outbox_events(
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'contact_message',
    message_id,
    'contact.received',
    jsonb_build_object('contact_message_id', message_id)
  );

  response_payload := jsonb_build_object(
    'ok', true,
    'messageId', message_id,
    'status', 'received'
  );

  update private.idempotency_keys
  set response_status = 201,
      response_body = response_payload,
      completed_at = timezone('utc', now())
  where key = p_idempotency_key;

  return response_payload;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.subscribe_newsletter_v1(p_email text, p_locale text, p_consent_version text, p_source text DEFAULT 'app'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid:=auth.uid(); linked_user_id uuid; email_value text:=lower(btrim(coalesce(p_email,''))); locale_value text:=lower(btrim(coalesce(p_locale,'tr'))); source_value text:=lower(btrim(coalesce(p_source,'app'))); confirm_raw text; unsubscribe_raw text; sub private.newsletter_subscriptions%rowtype;
begin
  if char_length(email_value)>254 or email_value !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then raise exception 'invalid_email' using errcode='22023'; end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then raise exception 'invalid_locale' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_consent_version,''))) not between 1 and 80 then raise exception 'consent_version_required' using errcode='22023'; end if;
  if char_length(source_value) not between 2 and 40 then raise exception 'invalid_source' using errcode='22023'; end if;
  if caller_id is not null and exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then linked_user_id:=caller_id; end if;

  select * into sub from private.newsletter_subscriptions where email_normalized=email_value for update;
  if sub.id is not null and sub.status='active' then return jsonb_build_object('id',sub.id,'status','active','unchanged',true); end if;

  confirm_raw:=encode(extensions.gen_random_bytes(24),'hex'); unsubscribe_raw:=encode(extensions.gen_random_bytes(24),'hex');
  if sub.id is null then
    insert into private.newsletter_subscriptions(email_normalized,user_id,locale,status,consent_version,consented_at,confirmation_token_hash,unsubscribe_token_hash,source)
    values(email_value,linked_user_id,locale_value,'pending',btrim(p_consent_version),timezone('utc',now()),private.hash_marketing_token_v1(confirm_raw),private.hash_marketing_token_v1(unsubscribe_raw),source_value)
    returning * into sub;
  else
    update private.newsletter_subscriptions
    set user_id=coalesce(linked_user_id,user_id),locale=locale_value,status='pending',consent_version=btrim(p_consent_version),consented_at=timezone('utc',now()),confirmed_at=null,unsubscribed_at=null,
        confirmation_token_hash=private.hash_marketing_token_v1(confirm_raw),unsubscribe_token_hash=private.hash_marketing_token_v1(unsubscribe_raw),source=source_value,updated_at=timezone('utc',now())
    where id=sub.id returning * into sub;
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('newsletter_subscription',sub.id,'newsletter.confirmation_requested',jsonb_build_object('subscription_id',sub.id,'email',email_value,'locale',locale_value,'confirmationToken',confirm_raw,'unsubscribeToken',unsubscribe_raw,'consentVersion',sub.consent_version));
  return jsonb_build_object('id',sub.id,'status','pending','email',email_value);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.subscribe_stock_alert_v1(p_variant_id uuid, p_email text DEFAULT NULL::text, p_locale text DEFAULT 'tr'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid(); linked_user_id uuid; email_value text:=lower(btrim(coalesce(p_email,auth.jwt()->>'email',''))); locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  variant_row public.product_variants%rowtype; product_row public.products%rowtype; producer_row public.producers%rowtype; inventory_row public.product_inventory%rowtype;
  sellable integer; token_raw text; token_hash text; subscription_row private.stock_alert_subscriptions%rowtype;
begin
  if locale_value not in ('tr','en','de','fr','ku','ar') then raise exception 'invalid_locale' using errcode='22023'; end if;
  if caller_id is not null and exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then linked_user_id:=caller_id; end if;
  if linked_user_id is null and (char_length(email_value)>254 or email_value !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$') then raise exception 'valid_email_required' using errcode='22023'; end if;
  if linked_user_id is not null and email_value<>'' and (char_length(email_value)>254 or email_value !~* '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$') then raise exception 'invalid_email' using errcode='22023'; end if;

  select * into variant_row from public.product_variants where id=p_variant_id and is_active=true;
  if variant_row.id is null then raise exception 'variant_not_available' using errcode='P0002'; end if;
  select * into product_row from public.products where id=variant_row.product_id;
  select * into producer_row from public.producers where id=product_row.producer_id;
  if product_row.status<>'published' or not product_row.is_active or product_row.deleted_at is not null or producer_row.status<>'active' or not producer_row.is_verified or producer_row.deleted_at is not null then raise exception 'product_not_available' using errcode='P0002'; end if;
  if product_row.stock_mode not in ('tracked','seasonal') then return jsonb_build_object('status','not_required','reason','product_not_stock_tracked'); end if;
  select * into inventory_row from public.product_inventory where variant_id=p_variant_id;
  sellable:=greatest(0,coalesce(inventory_row.available_quantity,0)-coalesce(inventory_row.reserved_quantity,0));
  if sellable>0 then return jsonb_build_object('status','available','sellableQuantity',sellable,'variantId',p_variant_id); end if;

  token_raw:=encode(extensions.gen_random_bytes(24),'hex'); token_hash:=private.hash_marketing_token_v1(token_raw);
  if linked_user_id is not null then
    select * into subscription_row from private.stock_alert_subscriptions where user_id=linked_user_id and variant_id=p_variant_id and status='active' limit 1;
  else
    select * into subscription_row from private.stock_alert_subscriptions where email_normalized=email_value and variant_id=p_variant_id and status='active' limit 1;
  end if;
  if subscription_row.id is not null then return jsonb_build_object('id',subscription_row.id,'status','active','variantId',p_variant_id,'unchanged',true); end if;

  insert into private.stock_alert_subscriptions(variant_id,user_id,email_normalized,status,locale,unsubscribe_token_hash)
  values(p_variant_id,linked_user_id,nullif(email_value,''),'active',locale_value,token_hash)
  returning * into subscription_row;

  if linked_user_id is null and email_value<>'' then
    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('stock_alert',subscription_row.id,'stock_alert.subscribed',jsonb_build_object('subscription_id',subscription_row.id,'email',email_value,'locale',locale_value,'unsubscribeToken',token_raw,'productName',product_row.name,'variantName',variant_row.name));
  end if;
  return jsonb_build_object('id',subscription_row.id,'status','active','variantId',p_variant_id,'productId',product_row.id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shipping_quote_v1(p_country_code text, p_weight_grams integer, p_subtotal_minor bigint, p_currency text DEFAULT 'TRY'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  normalized_country text := upper(btrim(coalesce(p_country_code,'')));
  normalized_currency text := upper(btrim(coalesce(p_currency,'TRY')));
  zone public.shipping_zones%rowtype;
  fee bigint;
  kg_units numeric;
begin
  if normalized_country !~ '^[A-Z]{2}$' then raise exception 'invalid_shipping_country' using errcode='22023'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_shipping_currency' using errcode='22023'; end if;
  if p_weight_grams is null or p_weight_grams <= 0 then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
  if p_subtotal_minor is null or p_subtotal_minor < 0 then raise exception 'invalid_shipping_subtotal' using errcode='22023'; end if;

  select z.* into zone
  from public.shipping_zones z
  join public.shipping_zone_countries c on c.zone_id=z.id
  where z.is_active=true and c.country_code=normalized_country
  order by z.created_at
  limit 1;

  if zone.id is null then
    select z.* into zone
    from public.shipping_zones z
    where z.is_active=true and z.is_rest_of_world=true
    order by z.created_at
    limit 1;
  end if;

  if zone.id is null then
    return jsonb_build_object('available',false,'countryCode',normalized_country,'reason','shipping_zone_not_configured');
  end if;

  if zone.currency <> normalized_currency then
    return jsonb_build_object('available',false,'countryCode',normalized_country,'zoneCode',zone.code,'reason','shipping_currency_not_configured');
  end if;

  if zone.max_weight_grams is not null and p_weight_grams > zone.max_weight_grams then
    return jsonb_build_object('available',false,'countryCode',normalized_country,'zoneCode',zone.code,'reason','shipment_weight_exceeds_zone_limit');
  end if;

  if zone.requires_manual_quote then
    return jsonb_build_object(
      'available',false,
      'manualQuoteRequired',true,
      'countryCode',normalized_country,
      'zoneCode',zone.code,
      'zoneName',zone.name,
      'reason','manual_shipping_quote_required',
      'publicNote',zone.public_note
    );
  end if;

  if zone.base_fee_minor is null or zone.per_kg_fee_minor is null then
    return jsonb_build_object('available',false,'countryCode',normalized_country,'zoneCode',zone.code,'reason','shipping_rate_not_configured');
  end if;

  kg_units := ceil(p_weight_grams::numeric / 1000.0);
  fee := zone.base_fee_minor + (zone.per_kg_fee_minor * kg_units)::bigint;
  if zone.free_shipping_threshold_minor is not null and p_subtotal_minor >= zone.free_shipping_threshold_minor then fee:=0; end if;

  return jsonb_build_object(
    'available',true,
    'manualQuoteRequired',false,
    'countryCode',normalized_country,
    'zoneCode',zone.code,
    'zoneName',zone.name,
    'currency',zone.currency,
    'shippingMinor',fee,
    'weightGrams',p_weight_grams,
    'minDeliveryDays',zone.min_delivery_days,
    'maxDeliveryDays',zone.max_delivery_days,
    'publicNote',zone.public_note
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_contact_message(p_idempotency_key text, p_request_hash text, p_name text, p_email text, p_phone text, p_subject text, p_message text, p_locale text, p_source text, p_ip_hash text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.submit_contact_message(p_idempotency_key, p_request_hash, p_name, p_email, p_phone, p_subject, p_message, p_locale, p_source, p_ip_hash, p_user_agent); $function$
;

CREATE OR REPLACE FUNCTION public.subscribe_newsletter_v1(p_email text, p_locale text, p_consent_version text, p_source text DEFAULT 'app'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.subscribe_newsletter_v1(p_email, p_locale, p_consent_version, p_source); $function$
;

CREATE OR REPLACE FUNCTION public.subscribe_stock_alert_v1(p_variant_id uuid, p_email text DEFAULT NULL::text, p_locale text DEFAULT 'tr'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.subscribe_stock_alert_v1(p_variant_id, p_email, p_locale); $function$
;
