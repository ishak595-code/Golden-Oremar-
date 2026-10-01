-- Shipping quote carries the zone's free-shipping threshold, so the cart can
-- say "add X TL more for free shipping" the way large marketplaces do. The
-- fee calculation is unchanged; this only adds one field to the answer.

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
    'freeShippingThresholdMinor',zone.free_shipping_threshold_minor,
    'publicNote',zone.public_note
  );
end;
$function$;
