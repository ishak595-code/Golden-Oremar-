create or replace function private.list_my_producer_products_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.list_my_producer_products_v1();
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(product_item,'{images}',coalesce(asset_images.images,'[]'::jsonb),true)
    order by product_ordinality
  ),'[]'::jsonb)
  into result
  from jsonb_array_elements(coalesce(base,'[]'::jsonb)) with ordinality as products(product_item,product_ordinality)
  cross join lateral (
    select coalesce(jsonb_agg(
      jsonb_set(image_item,'{path}',to_jsonb(verified_path),true)
      order by image_ordinality
    ) filter(where verified_path is not null),'[]'::jsonb) as images
    from jsonb_array_elements(coalesce(product_item->'images','[]'::jsonb)) with ordinality as image_rows(image_item,image_ordinality)
    cross join lateral (
      select private.verified_public_storage_path_v1('catalog-public',image_item->>'path') as verified_path
    ) verified
  ) asset_images;
  return result;
end;
$$;

revoke all on function private.list_my_producer_products_v2() from public,anon;
grant execute on function private.list_my_producer_products_v2() to authenticated;

create or replace function public.list_my_producer_products_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_my_producer_products_v2(); $$;
revoke all on function public.list_my_producer_products_v1() from public,anon;
grant execute on function public.list_my_producer_products_v1() to authenticated;
