create or replace function private.catalog_public_card_image_path_v1(p_product_image_path text,p_producer_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  verified_product_path text;
  producer_row public.producers%rowtype;
begin
  verified_product_path:=private.verified_public_storage_path_v1('catalog-public',p_product_image_path);
  if verified_product_path is not null then return verified_product_path; end if;
  if p_producer_id is null then return null; end if;
  select * into producer_row from public.producers where id=p_producer_id and deleted_at is null and status='active' and is_verified=true;
  if producer_row.id is null or producer_row.store_kind<>'official' then return null; end if;
  return coalesce(
    private.verified_public_storage_path_v1('catalog-public',producer_row.logo_path),
    private.verified_public_storage_path_v1('catalog-public',producer_row.cover_path)
  );
end;
$$;

revoke all on function private.catalog_public_card_image_path_v1(text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.catalog_public_card_image_path_v1(text,uuid) to postgres;

create or replace function private.get_public_home_catalog_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_home_catalog_v1();
  items jsonb;
begin
  select coalesce(jsonb_agg(
    case when resolved.path is null
      then jsonb_set(item,'{imagePath}','null'::jsonb,true)
      else jsonb_set(item,'{imagePath}',to_jsonb(resolved.path),true)
    end
  ),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
  cross join lateral (
    select private.catalog_public_card_image_path_v1(
      item->>'imagePath',
      nullif(item#>>'{producer,id}','')::uuid
    ) path
  ) resolved;
  return jsonb_set(base,'{items}',items,true);
end;
$$;

create or replace function private.search_catalog_v2(
  p_query text default null,p_category_slug text default null,p_producer_id uuid default null,
  p_province text default null,p_district text default null,p_village text default null,
  p_min_price_minor bigint default null,p_max_price_minor bigint default null,p_in_stock boolean default false,
  p_featured boolean default null,p_sort text default 'relevance',p_limit integer default 20,p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb;
  items jsonb;
begin
  base:=private.search_catalog_v1(p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset);
  select coalesce(jsonb_agg(
    case when resolved.path is null
      then jsonb_set(item,'{imagePath}','null'::jsonb,true)
      else jsonb_set(item,'{imagePath}',to_jsonb(resolved.path),true)
    end
  ),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
  cross join lateral (
    select private.catalog_public_card_image_path_v1(
      item->>'imagePath',
      nullif(item#>>'{producer,id}','')::uuid
    ) path
  ) resolved;
  return jsonb_set(base,'{items}',items,true);
end;
$$;
