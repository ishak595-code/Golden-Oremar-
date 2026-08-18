create or replace function private.admin_list_products_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb;
  result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  base:=private.admin_list_products_v1();
  select coalesce(jsonb_agg(
    (item - 'primary_image_count')
    || jsonb_build_object(
      'database_primary_image_count',coalesce((item->>'primary_image_count')::integer,0),
      'primary_image_count',asset_metrics.stored_primary_image_count,
      'stored_image_count',asset_metrics.stored_image_count,
      'stored_primary_image_count',asset_metrics.stored_primary_image_count,
      'image_asset_ready',asset_metrics.stored_primary_image_count=1,
      'catalog_issue_count',coalesce((item->>'catalog_issue_count')::integer,0)
        + case
            when coalesce((item->>'primary_image_count')::integer,0)=1 and asset_metrics.stored_primary_image_count<>1 then 1
            else 0
          end
    )
    order by ordinality
  ),'[]'::jsonb)
  into result
  from jsonb_array_elements(coalesce(base,'[]'::jsonb)) with ordinality as rows(item,ordinality)
  cross join lateral (
    select
      count(*) filter(where private.verified_public_storage_path_v1('catalog-public',image.storage_path) is not null)::integer as stored_image_count,
      count(*) filter(where image.is_primary=true and private.verified_public_storage_path_v1('catalog-public',image.storage_path) is not null)::integer as stored_primary_image_count
    from public.product_images image
    where image.product_id=(item->>'id')::uuid
  ) asset_metrics;
  return result;
end;
$$;
