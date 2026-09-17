-- Drift closure: create_customer_order_v3 - the outermost checkout entry point.
-- It derives its own idempotency key from caller, caller-supplied key and coupon
-- code so the same cart with a different coupon is treated as a distinct
-- request, delegates order creation to v2, then validates export eligibility
-- and reserves any applicable promotion before returning updated totals.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.create_customer_order_v3(p_items jsonb, p_shipping_address jsonb, p_customer_note text, p_coupon_code text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  derived_key text;
  base_result jsonb;
  promotion_result jsonb;
  order_id uuid;
  order_row public.orders%rowtype;
  country_code text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 160 or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  country_code:=upper(coalesce(nullif(btrim(coalesce(p_shipping_address->>'country_code',p_shipping_address->>'countryCode','')),''),'TR'));
  derived_key:='v3_'||encode(extensions.digest(convert_to(caller_id::text||'|'||p_idempotency_key||'|'||coalesce(upper(btrim(p_coupon_code)),''),'UTF8'),'sha256'),'hex');
  base_result:=private.create_customer_order_v2(p_items,p_shipping_address,p_customer_note,derived_key);
  order_id:=(base_result->>'orderId')::uuid;
  perform private.validate_order_export_eligibility_v1(order_id,country_code);
  promotion_result:=private.reserve_order_promotion_v1(order_id,p_coupon_code);
  select * into order_row from public.orders where id=order_id;
  return base_result||jsonb_build_object('discountMinor',order_row.discount_minor,'totalMinor',order_row.total_minor,'promotion',promotion_result,'exportValidation','passed');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_customer_order_v3(p_items jsonb, p_shipping_address jsonb, p_customer_note text, p_coupon_code text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.create_customer_order_v3(p_items,p_shipping_address,p_customer_note,p_coupon_code,p_idempotency_key); $function$
;
