create or replace function private.get_public_product_detail_v2(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  base jsonb:=private.get_public_product_detail_v1(p_reference);
  images jsonb;
  producer jsonb;
  logo_path text;
  cover_path text;
  v_product_id uuid;
  v_producer_id uuid;
  v_store_kind text:='independent';
  v_storefront_tier text:='standard';
  v_origin_verified boolean:=false;
  v_producer_verified boolean:=false;
  provenance jsonb;
  trust_badges jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(image,'{path}',to_jsonb(private.verified_public_storage_path_v1('catalog-public',image->>'path')),true)
    order by ordinality
  ) filter(where private.verified_public_storage_path_v1('catalog-public',image->>'path') is not null),'[]'::jsonb)
  into images
  from jsonb_array_elements(coalesce(base->'images','[]'::jsonb)) with ordinality as rows(image,ordinality);
  base:=jsonb_set(base,'{images}',images,true);

  producer:=coalesce(base->'producer','{}'::jsonb);
  logo_path:=private.verified_public_storage_path_v1('catalog-public',producer->>'logoPath');
  cover_path:=private.verified_public_storage_path_v1('catalog-public',producer->>'coverPath');
  producer:=jsonb_set(producer,'{logoPath}',coalesce(to_jsonb(logo_path),'null'::jsonb),true);
  producer:=jsonb_set(producer,'{coverPath}',coalesce(to_jsonb(cover_path),'null'::jsonb),true);

  begin v_product_id:=(base->>'id')::uuid; exception when others then v_product_id:=null; end;
  begin v_producer_id:=(producer->>'id')::uuid; exception when others then v_producer_id:=null; end;

  if v_producer_id is not null then
    select p.store_kind,p.storefront_tier,
           case when p.store_kind='official' then p.origin_verified else p.origin_verified and private.is_producer_trust_badge_active_v1(p.id) end,
           case when p.store_kind='official' then true else private.is_producer_trust_badge_active_v1(p.id) end
    into v_store_kind,v_storefront_tier,v_origin_verified,v_producer_verified
    from public.producers p
    where p.id=v_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
  end if;

  producer:=jsonb_set(producer,'{storeKind}',to_jsonb(coalesce(v_store_kind,'independent')),true);
  producer:=jsonb_set(producer,'{storefrontTier}',to_jsonb(coalesce(v_storefront_tier,'standard')),true);
  producer:=jsonb_set(producer,'{badgeTone}',to_jsonb(case when v_store_kind='official' then 'emerald' else 'blue' end),true);
  producer:=jsonb_set(producer,'{verified}',to_jsonb(coalesce(v_producer_verified,false)),true);
  producer:=jsonb_set(producer,'{originVerified}',to_jsonb(coalesce(v_origin_verified,false)),true);

  if v_product_id is not null then
    select jsonb_build_object(
      'sellerModel',pp.seller_model,
      'sourceMode',pp.source_mode,
      'sourceDisplayName',pp.source_display_name,
      'origin',jsonb_build_object(
        'countryCode',pp.country_code,
        'province',pp.province,
        'district',pp.district,
        'village',pp.village,
        'localityDetail',pp.locality_detail,
        'label',pp.origin_label
      ),
      'originVerified',pp.origin_verified,
      'organicClaim',pp.organic_claim,
      'publicNote',pp.public_note
    ) into provenance
    from public.product_provenance pp
    where pp.product_id=v_product_id;
  end if;

  if v_store_kind='official' then
    trust_badges:=jsonb_build_array(
      jsonb_build_object('key','official_store','label','Golden Oremar Resmi Mağazası','active',true,'tone','emerald'),
      jsonb_build_object('key','verified_origin','label','Menşe doğrulandı','active',coalesce((provenance->>'originVerified')::boolean,v_origin_verified,false),'tone','emerald'),
      jsonb_build_object('key','batch_traceable','label','Lot/QR ile izlenebilir','active',exists(select 1 from public.product_batches b where b.product_id=v_product_id and b.status='released'),'tone','gold'),
      jsonb_build_object('key','certified_organic','label','Sertifikalı organik','active',exists(select 1 from public.product_certifications c where c.product_id=v_product_id and c.status='valid' and lower(c.certificate_type) in ('organic','organic_certificate','certified_organic') and (c.expires_at is null or c.expires_at>=current_date)),'tone','emerald')
    );
  else
    trust_badges:=jsonb_build_array(
      jsonb_build_object('key','verified_producer','label','Golden Oremar Doğrulanmış Üretici','active',coalesce(v_producer_verified,false),'tone','blue'),
      jsonb_build_object('key','verified_origin','label','Menşe ve üretim yeri doğrulandı','active',coalesce((provenance->>'originVerified')::boolean,v_origin_verified,false),'tone','blue'),
      jsonb_build_object('key','batch_traceable','label','Lot/QR ile izlenebilir','active',exists(select 1 from public.product_batches b where b.product_id=v_product_id and b.status='released'),'tone','gold'),
      jsonb_build_object('key','certified_organic','label','Sertifikalı organik','active',exists(select 1 from public.product_certifications c where c.product_id=v_product_id and c.status='valid' and lower(c.certificate_type) in ('organic','organic_certificate','certified_organic') and (c.expires_at is null or c.expires_at>=current_date)),'tone','emerald')
    );
  end if;

  base:=jsonb_set(base,'{producer}',producer,true);
  base:=jsonb_set(base,'{trustBadges}',trust_badges,true);
  return jsonb_set(base,'{provenance}',coalesce(provenance,'null'::jsonb),true);
end;
$$;
