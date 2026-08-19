create or replace function private.management_upsert_product_v2(p_reference text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  caller_id uuid:=auth.uid();
  v_product_id uuid:=private.resolve_product_id_v1(p_reference);
  product_row public.products%rowtype;
  producer_row public.producers%rowtype;
  existing_provenance public.product_provenance%rowtype;
  safe_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  result jsonb;
  requested_vendor_raw text;
  selected_producer_id uuid;
  requested_publish boolean:=false;
  source_mode_value text;
  source_name_value text;
  source_country text;
  source_province text;
  source_district text;
  source_village text;
  source_locality text;
  origin_label_value text;
  origin_verified_value boolean;
  organic_claim_value text;
  app_organic_claim text;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>262144 then raise exception 'invalid_product_payload' using errcode='22023'; end if;
  if p_payload ? 'originVerified' and jsonb_typeof(p_payload->'originVerified')<>'boolean' then raise exception 'invalid_origin_verification' using errcode='22023'; end if;
  if char_length(coalesce(p_payload->>'sourceDisplayName',''))>180 or char_length(coalesce(p_payload->>'sourceLocality',''))>160 or char_length(coalesce(p_payload->>'originLabel',''))>500 then raise exception 'invalid_provenance_field_length' using errcode='22023'; end if;
  if char_length(coalesce(p_payload->>'sourceProvince',''))>120 or char_length(coalesce(p_payload->>'sourceDistrict',''))>120 or char_length(coalesce(p_payload->>'sourceVillage',''))>120 then raise exception 'invalid_provenance_location_length' using errcode='22023'; end if;
  requested_publish:=coalesce((p_payload->>'is_approved')::boolean,false);
  safe_payload:=safe_payload-'is_approved';

  if v_product_id is null then
    requested_vendor_raw:=nullif(btrim(coalesce(p_payload->>'vendor_id','')),'');
    if requested_vendor_raw is null then
      select p.id into selected_producer_id from public.producers p where p.store_kind='official' and p.slug='golden-oremar' and p.status='active' and p.is_verified=true and p.deleted_at is null limit 1;
      if selected_producer_id is null then raise exception 'official_store_not_ready' using errcode='55000'; end if;
    else
      begin selected_producer_id:=requested_vendor_raw::uuid; exception when others then raise exception 'invalid_producer_id' using errcode='22023'; end;
      if not exists(select 1 from public.producers p where p.id=selected_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null) then raise exception 'producer_not_found' using errcode='P0002'; end if;
    end if;
  else
    select p.producer_id into selected_producer_id from public.products p where p.id=v_product_id and p.deleted_at is null;
    if selected_producer_id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
    if p_payload ? 'vendor_id' and nullif(btrim(coalesce(p_payload->>'vendor_id','')),'') is not null and (p_payload->>'vendor_id')::uuid is distinct from selected_producer_id then
      raise exception 'existing_product_seller_cannot_be_changed' using errcode='55000';
    end if;
  end if;

  select * into producer_row from public.producers p where p.id=selected_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
  if producer_row.id is null then raise exception 'verified_active_producer_required' using errcode='55000'; end if;
  safe_payload:=jsonb_set(safe_payload,'{vendor_id}',to_jsonb(selected_producer_id::text),true);
  select * into existing_provenance from public.product_provenance pp where pp.product_id=v_product_id;

  if producer_row.store_kind='official' then
    source_mode_value:=coalesce(nullif(btrim(p_payload->>'sourceMode'),''),nullif(existing_provenance.source_mode,''),'platform_village_catalog');
    if source_mode_value not in ('platform_village_catalog','platform_direct','village_partner') then raise exception 'invalid_official_store_source_mode' using errcode='22023'; end if;
    source_name_value:=coalesce(nullif(btrim(p_payload->>'sourceDisplayName'),''),nullif(existing_provenance.source_display_name,''),case when source_mode_value='village_partner' then null else 'Golden Oremar Resmi Mağazası' end);
    if source_mode_value='village_partner' and char_length(coalesce(source_name_value,''))<2 then raise exception 'village_partner_name_required' using errcode='22023'; end if;
    source_country:=upper(coalesce(nullif(btrim(p_payload->>'sourceCountryCode'),''),nullif(existing_provenance.country_code,''),producer_row.production_country_code));
    source_province:=coalesce(nullif(btrim(p_payload->>'sourceProvince'),''),nullif(existing_provenance.province,''),producer_row.production_province);
    source_district:=coalesce(nullif(btrim(p_payload->>'sourceDistrict'),''),nullif(existing_provenance.district,''),producer_row.production_district);
    source_village:=coalesce(nullif(btrim(p_payload->>'sourceVillage'),''),nullif(existing_provenance.village,''),producer_row.production_village);
    source_locality:=coalesce(nullif(btrim(p_payload->>'sourceLocality'),''),nullif(existing_provenance.locality_detail,''),case when source_village='Yeşiltaş' then 'Dağlıca' else null end);
    if source_country is null or source_country !~ '^[A-Z]{2}$' or char_length(coalesce(source_province,''))<2 or char_length(coalesce(source_district,''))<2 or char_length(coalesce(source_village,''))<2 then raise exception 'complete_product_source_location_required' using errcode='22023'; end if;
    origin_label_value:=coalesce(nullif(btrim(p_payload->>'originLabel'),''),case when p_payload ? 'sourceProvince' or p_payload ? 'sourceDistrict' or p_payload ? 'sourceVillage' or p_payload ? 'sourceLocality' then null else nullif(existing_provenance.origin_label,'') end,
      concat_ws(', ',concat_ws(' - ',source_locality,source_village||' Köyü'),source_district,source_province));
    origin_verified_value:=case when p_payload ? 'originVerified' then (p_payload->>'originVerified')::boolean when v_product_id is not null and existing_provenance.product_id is not null then existing_provenance.origin_verified when source_mode_value='village_partner' then false else coalesce(producer_row.origin_verified,false) end;
    organic_claim_value:=coalesce(nullif(btrim(p_payload->>'organicClaim'),''),nullif(existing_provenance.organic_claim,''),'producer_declared_organic');
    if organic_claim_value not in ('producer_declared_organic','certification_in_progress','certified_organic','not_claimed') then raise exception 'invalid_organic_claim' using errcode='22023'; end if;
  else
    source_mode_value:='independent_producer';
    source_name_value:=producer_row.display_name;
    source_country:=producer_row.production_country_code;
    source_province:=producer_row.production_province;
    source_district:=producer_row.production_district;
    source_village:=producer_row.production_village;
    source_locality:=null;
    origin_label_value:=producer_row.production_location;
    origin_verified_value:=coalesce(producer_row.origin_verified,false) and private.is_producer_trust_badge_active_v1(producer_row.id);
    select pa.organic_claim into app_organic_claim from public.producer_applications pa where pa.id=producer_row.application_id and pa.status='approved';
    organic_claim_value:=case when app_organic_claim='certification_in_progress' then 'certification_in_progress' when app_organic_claim='certified' then 'producer_declared_organic' else 'not_claimed' end;
    if source_country is null or source_country !~ '^[A-Z]{2}$' or char_length(coalesce(source_province,''))<2 or char_length(coalesce(source_district,''))<2 or char_length(coalesce(source_village,''))<2 or char_length(coalesce(origin_label_value,''))<2 then raise exception 'producer_origin_incomplete' using errcode='55000'; end if;
  end if;

  safe_payload:=jsonb_set(safe_payload,'{origin}',to_jsonb(origin_label_value),true);
  result:=private.management_upsert_product_v1(p_reference,safe_payload);
  begin v_product_id:=(result->>'databaseId')::uuid; exception when others then raise exception 'product_write_result_invalid' using errcode='55000'; end;
  select * into product_row from public.products p where p.id=v_product_id and p.deleted_at is null for update;
  if product_row.id is null then raise exception 'product_not_found_after_write' using errcode='55000'; end if;

  if organic_claim_value='certified_organic' and not exists(
    select 1 from public.product_certifications c where c.product_id=v_product_id and c.status='valid' and lower(c.certificate_type) in ('organic','organic_certificate','certified_organic') and (c.expires_at is null or c.expires_at>=current_date)
  ) then raise exception 'valid_product_organic_certificate_required' using errcode='55000'; end if;

  insert into public.product_provenance(product_id,seller_model,source_mode,source_producer_id,source_display_name,country_code,province,district,village,locality_detail,origin_label,origin_verified,organic_claim,public_note)
  values(v_product_id,case when producer_row.store_kind='official' then 'official_store' else 'independent_producer' end,source_mode_value,producer_row.id,source_name_value,source_country,source_province,source_district,source_village,source_locality,origin_label_value,origin_verified_value,organic_claim_value,
    case when producer_row.store_kind='official' then 'Golden Oremar resmi mağazası tarafından yönetilen ürün. Ürünün gerçek kaynak ve menşe bilgisi bu kayıt üzerinden izlenir; sertifikalı organik ibaresi yalnız geçerli sertifika varsa kullanılır.' else 'Bağımsız doğrulanmış üretici ürünü.' end)
  on conflict(product_id) do update set seller_model=excluded.seller_model,source_mode=excluded.source_mode,source_producer_id=excluded.source_producer_id,source_display_name=excluded.source_display_name,country_code=excluded.country_code,province=excluded.province,district=excluded.district,village=excluded.village,locality_detail=excluded.locality_detail,origin_label=excluded.origin_label,origin_verified=excluded.origin_verified,organic_claim=excluded.organic_claim,public_note=excluded.public_note,updated_at=timezone('utc',now());

  if product_row.status='published' and origin_verified_value is not true then raise exception 'published_product_origin_must_remain_verified' using errcode='55000'; end if;
  if requested_publish then
    if char_length(btrim(product_row.name))<2 or char_length(btrim(product_row.description))<20 or char_length(btrim(product_row.story))<20 then raise exception 'product_content_incomplete' using errcode='55000'; end if;
    if origin_verified_value is not true then raise exception 'verified_product_origin_required' using errcode='55000'; end if;
    if not exists(select 1 from public.product_variants v where v.product_id=v_product_id and v.is_active=true and v.price_minor>0) then raise exception 'active_priced_variant_required' using errcode='55000'; end if;
    if not exists(select 1 from public.product_images i where i.product_id=v_product_id and i.is_primary=true and private.verified_public_storage_path_v1('catalog-public',i.storage_path) is not null) then raise exception 'stored_primary_product_image_required' using errcode='55000'; end if;
    result:=private.management_upsert_product_v1(v_product_id::text,jsonb_build_object('is_approved',true));
  end if;
  return result||jsonb_build_object('storeKind',producer_row.store_kind,'producerId',producer_row.id,'provenance',jsonb_build_object('sellerModel',case when producer_row.store_kind='official' then 'official_store' else 'independent_producer' end,'sourceMode',source_mode_value,'sourceDisplayName',source_name_value,'originLabel',origin_label_value,'originVerified',origin_verified_value,'organicClaim',organic_claim_value));
end;
$$;

create or replace function public.management_upsert_product_v1(p_reference text,p_payload jsonb)
returns jsonb language plpgsql set search_path to '' as $$
declare weight_value numeric;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  return private.management_upsert_product_v2(p_reference,p_payload);
end;
$$;
