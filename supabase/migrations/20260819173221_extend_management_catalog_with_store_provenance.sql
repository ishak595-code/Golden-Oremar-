create or replace function private.management_catalog_snapshot_v2()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  base jsonb:=private.management_catalog_snapshot_v1();
  products_payload jsonb;
  stores_payload jsonb:='[]'::jsonb;
begin
  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'storeKind',coalesce(producer.store_kind,'independent'),
      'provenance',case when provenance.product_id is null then null else jsonb_build_object(
        'sellerModel',provenance.seller_model,
        'sourceMode',provenance.source_mode,
        'sourceDisplayName',provenance.source_display_name,
        'sourceCountryCode',provenance.country_code,
        'sourceProvince',provenance.province,
        'sourceDistrict',provenance.district,
        'sourceVillage',provenance.village,
        'sourceLocality',provenance.locality_detail,
        'originLabel',provenance.origin_label,
        'originVerified',provenance.origin_verified,
        'organicClaim',provenance.organic_claim
      ) end
    ) order by ordinality
  ),'[]'::jsonb)
  into products_payload
  from jsonb_array_elements(coalesce(base->'products','[]'::jsonb)) with ordinality rows(item,ordinality)
  left join public.products product on product.id=(item->>'databaseId')::uuid
  left join public.producers producer on producer.id=product.producer_id
  left join public.product_provenance provenance on provenance.product_id=product.id;

  if base->>'role'='admin' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',producer.id,
      'name',producer.display_name,
      'slug',producer.slug,
      'storeKind',producer.store_kind,
      'verified',producer.is_verified,
      'originVerified',producer.origin_verified,
      'location',jsonb_build_object(
        'countryCode',producer.production_country_code,
        'province',producer.production_province,
        'district',producer.production_district,
        'village',producer.production_village,
        'label',producer.production_location
      )
    ) order by case when producer.store_kind='official' then 0 else 1 end,producer.display_name),'[]'::jsonb)
    into stores_payload
    from public.producers producer
    where producer.deleted_at is null and producer.status='active' and producer.is_verified=true
      and (producer.store_kind='official' or (producer.store_kind='independent' and producer.owner_user_id is not null));
  end if;

  base:=jsonb_set(base,'{products}',products_payload,true);
  return jsonb_set(base,'{stores}',stores_payload,true);
end;
$$;

create or replace function public.management_catalog_snapshot_v1()
returns jsonb language sql set search_path to '' as $$ select private.management_catalog_snapshot_v2(); $$;
