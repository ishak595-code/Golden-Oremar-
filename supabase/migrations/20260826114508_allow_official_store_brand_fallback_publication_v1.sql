create or replace function private.product_media_integrity_ok_v1(p_product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  image_count integer:=0;
  primary_count integer:=0;
  all_valid boolean:=false;
  product_store_kind text;
begin
  if p_product_id is null then return false; end if;

  select producer.store_kind
    into product_store_kind
  from public.products product
  join public.producers producer on producer.id=product.producer_id
  where product.id=p_product_id
    and product.deleted_at is null
    and producer.deleted_at is null;

  if product_store_kind is null then return false; end if;

  select count(*)::integer,
         count(*) filter(where image.is_primary)::integer,
         coalesce(bool_and(private.verified_catalog_product_image_path_v1(image.storage_path) is not null),false)
    into image_count,primary_count,all_valid
  from public.product_images image
  where image.product_id=p_product_id;

  if image_count=0 then
    return product_store_kind='official';
  end if;

  return image_count between 1 and 10
    and primary_count=1
    and all_valid;
end;
$$;

revoke all on function private.product_media_integrity_ok_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function private.product_media_integrity_ok_v1(uuid) to postgres;
