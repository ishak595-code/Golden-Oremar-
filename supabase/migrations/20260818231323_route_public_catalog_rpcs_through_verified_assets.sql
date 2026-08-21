create or replace function private.get_public_storefront_config_v2(p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_storefront_config_v1(p_locale);
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

create or replace function public.get_public_home_catalog_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_home_catalog_v2(); $$;

create or replace function public.search_catalog_v1(
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

create or replace function public.get_public_product_detail_v1(p_reference text)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_product_detail_v2(p_reference); $$;

create or replace function public.get_public_producer_profile_v2(p_reference text)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_producer_profile_v3(p_reference); $$;

create or replace function public.list_public_categories_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_public_categories_v2(); $$;

create or replace function public.get_public_storefront_config_v1(p_locale text default 'tr')
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_storefront_config_v2(p_locale); $$;

revoke all on function public.get_public_home_catalog_v1() from public;
revoke all on function public.search_catalog_v1(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public;
revoke all on function public.get_public_product_detail_v1(text) from public;
revoke all on function public.get_public_producer_profile_v2(text) from public;
revoke all on function public.list_public_categories_v1() from public;
revoke all on function public.get_public_storefront_config_v1(text) from public;
grant execute on function public.get_public_home_catalog_v1() to anon,authenticated;
grant execute on function public.search_catalog_v1(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to anon,authenticated;
grant execute on function public.get_public_product_detail_v1(text) to anon,authenticated;
grant execute on function public.get_public_producer_profile_v2(text) to anon,authenticated;
grant execute on function public.list_public_categories_v1() to anon,authenticated;
grant execute on function public.get_public_storefront_config_v1(text) to anon,authenticated;
