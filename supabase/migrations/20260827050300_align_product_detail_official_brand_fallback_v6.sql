create or replace function private.get_public_product_detail_v8(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_product_detail_v7(p_reference);
  images jsonb;
  producer_id uuid;
  fallback_path text;
  product_name text;
begin
  if base='{}'::jsonb then return base; end if;
  images:=coalesce(base->'images','[]'::jsonb);
  if jsonb_typeof(images)='array' and jsonb_array_length(images)>0 then return base; end if;
  begin producer_id:=nullif(base#>>'{producer,id}','')::uuid; exception when others then producer_id:=null; end;
  fallback_path:=private.catalog_public_card_image_path_v1(null,producer_id);
  if fallback_path is null then return base; end if;
  product_name:=nullif(btrim(coalesce(base->>'name','')),'');
  images:=jsonb_build_array(jsonb_build_object(
    'path',fallback_path,
    'alt',coalesce(product_name||' · Golden Oremar resmi mağaza görseli','Golden Oremar resmi mağaza görseli'),
    'width',null,
    'height',null,
    'primary',true,
    'source','official_brand_fallback'
  ));
  return jsonb_set(base,'{images}',images,true);
end;
$$;

revoke all on function private.get_public_product_detail_v8(text) from public,anon,authenticated,service_role;
grant execute on function private.get_public_product_detail_v8(text) to postgres;

create or replace function api_public_bridge.get_public_product_detail_v6(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select private.get_public_product_detail_v8(p_reference); $$;
