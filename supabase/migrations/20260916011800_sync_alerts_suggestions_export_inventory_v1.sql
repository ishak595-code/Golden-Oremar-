-- Drift closure: token-based stock alert cancellation, catalog search
-- suggestions, product export eligibility check, newsletter confirmation, and
-- the inventory consumption step that converts a reservation into a sale.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION api_public_bridge.cancel_stock_alert_by_token_v1(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.cancel_stock_alert_by_token_v1(p_token); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.catalog_search_suggestions_v1(p_query text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.catalog_search_suggestions_v1(p_query,p_limit); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.check_product_export_eligibility_v1(p_product_id uuid, p_country_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.check_product_export_eligibility_v1(p_product_id,p_country_code); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.confirm_newsletter_v1(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.confirm_newsletter_v1(p_token); $function$
;

CREATE OR REPLACE FUNCTION private.cancel_stock_alert_by_token_v1(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare token_hash text:=private.hash_marketing_token_v1(p_token); affected integer;
begin
  update private.stock_alert_subscriptions set status='cancelled' where unsubscribe_token_hash=token_hash and status='active';
  get diagnostics affected=row_count;
  return affected>0;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.catalog_search_suggestions_v1(p_query text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q text:=lower(btrim(coalesce(p_query,''))); result jsonb;
begin
  if char_length(q) not between 1 and 100 then return '[]'::jsonb; end if;
  if p_limit not between 1 and 20 then raise exception 'invalid_suggestion_limit' using errcode='22023'; end if;
  with suggestions as (
    select 'product'::text kind,product.id::text id,product.name label,product.slug value,
           greatest(extensions.similarity(lower(product.name),q),case when lower(product.name) like q||'%' then 1 else 0 end)::numeric score
    from public.products product join public.producers producer on producer.id=product.producer_id
    where product.status='published' and product.is_active=true and product.deleted_at is null and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
      and (lower(product.name) ilike '%'||q||'%' or extensions.similarity(lower(product.name),q)>=0.18)
    union all
    select 'producer',producer.id::text,producer.display_name,producer.slug,
           greatest(extensions.similarity(lower(producer.display_name),q),case when lower(producer.display_name) like q||'%' then 1 else 0 end)::numeric
    from public.producers producer
    where producer.status='active' and producer.is_verified=true and producer.deleted_at is null
      and (lower(producer.display_name) ilike '%'||q||'%' or lower(coalesce(producer.production_village,'')) ilike '%'||q||'%' or extensions.similarity(lower(producer.display_name),q)>=0.18)
    union all
    select 'category',category.id::text,category.name,category.slug,
           greatest(extensions.similarity(lower(category.name),q),case when lower(category.name) like q||'%' then 1 else 0 end)::numeric
    from public.categories category where category.is_active=true and (lower(category.name) ilike '%'||q||'%' or extensions.similarity(lower(category.name),q)>=0.18)
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'label',label,'value',value) order by score desc,label),'[]'::jsonb)
  into result from (select * from suggestions order by score desc,label limit p_limit) ranked;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.check_product_export_eligibility_v1(p_product_id uuid, p_country_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  country_code text:=upper(btrim(coalesce(p_country_code,'')));
  product_row public.products%rowtype;
  zone_row public.shipping_zones%rowtype;
  rule jsonb;
  missing_weight_count integer;
begin
  if country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_country_code' using errcode='22023'; end if;
  select product.* into product_row
  from public.products product
  join public.producers producer on producer.id=product.producer_id
  where product.id=p_product_id and product.status='published' and product.is_active=true and product.deleted_at is null
    and producer.status='active' and producer.is_verified=true and producer.deleted_at is null;
  if product_row.id is null then return jsonb_build_object('available',false,'reason','product_not_available'); end if;
  if country_code='TR' then return jsonb_build_object('available',true,'countryCode',country_code,'mode','domestic'); end if;
  zone_row:=private.resolve_shipping_zone_v1(country_code);
  if zone_row.id is null then return jsonb_build_object('available',false,'reason','shipping_zone_unavailable'); end if;
  if zone_row.requires_manual_quote then return jsonb_build_object('available',false,'reason','manual_shipping_quote_required','manualQuoteRequired',true,'publicNote',zone_row.public_note); end if;
  if product_row.export_status<>'eligible' then return jsonb_build_object('available',false,'reason','product_export_not_enabled','manualReviewRequired',true); end if;
  if product_row.country_of_origin_code is null or product_row.customs_hs_code is null or nullif(btrim(coalesce(product_row.customs_description,'')),'') is null then
    return jsonb_build_object('available',false,'reason','product_customs_profile_incomplete');
  end if;
  select count(*)::integer into missing_weight_count from public.product_variants variant where variant.product_id=product_row.id and variant.is_active=true and (variant.weight_grams is null or variant.weight_grams<=0);
  if missing_weight_count>0 then return jsonb_build_object('available',false,'reason','product_weight_incomplete'); end if;
  if product_row.requires_cold_chain and not zone_row.supports_cold_chain then return jsonb_build_object('available',false,'reason','cold_chain_unavailable'); end if;
  rule:=private.resolve_product_export_rule_v1(product_row.id,country_code);
  if coalesce(rule->>'decision','manual_review')<>'allowed' then
    return jsonb_build_object('available',false,'reason','country_product_rule_'||coalesce(rule->>'decision','manual_review'),'manualReviewRequired',(coalesce(rule->>'decision','manual_review') in ('manual_review','restricted')),'publicNote',rule->>'publicNote');
  end if;
  return jsonb_build_object('available',true,'countryCode',country_code,'zoneCode',zone_row.code,'publicNote',rule->>'publicNote');
end;
$function$
;

CREATE OR REPLACE FUNCTION private.confirm_newsletter_v1(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare token_hash text:=private.hash_marketing_token_v1(p_token); sub private.newsletter_subscriptions%rowtype;
begin
  select * into sub from private.newsletter_subscriptions where confirmation_token_hash=token_hash and status='pending' for update;
  if sub.id is null then raise exception 'newsletter_confirmation_invalid_or_expired' using errcode='P0002'; end if;
  update private.newsletter_subscriptions set status='active',confirmed_at=timezone('utc',now()),confirmation_token_hash=null,updated_at=timezone('utc',now()) where id=sub.id returning * into sub;
  if sub.user_id is not null then
    update public.profiles set marketing_consent=true,marketing_consent_at=coalesce(marketing_consent_at,timezone('utc',now())),updated_at=timezone('utc',now()) where id=sub.user_id and status='active' and deleted_at is null;
  end if;
  return jsonb_build_object('id',sub.id,'status',sub.status,'confirmedAt',sub.confirmed_at);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.consume_order_inventory_v1(p_order_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  reservation record;
  movement_id bigint;
  current_inventory public.product_inventory%rowtype;
begin
  for reservation in
    select item.variant_id, sum(item.quantity)::integer as quantity
    from public.order_items item
    join public.products product on product.id = item.product_id
    where item.order_id = p_order_id
      and item.variant_id is not null
      and product.stock_mode in ('tracked','seasonal')
    group by item.variant_id
    order by item.variant_id
  loop
    select inventory.* into current_inventory from public.product_inventory inventory where inventory.variant_id = reservation.variant_id for update;
    if current_inventory.variant_id is null then raise exception 'inventory_missing_for_sale:%', reservation.variant_id using errcode = 'P0001'; end if;
    if current_inventory.available_quantity < reservation.quantity or current_inventory.reserved_quantity < reservation.quantity then
      raise exception 'inventory_reservation_inconsistent:%', reservation.variant_id using errcode = 'P0001';
    end if;
    movement_id := null;
    insert into private.inventory_movements(variant_id, movement_type, quantity_delta, reference_type, reference_id, reason, idempotency_key, actor_user_id)
    values (reservation.variant_id, 'sale', -reservation.quantity, 'order', p_order_id,
      'Confirmed order converted reserved stock to sale', 'order:' || p_order_id::text || ':sale:' || reservation.variant_id::text, p_actor_user_id)
    on conflict (idempotency_key) do nothing returning id into movement_id;
    if movement_id is not null then
      update public.product_inventory inventory
      set available_quantity = inventory.available_quantity - reservation.quantity,
          reserved_quantity = inventory.reserved_quantity - reservation.quantity,
          version = inventory.version + 1, updated_at = timezone('utc', now())
      where inventory.variant_id = reservation.variant_id;
    end if;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_stock_alert_by_token_v1(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.cancel_stock_alert_by_token_v1(p_token); $function$
;

CREATE OR REPLACE FUNCTION public.catalog_search_suggestions_v1(p_query text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.catalog_search_suggestions_v1(p_query, p_limit); $function$
;

CREATE OR REPLACE FUNCTION public.check_product_export_eligibility_v1(p_product_id uuid, p_country_code text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.check_product_export_eligibility_v1(p_product_id, p_country_code); $function$
;

CREATE OR REPLACE FUNCTION public.confirm_newsletter_v1(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.confirm_newsletter_v1(p_token); $function$
;
