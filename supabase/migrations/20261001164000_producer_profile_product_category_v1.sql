-- Store page: each product carries its category slug, so the store's
-- category chips can filter the product list (they were labels only).
-- Everything else in the answer is unchanged.

CREATE OR REPLACE FUNCTION private.get_public_producer_profile_v3(p_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  base jsonb:=private.get_public_producer_profile_v2(p_reference);
  products jsonb;
  logo_path text;
  cover_path text;
begin
  select coalesce(jsonb_agg(
    jsonb_set(product_item,'{image_path}',coalesce(to_jsonb(private.verified_public_storage_path_v1('catalog-public',product_item->>'image_path')),'null'::jsonb),true)
    || jsonb_build_object('category_slug',(select category.slug from public.products product join public.categories category on category.id=product.category_id where product.id=(product_item->>'id')::uuid))
    order by ordinality
  ),'[]'::jsonb) into products
  from jsonb_array_elements(coalesce(base->'products','[]'::jsonb)) with ordinality as rows(product_item,ordinality);
  base:=jsonb_set(base,'{products}',products,true);
  logo_path:=private.verified_public_storage_path_v1('catalog-public',base->>'logo_path');
  cover_path:=private.verified_public_storage_path_v1('catalog-public',base->>'cover_path');
  base:=jsonb_set(base,'{logo_path}',coalesce(to_jsonb(logo_path),'null'::jsonb),true);
  base:=jsonb_set(base,'{cover_path}',coalesce(to_jsonb(cover_path),'null'::jsonb),true);
  return base;
end;
$function$;
