create or replace function private.verified_public_storage_path_v1(p_bucket text,p_path text)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  bucket_name text:=btrim(coalesce(p_bucket,''));
  raw_path text:=btrim(coalesce(p_path,''));
  normalized text;
begin
  if bucket_name not in ('catalog-public','content-public') then return null; end if;
  if raw_path='' or raw_path ~ '[[:cntrl:]]' or raw_path ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' then return null; end if;
  normalized:=regexp_replace(raw_path,'^/+','','g');
  if normalized='' or normalized like '%../%' or normalized like '../%' or normalized like '%/..' or normalized like '%/./%' then return null; end if;
  if exists(select 1 from storage.objects o where o.bucket_id=bucket_name and o.name=normalized) then return normalized; end if;
  return null;
end;
$$;
revoke all on function private.verified_public_storage_path_v1(text,text) from public,anon,authenticated;

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
    case when private.verified_public_storage_path_v1('catalog-public',item->>'imagePath') is null
      then jsonb_set(item,'{imagePath}','null'::jsonb,true)
      else jsonb_set(item,'{imagePath}',to_jsonb(private.verified_public_storage_path_v1('catalog-public',item->>'imagePath')),true)
    end
  ),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item;
  return jsonb_set(base,'{items}',items,true);
end;
$$;
revoke all on function private.get_public_home_catalog_v2() from public,anon;
grant execute on function private.get_public_home_catalog_v2() to authenticated,anon;

create or replace function public.get_public_home_catalog_v2()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_home_catalog_v2(); $$;
grant execute on function public.get_public_home_catalog_v2() to anon,authenticated;

create or replace function private.search_catalog_v2(
  p_query text default null,
  p_category_slug text default null,
  p_producer_id uuid default null,
  p_province text default null,
  p_district text default null,
  p_village text default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_in_stock boolean default false,
  p_featured boolean default null,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
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
    case when private.verified_public_storage_path_v1('catalog-public',item->>'imagePath') is null
      then jsonb_set(item,'{imagePath}','null'::jsonb,true)
      else jsonb_set(item,'{imagePath}',to_jsonb(private.verified_public_storage_path_v1('catalog-public',item->>'imagePath')),true)
    end
  ),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item;
  return jsonb_set(base,'{items}',items,true);
end;
$$;
revoke all on function private.search_catalog_v2(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public,anon;
grant execute on function private.search_catalog_v2(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to authenticated,anon;

create or replace function public.search_catalog_v2(
  p_query text default null,
  p_category_slug text default null,
  p_producer_id uuid default null,
  p_province text default null,
  p_district text default null,
  p_village text default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_in_stock boolean default false,
  p_featured boolean default null,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.search_catalog_v2(p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset); $$;
grant execute on function public.search_catalog_v2(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to anon,authenticated;

create or replace function private.get_public_product_detail_v2(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_product_detail_v1(p_reference);
  images jsonb;
  producer jsonb;
  logo_path text;
  cover_path text;
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
  return jsonb_set(base,'{producer}',producer,true);
end;
$$;
revoke all on function private.get_public_product_detail_v2(text) from public,anon;
grant execute on function private.get_public_product_detail_v2(text) to authenticated,anon;

create or replace function public.get_public_product_detail_v2(p_reference text)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_product_detail_v2(p_reference); $$;
grant execute on function public.get_public_product_detail_v2(text) to anon,authenticated;

create or replace function private.get_public_producer_profile_v3(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_producer_profile_v2(p_reference);
  products jsonb;
  logo_path text;
  cover_path text;
begin
  select coalesce(jsonb_agg(
    jsonb_set(product_item,'{image_path}',coalesce(to_jsonb(private.verified_public_storage_path_v1('catalog-public',product_item->>'image_path')),'null'::jsonb),true)
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
$$;
revoke all on function private.get_public_producer_profile_v3(text) from public,anon;
grant execute on function private.get_public_producer_profile_v3(text) to authenticated,anon;

create or replace function public.get_public_producer_profile_v3(p_reference text)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_producer_profile_v3(p_reference); $$;
grant execute on function public.get_public_producer_profile_v3(text) to anon,authenticated;

create or replace function private.list_public_categories_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.list_public_categories_v1();
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(item,'{imagePath}',coalesce(to_jsonb(private.verified_public_storage_path_v1('catalog-public',item->>'imagePath')),'null'::jsonb),true)
    order by ordinality
  ),'[]'::jsonb) into result
  from jsonb_array_elements(coalesce(base,'[]'::jsonb)) with ordinality as rows(item,ordinality);
  return result;
end;
$$;
revoke all on function private.list_public_categories_v2() from public,anon;
grant execute on function private.list_public_categories_v2() to authenticated,anon;

create or replace function public.list_public_categories_v2()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_public_categories_v2(); $$;
grant execute on function public.list_public_categories_v2() to anon,authenticated;

create or replace function private.get_public_storefront_config_v2(p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=public.get_public_storefront_config_v1(p_locale);
  hero jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(item,'{image}',coalesce(to_jsonb(private.verified_public_storage_path_v1('catalog-public',item->>'image')),'null'::jsonb),true)
    order by ordinality
  ),'[]'::jsonb) into hero
  from jsonb_array_elements(coalesce(base->'heroCategories','[]'::jsonb)) with ordinality as rows(item,ordinality);
  return jsonb_set(base,'{heroCategories}',hero,true);
end;
$$;
revoke all on function private.get_public_storefront_config_v2(text) from public,anon;
grant execute on function private.get_public_storefront_config_v2(text) to authenticated,anon;

create or replace function public.get_public_storefront_config_v2(p_locale text default 'tr')
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_storefront_config_v2(p_locale); $$;
grant execute on function public.get_public_storefront_config_v2(text) to anon,authenticated;
