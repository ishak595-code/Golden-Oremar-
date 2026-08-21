-- Align public RPC names with the canonical private implementations and remove duplicate client entrypoints.

create or replace function public.get_public_content_entry_v3(p_reference text,p_locale text default 'tr'::text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.get_public_content_entry_v3(p_reference,p_locale);
$function$;

create or replace function public.get_public_home_catalog_v3()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.get_public_home_catalog_v3();
$function$;

create or replace function public.search_catalog_v3(
  p_query text default null::text,
  p_category_slug text default null::text,
  p_producer_id uuid default null::uuid,
  p_province text default null::text,
  p_district text default null::text,
  p_village text default null::text,
  p_min_price_minor bigint default null::bigint,
  p_max_price_minor bigint default null::bigint,
  p_in_stock boolean default false,
  p_featured boolean default null::boolean,
  p_sort text default 'relevance'::text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.search_catalog_v3(
    p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,
    p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset
  );
$function$;

revoke all on function public.get_public_content_entry_v3(text,text) from public;
revoke all on function public.get_public_home_catalog_v3() from public;
revoke all on function public.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public;
grant execute on function public.get_public_content_entry_v3(text,text) to anon,authenticated;
grant execute on function public.get_public_home_catalog_v3() to anon,authenticated;
grant execute on function public.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to anon,authenticated;

drop function if exists public.get_public_content_entry_v1(text,text);
drop function if exists public.get_public_content_entry_v2(text,text);
drop function if exists public.get_public_home_catalog_v1();
drop function if exists public.get_public_home_catalog_v2();
drop function if exists public.get_public_storefront_config_v1(text);
drop function if exists public.list_my_producer_payouts_v1(integer,integer);
drop function if exists private.list_my_producer_payouts_v1(integer,integer);
drop function if exists public.list_my_producer_products_v1();
drop function if exists public.list_public_categories_v1();
drop function if exists public.request_customer_return_v1(uuid,text);
drop function if exists public.request_customer_return_v2(uuid,jsonb,text,text);
drop function if exists public.search_catalog_v1(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer);
drop function if exists public.search_catalog_v2(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer);
drop function if exists public.update_my_producer_profile_v1(text,text,text,text,text,text);
drop function if exists private.update_my_producer_profile_v1(text,text,text,text,text,text);
