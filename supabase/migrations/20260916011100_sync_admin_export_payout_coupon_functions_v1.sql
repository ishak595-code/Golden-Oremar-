-- Drift closure: admin producer location-change review, payout status
-- transitions, product export/customs profile, per-country export rules, and
-- coupon upsert (hashed codes with masked display hints).
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_review_producer_location_change_v1(p_request_id uuid, p_approve boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.producer_location_change_requests%rowtype; admin_id uuid:=auth.uid();
begin
  if not coalesce(private.has_permission('seller.review'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select * into r from public.producer_location_change_requests where id=p_request_id and status='pending' for update;
  if r.id is null then raise exception 'location_change_request_not_pending' using errcode='P0002'; end if;
  if not coalesce(p_approve,false) and char_length(btrim(coalesce(p_reason,''))) < 5 then raise exception 'review_reason_required' using errcode='22023'; end if;
  if coalesce(p_approve,false) then
    update public.producers set
      production_country_code=r.country_code, production_province=r.province, production_district=r.district,
      production_village=r.village, production_village_is_custom=r.village_is_custom,
      production_latitude=r.latitude, production_longitude=r.longitude,
      production_location=r.village||', '||r.district||', '||r.province||', '||r.country_code,
      latitude=r.latitude, longitude=r.longitude, updated_at=timezone('utc',now())
    where id=r.producer_id;
  end if;
  update public.producer_location_change_requests set status=case when coalesce(p_approve,false) then 'approved' else 'rejected' end,
    reviewed_by=admin_id, reviewed_at=timezone('utc',now()), review_reason=nullif(btrim(coalesce(p_reason,'')),''), updated_at=timezone('utc',now())
  where id=r.id;
  return jsonb_build_object('request_id',r.id,'status',case when coalesce(p_approve,false) then 'approved' else 'rejected' end);
end; $function$
;

CREATE OR REPLACE FUNCTION private.admin_update_producer_payout_v1(p_payout_id uuid, p_status text, p_provider text DEFAULT NULL::text, p_provider_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  payout_row private.producer_payouts%rowtype;
  next_status text:=lower(btrim(coalesce(p_status,'')));
  producer_owner uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if next_status='paid' and not private.has_permission('payout.release') then raise exception 'permission_required:payout.release' using errcode='42501'; end if;
  if next_status<>'paid' and not private.has_permission('payout.review') then raise exception 'permission_required:payout.review' using errcode='42501'; end if;
  if next_status not in ('processing','paid','failed','cancelled') then raise exception 'invalid_payout_status' using errcode='22023'; end if;
  if char_length(coalesce(p_provider,''))>80 or char_length(coalesce(p_provider_reference,''))>180 or char_length(coalesce(p_note,''))>1000 then raise exception 'invalid_payout_field' using errcode='22023'; end if;
  select * into payout_row from private.producer_payouts where id=p_payout_id for update;
  if payout_row.id is null then raise exception 'payout_not_found' using errcode='P0002'; end if;
  if not (
    (payout_row.status='scheduled' and next_status in ('processing','paid','failed','cancelled'))
    or (payout_row.status='processing' and next_status in ('paid','failed','cancelled'))
  ) then raise exception 'invalid_payout_transition:%:%',payout_row.status,next_status using errcode='22023'; end if;
  if next_status='paid' and (char_length(btrim(coalesce(p_provider,'')))<2 or char_length(btrim(coalesce(p_provider_reference,'')))<4) then raise exception 'payout_payment_reference_required' using errcode='22023'; end if;
  update private.producer_payouts
  set status=next_status,
      provider=coalesce(nullif(btrim(coalesce(p_provider,'')),''),provider),
      provider_reference=coalesce(nullif(btrim(coalesce(p_provider_reference,'')),''),provider_reference),
      note=coalesce(nullif(btrim(coalesce(p_note,'')),''),note),
      processed_by=caller_id,
      processed_at=case when next_status in ('paid','failed','cancelled') then timezone('utc',now()) else processed_at end,
      updated_at=timezone('utc',now())
  where id=payout_row.id returning * into payout_row;
  select owner_user_id into producer_owner from public.producers where id=payout_row.producer_id;
  if next_status='paid' and producer_owner is not null then
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(producer_owner,'producer','Üretici ödemeniz gönderildi','Golden Oremar üretici ödemeniz işlendi.','/producer/finance',jsonb_build_object('payoutId',payout_row.id,'amountMinor',payout_row.amount_minor,'currency',payout_row.currency));
  end if;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('producer_payout',payout_row.id,'producer_payout.'||next_status,jsonb_build_object('payout_id',payout_row.id,'producer_id',payout_row.producer_id,'status',next_status,'actor_user_id',caller_id));
  return jsonb_build_object('id',payout_row.id,'producerId',payout_row.producer_id,'currency',payout_row.currency,'amountMinor',payout_row.amount_minor,'status',payout_row.status,'provider',payout_row.provider,'providerReference',payout_row.provider_reference);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_update_product_export_profile_v1(p_product_id uuid, p_export_status text, p_country_of_origin_code text, p_customs_hs_code text, p_customs_description text, p_is_perishable boolean, p_requires_cold_chain boolean, p_shelf_life_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  export_status_value text:=lower(btrim(coalesce(p_export_status,'')));
  origin_code text:=upper(nullif(btrim(coalesce(p_country_of_origin_code,'')),''));
  hs_code text:=nullif(regexp_replace(btrim(coalesce(p_customs_hs_code,'')),'\s+','','g'),'');
  customs_text text:=nullif(btrim(coalesce(p_customs_description,'')),'');
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if export_status_value not in ('not_configured','domestic_only','manual_review','eligible') then raise exception 'invalid_export_status' using errcode='22023'; end if;
  if origin_code is not null and origin_code !~ '^[A-Z]{2}$' then raise exception 'invalid_origin_country' using errcode='22023'; end if;
  if hs_code is not null and (char_length(hs_code) not between 4 and 16 or hs_code !~ '^[0-9.]+$') then raise exception 'invalid_hs_code' using errcode='22023'; end if;
  if customs_text is not null and char_length(customs_text)>500 then raise exception 'customs_description_too_long' using errcode='22023'; end if;
  if p_shelf_life_days is not null and p_shelf_life_days not between 1 and 3650 then raise exception 'invalid_shelf_life_days' using errcode='22023'; end if;
  if export_status_value='eligible' and (origin_code is null or hs_code is null or customs_text is null) then raise exception 'eligible_export_profile_requires_customs_data' using errcode='22023'; end if;
  update public.products
  set export_status=export_status_value,country_of_origin_code=origin_code,customs_hs_code=hs_code,customs_description=customs_text,
      is_perishable=coalesce(p_is_perishable,false),requires_cold_chain=coalesce(p_requires_cold_chain,false),shelf_life_days=p_shelf_life_days,updated_at=timezone('utc',now())
  where id=p_product_id and deleted_at is null returning * into product_row;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('productId',product_row.id,'exportStatus',product_row.export_status,'countryOfOriginCode',product_row.country_of_origin_code,'customsHsCode',product_row.customs_hs_code,'isPerishable',product_row.is_perishable,'requiresColdChain',product_row.requires_cold_chain,'shelfLifeDays',product_row.shelf_life_days);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_upsert_coupon_v1(p_id uuid, p_campaign_id uuid, p_code text, p_status text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_usage_limit integer, p_per_user_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  target_campaign public.campaigns%rowtype;
  normalized_status text := lower(btrim(coalesce(p_status,'active')));
  normalized_code text;
  code_hash_value text;
  display_hint_value text;
  coupon_row public.coupons%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('campaign.manage'),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  select campaign.* into target_campaign from public.campaigns campaign where campaign.id=p_campaign_id;
  if target_campaign.id is null then raise exception 'campaign_not_found' using errcode='P0002'; end if;
  if target_campaign.activation_mode<>'coupon' then raise exception 'campaign_not_coupon_activated' using errcode='22023'; end if;
  if normalized_status not in ('active','disabled','expired') then raise exception 'invalid_coupon_status' using errcode='22023'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'invalid_coupon_dates' using errcode='22023'; end if;
  if p_usage_limit is not null and p_usage_limit<=0 then raise exception 'invalid_coupon_usage_limit' using errcode='22023'; end if;
  if p_per_user_limit is null or p_per_user_limit<=0 then raise exception 'invalid_coupon_per_user_limit' using errcode='22023'; end if;
  if p_id is null or nullif(btrim(coalesce(p_code,'')),'') is not null then
    normalized_code:=private.normalize_coupon_code_v1(p_code);
    code_hash_value:=private.hash_coupon_code_v1(normalized_code);
    display_hint_value:=case
      when char_length(normalized_code)<=6 then left(normalized_code,2)||'••'||right(normalized_code,2)
      else left(normalized_code,3)||'••••'||right(normalized_code,2)
    end;
  end if;
  if p_id is null then
    if code_hash_value is null then raise exception 'coupon_code_required' using errcode='22023'; end if;
    insert into public.coupons(campaign_id,code_hash,display_hint,status,starts_at,ends_at,usage_limit,per_user_limit)
    values (p_campaign_id,code_hash_value,display_hint_value,normalized_status,p_starts_at,p_ends_at,p_usage_limit,p_per_user_limit)
    returning * into coupon_row;
  else
    update public.coupons coupon
    set campaign_id=p_campaign_id, code_hash=coalesce(code_hash_value,coupon.code_hash), display_hint=coalesce(display_hint_value,coupon.display_hint),
        status=normalized_status, starts_at=p_starts_at, ends_at=p_ends_at, usage_limit=p_usage_limit, per_user_limit=p_per_user_limit
    where coupon.id=p_id returning * into coupon_row;
    if coupon_row.id is null then raise exception 'coupon_not_found' using errcode='P0002'; end if;
  end if;
  insert into private.audit_log(actor_user_id,action,record_type,record_id,metadata)
  values(caller_id,case when p_id is null then 'coupon.created' else 'coupon.updated' end,'coupon',coupon_row.id,jsonb_build_object('campaign_id',coupon_row.campaign_id,'status',coupon_row.status,'display_hint',coupon_row.display_hint));
  return jsonb_build_object('id',coupon_row.id,'campaignId',coupon_row.campaign_id,'displayHint',coupon_row.display_hint,'status',coupon_row.status,'startsAt',coupon_row.starts_at,'endsAt',coupon_row.ends_at,'usageLimit',coupon_row.usage_limit,'perUserLimit',coupon_row.per_user_limit);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_upsert_product_export_rule_v1(p_product_id uuid, p_category_id uuid, p_country_code text, p_decision text, p_public_note text, p_internal_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  country_code text:=upper(btrim(coalesce(p_country_code,'')));
  decision_value text:=lower(btrim(coalesce(p_decision,'')));
  rule_row private.product_export_country_rules%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if ((p_product_id is not null)::integer+(p_category_id is not null)::integer)<>1 then raise exception 'exactly_one_export_rule_target_required' using errcode='22023'; end if;
  if country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_country_code' using errcode='22023'; end if;
  if decision_value not in ('allowed','manual_review','restricted','prohibited') then raise exception 'invalid_export_decision' using errcode='22023'; end if;
  if char_length(coalesce(p_public_note,''))>500 or char_length(coalesce(p_internal_note,''))>2000 then raise exception 'export_rule_note_too_long' using errcode='22023'; end if;
  if p_product_id is not null then
    insert into private.product_export_country_rules(product_id,country_code,decision,public_note,internal_note,created_by,updated_by)
    values(p_product_id,country_code,decision_value,coalesce(p_public_note,''),coalesce(p_internal_note,''),caller_id,caller_id)
    on conflict (product_id,country_code) where product_id is not null do update
    set decision=excluded.decision,public_note=excluded.public_note,internal_note=excluded.internal_note,updated_by=caller_id,updated_at=timezone('utc',now())
    returning * into rule_row;
  else
    insert into private.product_export_country_rules(category_id,country_code,decision,public_note,internal_note,created_by,updated_by)
    values(p_category_id,country_code,decision_value,coalesce(p_public_note,''),coalesce(p_internal_note,''),caller_id,caller_id)
    on conflict (category_id,country_code) where category_id is not null do update
    set decision=excluded.decision,public_note=excluded.public_note,internal_note=excluded.internal_note,updated_by=caller_id,updated_at=timezone('utc',now())
    returning * into rule_row;
  end if;
  return jsonb_build_object('id',rule_row.id,'productId',rule_row.product_id,'categoryId',rule_row.category_id,'countryCode',rule_row.country_code,'decision',rule_row.decision,'publicNote',rule_row.public_note);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_producer_location_change_v1(p_request_id uuid, p_approve boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_review_producer_location_change_v1(p_request_id,p_approve,p_reason); $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_producer_payout_v1(p_payout_id uuid, p_status text, p_provider text DEFAULT NULL::text, p_provider_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_update_producer_payout_v1(p_payout_id,p_status,p_provider,p_provider_reference,p_note); $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_product_export_profile_v1(p_product_id uuid, p_export_status text, p_country_of_origin_code text, p_customs_hs_code text, p_customs_description text, p_is_perishable boolean, p_requires_cold_chain boolean, p_shelf_life_days integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_update_product_export_profile_v1(p_product_id,p_export_status,p_country_of_origin_code,p_customs_hs_code,p_customs_description,p_is_perishable,p_requires_cold_chain,p_shelf_life_days); $function$
;

CREATE OR REPLACE FUNCTION public.admin_upsert_coupon_v1(p_id uuid, p_campaign_id uuid, p_code text, p_status text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_usage_limit integer, p_per_user_limit integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_upsert_coupon_v1(p_id,p_campaign_id,p_code,p_status,p_starts_at,p_ends_at,p_usage_limit,p_per_user_limit);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_upsert_product_export_rule_v1(p_product_id uuid, p_category_id uuid, p_country_code text, p_decision text, p_public_note text, p_internal_note text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_upsert_product_export_rule_v1(p_product_id,p_category_id,p_country_code,p_decision,p_public_note,p_internal_note); $function$
;
