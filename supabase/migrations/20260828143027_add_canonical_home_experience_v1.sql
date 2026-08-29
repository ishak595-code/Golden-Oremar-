-- Golden Oremar Task 3.6
-- Canonical commerce card projection, catalog v4 and bounded Home experience v1.

create or replace function private.catalog_public_card_rows_v1()
returns table(
  product_id uuid,
  category_id uuid,
  category_slug text,
  category_name text,
  producer_id uuid,
  producer_name text,
  province text,
  district text,
  village text,
  product_name text,
  product_search_text text,
  price_minor bigint,
  compare_at_price_minor bigint,
  stock_mode text,
  available_quantity integer,
  is_featured boolean,
  published_at timestamptz,
  home_section text,
  average_rating numeric,
  review_count bigint,
  card jsonb
)
language sql
stable
security definer
set search_path=''
as $function$
  select
    product.id,
    category.id,
    category.slug,
    category.name,
    producer.id,
    producer.display_name,
    producer.production_province,
    producer.production_district,
    producer.production_village,
    product.name,
    lower(coalesce(product.search_text,'')),
    variant.price_minor,
    variant.compare_at_price_minor,
    product.stock_mode,
    case
      when product.stock_mode in ('tracked','seasonal')
        then greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0))
      else null
    end,
    product.is_featured,
    product.published_at,
    case
      when nullif(product.specifications->>'homeSection','') in ('natural','seasonal','best_sellers','new_arrivals','offers','concierge','regular')
        then product.specifications->>'homeSection'
      when product.stock_mode='preorder' then 'pre_order'
      when product.is_featured then 'featured'
      else 'regular'
    end,
    coalesce(review_stats.average_rating,0),
    coalesce(review_stats.review_count,0),
    jsonb_build_object(
      'id',product.id,
      'legacyId',product.legacy_id,
      'slug',product.slug,
      'name',product.name,
      'shortDescription',product.short_description,
      'origin',product.origin,
      'unitLabel',product.unit_label,
      'currency',product.currency,
      'stockMode',product.stock_mode,
      'featured',product.is_featured,
      'homeSection',case
        when nullif(product.specifications->>'homeSection','') in ('natural','seasonal','best_sellers','new_arrivals','offers','concierge','regular')
          then product.specifications->>'homeSection'
        when product.stock_mode='preorder' then 'pre_order'
        when product.is_featured then 'featured'
        else 'regular'
      end,
      'category',jsonb_build_object('id',category.id,'slug',category.slug,'name',category.name),
      'producer',jsonb_build_object(
        'id',producer.id,
        'name',producer.display_name,
        'province',producer.production_province,
        'district',producer.production_district,
        'village',producer.production_village
      ) || private.catalog_producer_card_identity_v1(producer.id),
      'variant',jsonb_build_object(
        'id',variant.id,
        'name',variant.name,
        'sku',variant.sku,
        'priceMinor',variant.price_minor,
        'compareAtPriceMinor',variant.compare_at_price_minor,
        'weightGrams',variant.weight_grams
      ),
      'availableQuantity',case
        when product.stock_mode in ('tracked','seasonal')
          then greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0))
        else null
      end,
      'imagePath',private.catalog_public_card_image_path_v1(image.storage_path,producer.id),
      'averageRating',coalesce(review_stats.average_rating,0),
      'reviewCount',coalesce(review_stats.review_count,0),
      'handlingProfile',private.product_handling_profile_v1(product.id)
    )
  from public.products product
  join public.producers producer
    on producer.id=product.producer_id
   and producer.status='active'
   and producer.is_verified=true
   and producer.deleted_at is null
  join public.categories category
    on category.id=product.category_id
   and category.is_active=true
  join lateral(
    select variant_row.*
    from public.product_variants variant_row
    where variant_row.product_id=product.id
      and variant_row.is_active=true
    order by variant_row.is_default desc,variant_row.created_at asc
    limit 1
  ) variant on true
  left join public.product_inventory inventory on inventory.variant_id=variant.id
  left join lateral(
    select image_row.storage_path
    from public.product_images image_row
    where image_row.product_id=product.id
    order by image_row.is_primary desc,image_row.sort_order asc,image_row.created_at asc
    limit 1
  ) image on true
  left join lateral(
    select round(avg(review.rating)::numeric,2) average_rating,count(*)::bigint review_count
    from public.reviews review
    where review.product_id=product.id
      and review.status='published'
  ) review_stats on true
  where product.status='published'
    and product.is_active=true
    and product.deleted_at is null;
