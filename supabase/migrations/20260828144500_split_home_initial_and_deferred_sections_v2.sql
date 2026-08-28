-- Golden Oremar Task 3.6
-- Separate above-the-fold Home data from deferred section payloads.

create or replace function private.home_section_projection_v1(p_section jsonb,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  requested_locale text:=lower(split_part(btrim(coalesce(p_locale,'tr')),'-',1));
  source_kind text;
  collection_key text;
  category_slug_value text;
  display_limit integer;
  section_title text;
  section_items jsonb;
  start_at timestamptz;
  end_at timestamptz;
  now_utc timestamptz:=timezone('utc',now());
begin
  if requested_locale not in ('tr','en','de','fr','ku','ar') then requested_locale:='tr'; end if;
  if p_section is null or jsonb_typeof(p_section)<>'object' or coalesce((p_section->>'active')::boolean,false)=false then return null; end if;
  begin start_at:=nullif(p_section->>'startAt','')::timestamptz; exception when others then return null; end;
  begin end_at:=nullif(p_section->>'endAt','')::timestamptz; exception when others then return null; end;
  if start_at is not null and now_utc<start_at then return null; end if;
  if end_at is not null and now_utc>=end_at then return null; end if;

  source_kind:=coalesce(nullif(p_section#>>'{source,kind}',''),case p_section->>'id'
    when 'featured' then 'featured'
    when 'pre_order' then 'preorder'
    when 'seasonal' then 'seasonal'
    when 'new_arrivals' then 'newest'
    when 'offers' then 'offers'
    else 'curated' end);
  collection_key:=nullif(p_section#>>'{source,collectionKey}','');
  category_slug_value:=nullif(p_section#>>'{source,categorySlug}','');
  display_limit:=least(12,greatest(1,coalesce(nullif(p_section->>'displayLimit','')::integer,6)));
  section_title:=coalesce(nullif(p_section#>>array['localizedTitles',requested_locale],''),nullif(p_section->>'title',''),'Ürünler');

  select coalesce(jsonb_agg(card),'[]'::jsonb) into section_items
  from (
    select row_data.card
    from private.catalog_public_card_rows_v1() row_data
    where case source_kind
      when 'featured' then row_data.is_featured
      when 'preorder' then row_data.stock_mode='preorder'
      when 'seasonal' then row_data.stock_mode='seasonal' or row_data.home_section='seasonal'
      when 'offers' then row_data.compare_at_price_minor is not null and row_data.compare_at_price_minor>row_data.price_minor
      when 'category' then category_slug_value is not null and row_data.category_slug=category_slug_value
      when 'curated' then collection_key is not null and row_data.home_section=collection_key
      when 'newest' then true
      else false
    end
    order by
      case when source_kind='offers' then row_data.compare_at_price_minor-row_data.price_minor end desc nulls last,
      case when source_kind='featured' then row_data.is_featured end desc,
      row_data.published_at desc nulls last,row_data.product_id
    limit display_limit
  ) bounded;

  if jsonb_array_length(section_items)=0 then return null; end if;
  return jsonb_build_object(
    'key',p_section->>'id',
    'type',coalesce(nullif(p_section->>'sectionType',''),'product_carousel'),
    'title',section_title,
    'subtitle',coalesce(p_section->>'subtitle',''),
    'displayLimit',display_limit,
    'source',p_section->'source',
    'items',section_items
  );
end;
$function$;

revoke all on function private.home_section_projection_v1(jsonb,text) from public,anon,authenticated;
grant execute on function private.home_section_projection_v1(jsonb,text) to service_role;

create or replace function private.get_public_home_section_v1(p_key text,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  requested_key text:=btrim(coalesce(p_key,''));
  requested_locale text:=lower(split_part(btrim(coalesce(p_locale,'tr')),'-',1));
  settings public.brand_settings%rowtype;
  section jsonb;
begin
  if requested_key='' or char_length(requested_key)>80 then raise exception 'invalid_home_section_key' using errcode='22023'; end if;
  if requested_locale not in ('tr','en','de','fr','ku','ar') then requested_locale:='tr'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if not found then raise exception 'storefront_configuration_missing' using errcode='P0002'; end if;
  select value into section
  from jsonb_array_elements(coalesce(settings.public_config->'homeSections','[]'::jsonb))
  where value->>'id'=requested_key
  limit 1;
  if section is null then return null; end if;
  return private.home_section_projection_v1(section,requested_locale);
end;
$function$;

revoke all on function private.get_public_home_section_v1(text,text) from public,anon,authenticated;
grant execute on function private.get_public_home_section_v1(text,text) to service_role;

create or replace function api_public_bridge.get_public_home_section_v1(p_key text,p_locale text default 'tr')
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$ select private.get_public_home_section_v1(p_key,p_locale); $function$;

create or replace function public.get_public_home_section_v1(p_key text,p_locale text default 'tr')
returns jsonb
language sql
stable
set search_path=''
as $function$ select api_public_bridge.get_public_home_section_v1(p_key,p_locale); $function$;

revoke all on function api_public_bridge.get_public_home_section_v1(text,text) from public;
grant execute on function api_public_bridge.get_public_home_section_v1(text,text) to anon,authenticated,service_role;
revoke all on function public.get_public_home_section_v1(text,text) from public;
grant execute on function public.get_public_home_section_v1(text,text) to anon,authenticated,service_role;

create or replace function private.get_public_home_experience_v1(p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  requested_locale text:=lower(split_part(btrim(coalesce(p_locale,'tr')),'-',1));
  config jsonb;
  category_rows jsonb;
  section_config jsonb;
  projection jsonb;
  sections jsonb:='[]'::jsonb;
  primary_assigned boolean:=false;
  campaign jsonb;
  now_utc timestamptz:=timezone('utc',now());
begin
  if requested_locale not in ('tr','en','de','fr','ku','ar') then requested_locale:='tr'; end if;
  config:=private.get_public_storefront_config_v1(requested_locale);
  category_rows:=private.list_public_categories_v3();

  for section_config in select value from jsonb_array_elements(coalesce(config->'homeSections','[]'::jsonb)) loop
    projection:=private.home_section_projection_v1(section_config,requested_locale);
    if projection is null then continue; end if;
    if primary_assigned=false then
      sections:=sections||jsonb_build_array(projection||jsonb_build_object('deferred',false));
      primary_assigned:=true;
    else
      sections:=sections||jsonb_build_array((projection-'items')||jsonb_build_object('items','[]'::jsonb,'deferred',true));
    end if;
  end loop;

  select jsonb_build_object(
    'id',campaign_row.id,
    'slug',campaign_row.slug,
    'title',campaign_row.title,
    'description',campaign_row.description,
    'bannerPath',campaign_row.banner_path,
    'startsAt',campaign_row.starts_at,
    'endsAt',campaign_row.ends_at,
    'targetScope',campaign_row.target_scope,
    'targetIds',case campaign_row.target_scope
      when 'products' then coalesce((select jsonb_agg(link.product_id) from public.campaign_products link where link.campaign_id=campaign_row.id),'[]'::jsonb)
      when 'categories' then coalesce((select jsonb_agg(category.slug) from public.campaign_categories link join public.categories category on category.id=link.category_id where link.campaign_id=campaign_row.id and category.is_active=true),'[]'::jsonb)
      else '[]'::jsonb end
  ) into campaign
  from public.campaigns campaign_row
  where campaign_row.status='active'
    and now_utc>=campaign_row.starts_at
    and now_utc<campaign_row.ends_at
  order by campaign_row.starts_at desc,campaign_row.id
  limit 1;

  return jsonb_build_object(
    'version',2,
    'locale',requested_locale,
    'generatedAt',now_utc,
    'updatedAt',config->>'updatedAt',
    'cacheKey','home:'||requested_locale||':'||coalesce(config->>'updatedAt','0'),
    'cachePolicy',jsonb_build_object(
      'compositionMaxAgeSeconds',60,
      'categoriesMaxAgeSeconds',300,
      'productProjectionMaxAgeSeconds',30
    ),
    'brand',config->'brand',
    'interface',config->'interface',
    'search',jsonb_build_object('enabled',true,'voiceEnabled',true),
    'categories',category_rows,
    'categoryOrder',coalesce(config->'heroCategories','[]'::jsonb),
    'sections',sections,
    'campaign',campaign,
    'eventSpotlight',config->'eventSpotlight',
    'salesReadiness',config->'salesReadiness'
  );
end;
$function$;
