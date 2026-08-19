create or replace function private.get_public_product_detail_v2(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  base jsonb:=private.get_public_product_detail_v1(p_reference);
  images jsonb;
  producer jsonb;
  logo_path text;
  cover_path text;
  v_product_id uuid;
  provenance jsonb;
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
  if v_product_id is not null then
    select jsonb_build_object(
      'sellerModel',pp.seller_model,'sourceMode',pp.source_mode,'sourceDisplayName',pp.source_display_name,
      'origin',jsonb_build_object('countryCode',pp.country_code,'province',pp.province,'district',pp.district,'village',pp.village,'localityDetail',pp.locality_detail,'label',pp.origin_label),
      'originVerified',pp.origin_verified,'organicClaim',pp.organic_claim,'publicNote',pp.public_note
    ) into provenance
    from public.product_provenance pp where pp.product_id=v_product_id;
  end if;
  producer:=jsonb_set(producer,'{storeKind}',to_jsonb(coalesce((select p.store_kind from public.producers p where p.id=(producer->>'id')::uuid),'independent')),true);
  base:=jsonb_set(base,'{producer}',producer,true);
  return jsonb_set(base,'{provenance}',coalesce(provenance,'null'::jsonb),true);
end;
$$;