$function$;

revoke all on function private.catalog_public_card_rows_v1() from public,anon,authenticated;
grant execute on function private.catalog_public_card_rows_v1() to service_role;

create or replace function private.search_catalog_v4(
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
as $function$
declare
  q text:=lower(btrim(coalesce(p_query,'')));
  requested_category_slug text:=nullif(lower(btrim(coalesce(p_category_slug,''))), '');
  province_value text:=nullif(lower(btrim(coalesce(p_province,''))), '');
  district_value text:=nullif(lower(btrim(coalesce(p_district,''))), '');
  village_value text:=nullif(lower(btrim(coalesce(p_village,''))), '');
  sort_value text:=lower(btrim(coalesce(p_sort,'relevance')));
  result jsonb;
begin
  if p_limit not between 1 and 50 or p_offset not between 0 and 100000 then
    raise exception 'invalid_pagination' using errcode='22023';
  end if;
  if sort_value not in ('relevance','newest','price_asc','price_desc','rating') then
    raise exception 'invalid_catalog_sort' using errcode='22023';
  end if;
  if p_min_price_minor is not null and p_min_price_minor<0 then raise exception 'invalid_min_price' using errcode='22023'; end if;
  if p_max_price_minor is not null and p_max_price_minor<0 then raise exception 'invalid_max_price' using errcode='22023'; end if;
  if p_min_price_minor is not null and p_max_price_minor is not null and p_min_price_minor>p_max_price_minor then
    raise exception 'invalid_price_range' using errcode='22023';
  end if;

  with base as (
    select row_data.*,
      case when q='' then 0::numeric else
        greatest(
          extensions.similarity(row_data.product_search_text,q)::numeric,
          (extensions.similarity(lower(row_data.product_name),q)*1.8)::numeric,
          (extensions.similarity(lower(row_data.producer_name),q)*1.25)::numeric,
          extensions.similarity(lower(coalesce(row_data.village,'')),q)::numeric,
          extensions.similarity(lower(row_data.category_name),q)::numeric
        ) + case when lower(row_data.product_name) like q||'%' then 1 else 0 end
      end relevance
    from private.catalog_public_card_rows_v1() row_data
    where (requested_category_slug is null or row_data.category_slug=requested_category_slug)
      and (p_producer_id is null or row_data.producer_id=p_producer_id)
      and (province_value is null or lower(coalesce(row_data.province,''))=province_value)
      and (district_value is null or lower(coalesce(row_data.district,''))=district_value)
      and (village_value is null or lower(coalesce(row_data.village,''))=village_value)
      and (p_min_price_minor is null or row_data.price_minor>=p_min_price_minor)
      and (p_max_price_minor is null or row_data.price_minor<=p_max_price_minor)
      and (not coalesce(p_in_stock,false) or row_data.stock_mode not in ('tracked','seasonal') or coalesce(row_data.available_quantity,0)>0)
      and (p_featured is null or row_data.is_featured=p_featured)
      and (
        q='' or row_data.product_search_text ilike '%'||q||'%'
        or lower(row_data.product_name) ilike '%'||q||'%'
        or lower(row_data.producer_name) ilike '%'||q||'%'
        or lower(coalesce(row_data.village,'')) ilike '%'||q||'%'
        or lower(row_data.category_name) ilike '%'||q||'%'
        or extensions.similarity(row_data.product_search_text,q)>=0.12
        or extensions.similarity(lower(row_data.product_name),q)>=0.18
      )
  ), page as (
    select * from base
    order by
      case when sort_value='price_asc' then price_minor end asc,
      case when sort_value='price_desc' then price_minor end desc,
      case when sort_value='rating' then average_rating end desc,
      case when sort_value='newest' then published_at end desc,
      case when sort_value='relevance' then relevance end desc,
      case when sort_value='relevance' then is_featured end desc,
      published_at desc nulls last,product_id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from base),
    'query',q,
    'limit',p_limit,
    'offset',p_offset,
    'items',coalesce((select jsonb_agg(card order by
      case when sort_value='price_asc' then price_minor end asc,
      case when sort_value='price_desc' then price_minor end desc,
      case when sort_value='rating' then average_rating end desc,
      case when sort_value='newest' then published_at end desc,
      case when sort_value='relevance' then relevance end desc,
      case when sort_value='relevance' then is_featured end desc,
      published_at desc nulls last,product_id
    ) from page),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

revoke all on function private.search_catalog_v4(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public,anon,authenticated;
grant execute on function private.search_catalog_v4(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to service_role;

create or replace function api_public_bridge.search_catalog_v4(
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
as $function$
  select private.search_catalog_v4(
    p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,
    p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset
  );
$function$;

create or replace function public.search_catalog_v4(
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
set search_path=''
as $function$
  select api_public_bridge.search_catalog_v4(
    p_query,p_category_slug,p_producer_id,p_province,p_district,p_village,
    p_min_price_minor,p_max_price_minor,p_in_stock,p_featured,p_sort,p_limit,p_offset
  );
$function$;

revoke all on function api_public_bridge.search_catalog_v4(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public;
grant execute on function api_public_bridge.search_catalog_v4(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to anon,authenticated,service_role;
revoke all on function public.search_catalog_v4(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) from public;
grant execute on function public.search_catalog_v4(text,text,uuid,text,text,text,bigint,bigint,boolean,boolean,text,integer,integer) to anon,authenticated,service_role;

create or replace function private.list_public_categories_v3()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  with counts as (
    select card.category_id,count(*)::bigint product_count
    from private.catalog_public_card_rows_v1() card
    group by card.category_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',category.id,
    'slug',category.slug,
    'name',category.name,
    'description',category.description,
    'icon',category.icon,
    'imagePath',category.image_path,
    'productCount',counts.product_count,
    'sortOrder',category.sort_order,
    'parentId',category.parent_id,
    'seo',category.seo
  ) order by category.sort_order,category.name),'[]'::jsonb)
  from public.categories category
  join counts on counts.category_id=category.id and counts.product_count>0
  where category.is_active=true;
$function$;

revoke all on function private.list_public_categories_v3() from public,anon,authenticated;
grant execute on function private.list_public_categories_v3() to service_role;

create or replace function api_public_bridge.list_public_categories_v3()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$ select private.list_public_categories_v3(); $function$;

create or replace function public.list_public_categories_v3()
returns jsonb
language sql
stable
set search_path=''
as $function$ select api_public_bridge.list_public_categories_v3(); $function$;

revoke all on function api_public_bridge.list_public_categories_v3() from public;
grant execute on function api_public_bridge.list_public_categories_v3() to anon,authenticated,service_role;
revoke all on function public.list_public_categories_v3() from public;
grant execute on function public.list_public_categories_v3() to anon,authenticated,service_role;

-- Normalize the live Home merchandising defaults to factual, professional labels and bounded sources.
update public.brand_settings settings
set public_config=jsonb_set(
  settings.public_config,
  '{homeSections}',
  jsonb_build_array(
    jsonb_build_object('id','featured','title','Öne Çıkan Ürünler','subtitle','Golden Oremar vitrini için seçilmiş ürünler.','active',true,'sectionType','product_carousel','displayLimit',6,'source',jsonb_build_object('kind','featured'),'startAt',null,'endAt',null),
    jsonb_build_object('id','pre_order','title','Ön Siparişe Açık','subtitle','Hazırlık süresi bulunan ve ön siparişle sunulan ürünler.','active',true,'sectionType','product_carousel','displayLimit',6,'source',jsonb_build_object('kind','preorder'),'startAt',null,'endAt',null),
    jsonb_build_object('id','seasonal','title','Mevsimlik Ürünler','subtitle','Mevsimsel stok modeliyle sunulan ürünler.','active',true,'sectionType','product_carousel','displayLimit',6,'source',jsonb_build_object('kind','seasonal'),'startAt',null,'endAt',null),
    jsonb_build_object('id','new_arrivals','title','Yeni Eklenenler','subtitle','Yakın zamanda yayına alınan ürünler.','active',true,'sectionType','product_carousel','displayLimit',6,'source',jsonb_build_object('kind','newest'),'startAt',null,'endAt',null),
    jsonb_build_object('id','offers','title','Fiyat Avantajı Olanlar','subtitle','Geçerli karşılaştırma fiyatı bulunan ürünler.','active',true,'sectionType','product_carousel','displayLimit',6,'source',jsonb_build_object('kind','offers'),'startAt',null,'endAt',null),
    jsonb_build_object('id','natural','title','Üreticiden Seçimler','subtitle','Vitrin için kürasyonla seçilmiş ürünler.','active',true,'sectionType','product_carousel','displayLimit',6,'source',jsonb_build_object('kind','curated','collectionKey','natural'),'startAt',null,'endAt',null)
  ),
  true
)
where settings.slug='golden-oremar';

update public.brand_settings settings
set public_config=jsonb_set(
  settings.public_config,
  '{heroCategories}',
  coalesce((
    select jsonb_agg(
      item || jsonb_build_object('title',coalesce(category.name,item->>'title'),'subtitle','')
      order by ordinality
    )
    from jsonb_array_elements(coalesce(settings.public_config->'heroCategories','[]'::jsonb)) with ordinality as configured(item,ordinality)
    left join public.categories category on category.slug=configured.item->>'targetCategory' and category.is_active=true
  ),'[]'::jsonb),
  true
)
where settings.slug='golden-oremar';

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
  section jsonb;
  section_items jsonb;
  sections jsonb:='[]'::jsonb;
  source_kind text;
  collection_key text;
  category_slug_value text;
  display_limit integer;
  section_title text;
  start_at timestamptz;
  end_at timestamptz;
  campaign jsonb;
  now_utc timestamptz:=timezone('utc',now());
begin
  if requested_locale not in ('tr','en','de','fr','ku','ar') then requested_locale:='tr'; end if;
  config:=private.get_public_storefront_config_v1(requested_locale);
  category_rows:=private.list_public_categories_v3();

  for section in
    select value
    from jsonb_array_elements(coalesce(config->'homeSections','[]'::jsonb))
  loop
    if coalesce((section->>'active')::boolean,false)=false then continue; end if;
    begin start_at:=nullif(section->>'startAt','')::timestamptz; exception when others then start_at:=null; end;
    begin end_at:=nullif(section->>'endAt','')::timestamptz; exception when others then end_at:=null; end;
    if start_at is not null and now_utc<start_at then continue; end if;
    if end_at is not null and now_utc>=end_at then continue; end if;

    source_kind:=coalesce(nullif(section#>>'{source,kind}',''),case section->>'id'
      when 'featured' then 'featured'
      when 'pre_order' then 'preorder'
      when 'seasonal' then 'seasonal'
      when 'new_arrivals' then 'newest'
      when 'offers' then 'offers'
      else 'curated' end);
    collection_key:=nullif(section#>>'{source,collectionKey}','');
    category_slug_value:=nullif(section#>>'{source,categorySlug}','');
    display_limit:=least(12,greatest(1,coalesce(nullif(section->>'displayLimit','')::integer,6)));
    section_title:=coalesce(nullif(section#>>array['localizedTitles',requested_locale],''),nullif(section->>'title',''),'Ürünler');

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

    if jsonb_array_length(section_items)>0 then
      sections:=sections||jsonb_build_array(jsonb_build_object(
        'key',section->>'id',
        'type',coalesce(nullif(section->>'sectionType',''),'product_carousel'),
        'title',section_title,
        'subtitle',coalesce(section->>'subtitle',''),
        'displayLimit',display_limit,
        'source',section->'source',
        'items',section_items
      ));
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
    'version',1,
    'locale',requested_locale,
    'generatedAt',now_utc,
    'updatedAt',config->>'updatedAt',
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

revoke all on function private.get_public_home_experience_v1(text) from public,anon,authenticated;
grant execute on function private.get_public_home_experience_v1(text) to service_role;

create or replace function api_public_bridge.get_public_home_experience_v1(p_locale text default 'tr')
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$ select private.get_public_home_experience_v1(p_locale); $function$;

create or replace function public.get_public_home_experience_v1(p_locale text default 'tr')
returns jsonb
language sql
stable
set search_path=''
as $function$ select api_public_bridge.get_public_home_experience_v1(p_locale); $function$;

revoke all on function api_public_bridge.get_public_home_experience_v1(text) from public;
grant execute on function api_public_bridge.get_public_home_experience_v1(text) to anon,authenticated,service_role;
revoke all on function public.get_public_home_experience_v1(text) from public;
grant execute on function public.get_public_home_experience_v1(text) to anon,authenticated,service_role;
