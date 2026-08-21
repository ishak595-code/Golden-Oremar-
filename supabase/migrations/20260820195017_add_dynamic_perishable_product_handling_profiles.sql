update public.products
set specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{productType}',to_jsonb('red_meat'::text),true),updated_at=timezone('utc',now())
where slug in ('abidin-in-yayla-kuzusu-302','fahrettin-in-sutten-kesilmis-oglagi-303');

update public.products
set specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{productType}',to_jsonb('fish'::text),true),updated_at=timezone('utc',now())
where slug='avasin-deresi-canli-alabaligi-ozel-hasat-301';

update public.products
set specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{productType}',to_jsonb('egg'::text),true),updated_at=timezone('utc',now())
where slug='amine-nin-cifte-sari-koy-yumurtasi-305';

update public.products
set specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{productType}',to_jsonb('poultry'::text),true),updated_at=timezone('utc',now())
where slug='salih-in-meralik-ozgur-horozu-304';

update public.products
set specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{productType}',to_jsonb('animal_fat'::text),true),updated_at=timezone('utc',now())
where slug='gunes-sirri-guzu-yagi-ic-yag-701';

create or replace function private.product_handling_profile_v1(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'productType',case when p.specifications->>'productType' in ('fish','red_meat','poultry','egg','animal_fat','dairy','produce','pantry','beverage','non_food') then p.specifications->>'productType' else null end,
    'isPerishable',coalesce(p.is_perishable,false),
    'requiresColdChain',coalesce(p.requires_cold_chain,false),
    'shelfLifeDays',p.shelf_life_days
  )
  from public.products p
  where p.id=p_product_id and p.deleted_at is null;
$$;
revoke all on function private.product_handling_profile_v1(uuid) from public,anon,authenticated;
grant execute on function private.product_handling_profile_v1(uuid) to postgres,service_role;

create or replace function private.decorate_catalog_handling_v1(p_base jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare items jsonb;
begin
  select coalesce(jsonb_agg(
    item || jsonb_build_object('handlingProfile',coalesce(private.product_handling_profile_v1((item->>'id')::uuid),'null'::jsonb))
  ),'[]'::jsonb)
  into items
  from jsonb_array_elements(coalesce(p_base->'items','[]'::jsonb)) item;
  return jsonb_set(p_base,'{items}',items,true);
end;
$$;
revoke all on function private.decorate_catalog_handling_v1(jsonb) from public,anon,authenticated;
grant execute on function private.decorate_catalog_handling_v1(jsonb) to postgres,service_role;

create or replace function private.get_public_home_catalog_v3()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select private.decorate_catalog_handling_v1(private.get_public_home_catalog_v2()); $$;
revoke all on function private.get_public_home_catalog_v3() from public;
grant execute on function private.get_public_home_catalog_v3() to postgres,anon,authenticated,service_role;

create or replace function private.search_catalog_v3(
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
security definer
set search_path=''
as $$
  select private.decorate_catalog_handling_v1(private.search_catalog_v2(
    p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,
    p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset
  ));
$$;
revoke all on function private.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public;
grant execute on function private.search_catalog_v3(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to postgres,anon,authenticated,service_role;

create or replace function public.get_public_home_catalog_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_home_catalog_v3(); $$;

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
as $$
  select private.search_catalog_v3(
    p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,
    p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset
  );
$$;

create or replace function private.get_public_product_detail_v7(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare base jsonb:=private.get_public_product_detail_v6(p_reference); profile jsonb;
begin
  if base='{}'::jsonb then return base; end if;
  profile:=private.product_handling_profile_v1((base->>'id')::uuid);
  return jsonb_set(base,'{handlingProfile}',coalesce(profile,'null'::jsonb),true);
end;
$$;
revoke all on function private.get_public_product_detail_v7(text) from public;
grant execute on function private.get_public_product_detail_v7(text) to postgres,anon,authenticated,service_role;

create or replace function public.get_public_product_detail_v6(p_reference text)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_product_detail_v7(p_reference); $$;
