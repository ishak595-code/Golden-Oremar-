-- Drift closure: the catalog search engine and public directory reads -
-- search_catalog_v1 (trigram relevance scoring across product/producer/category
-- with price, stock, location and featured filters), search_catalog_v2 (same
-- results with image paths resolved through the verified card-image helper),
-- get_public_home_catalog_v1, and list_public_producers_v1.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION api_public_bridge.list_public_producers_v1(p_query text DEFAULT NULL::text, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_village text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.list_public_producers_v1(p_query,p_province,p_district,p_village,p_limit,p_offset); $function$
;

CREATE OR REPLACE FUNCTION private.get_public_home_catalog_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(jsonb_build_object(
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
      'producer',jsonb_build_object('id',producer.id,'name',producer.display_name),
      'variant',jsonb_build_object(
        'id',variant.id,'name',variant.name,'sku',variant.sku,'priceMinor',variant.price_minor,
        'compareAtPriceMinor',variant.compare_at_price_minor,'weightGrams',variant.weight_grams
      ),
      'availableQuantity',case when product.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0)) else null end,
      'imagePath',image.storage_path,
      'averageRating',coalesce(review_stats.average_rating,0),
      'reviewCount',coalesce(review_stats.review_count,0)
    ) order by product.is_featured desc,product.published_at desc nulls last,product.name),'[]'::jsonb),
    'generatedAt',timezone('utc',now())
  ) into result
  from public.products product
  join public.producers producer on producer.id=product.producer_id
    and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
  join public.categories category on category.id=product.category_id and category.is_active=true
  join lateral(
    select v.* from public.product_variants v
    where v.product_id=product.id and v.is_active=true
    order by v.is_default desc,v.created_at asc limit 1
  ) variant on true
  left join public.product_inventory inventory on inventory.variant_id=variant.id
  left join lateral(
    select pi.storage_path from public.product_images pi
    where pi.product_id=product.id
    order by pi.is_primary desc,pi.sort_order asc,pi.created_at asc limit 1
  ) image on true
  left join lateral(
    select round(avg(r.rating)::numeric,2) average_rating,count(*)::bigint review_count
    from public.reviews r where r.product_id=product.id and r.status='published'
  ) review_stats on true
  where product.status='published' and product.is_active=true and product.deleted_at is null;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.list_public_producers_v1(p_query text DEFAULT NULL::text, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_village text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q text:=lower(btrim(coalesce(p_query,''))); result jsonb;
begin
  if char_length(q)>100 or p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_producer_directory_request' using errcode='22023'; end if;
  with base as (
    select p.id,p.slug,p.display_name,p.description,p.logo_path,p.cover_path,p.rating_average,p.rating_count,p.production_location,
      p.production_country_code,p.production_province,p.production_district,p.production_village,p.origin_verified,p.created_at,
      private.is_producer_trust_badge_active_v1(p.id) badge_active,
      (select count(*) from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null) product_count
    from public.producers p where p.status='active' and p.is_verified=true and p.deleted_at is null
      and (q='' or lower(p.display_name) like '%'||q||'%' or lower(coalesce(p.production_location,'')) like '%'||q||'%' or lower(coalesce(p.production_village,'')) like '%'||q||'%' or lower(coalesce(p.production_district,'')) like '%'||q||'%' or lower(coalesce(p.production_province,'')) like '%'||q||'%')
      and (nullif(btrim(coalesce(p_province,'')),'') is null or lower(coalesce(p.production_province,''))=lower(btrim(p_province)))
      and (nullif(btrim(coalesce(p_district,'')),'') is null or lower(coalesce(p.production_district,''))=lower(btrim(p_district)))
      and (nullif(btrim(coalesce(p_village,'')),'') is null or lower(coalesce(p.production_village,''))=lower(btrim(p_village)))
  ), page as (select * from base order by rating_average desc,rating_count desc,display_name limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from base),'limit',p_limit,'offset',p_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'slug',slug,'display_name',display_name,'description',description,'logo_path',logo_path,'cover_path',cover_path,
      'rating_average',rating_average,'rating_count',rating_count,'product_count',product_count,'location_label',production_location,
      'location',jsonb_build_object('country_code',production_country_code,'province',production_province,'district',production_district,'village',production_village),
      'verified',badge_active,'origin_verified',origin_verified and badge_active
    ) order by rating_average desc,rating_count desc,display_name) from page),'[]'::jsonb)) into result;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.search_catalog_v1(p_query text DEFAULT NULL::text, p_category_slug text DEFAULT NULL::text, p_producer_id uuid DEFAULT NULL::uuid, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_village text DEFAULT NULL::text, p_min_price_minor bigint DEFAULT NULL::bigint, p_max_price_minor bigint DEFAULT NULL::bigint, p_in_stock boolean DEFAULT false, p_featured boolean DEFAULT NULL::boolean, p_sort text DEFAULT 'relevance'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q text:=lower(btrim(coalesce(p_query,'')));
  requested_category_slug text:=nullif(lower(btrim(coalesce(p_category_slug,''))),'');
  province_value text:=nullif(lower(btrim(coalesce(p_province,''))),'');
  district_value text:=nullif(lower(btrim(coalesce(p_district,''))),'');
  village_value text:=nullif(lower(btrim(coalesce(p_village,''))),'');
  sort_value text:=lower(btrim(coalesce(p_sort,'relevance')));
  result jsonb;
begin
  if char_length(q)>100 then raise exception 'search_query_too_long' using errcode='22023'; end if;
  if p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  if p_min_price_minor is not null and p_min_price_minor<0 then raise exception 'invalid_min_price' using errcode='22023'; end if;
  if p_max_price_minor is not null and p_max_price_minor<0 then raise exception 'invalid_max_price' using errcode='22023'; end if;
  if p_min_price_minor is not null and p_max_price_minor is not null and p_max_price_minor<p_min_price_minor then raise exception 'invalid_price_range' using errcode='22023'; end if;
  if sort_value not in ('relevance','newest','price_asc','price_desc','rating') then raise exception 'invalid_catalog_sort' using errcode='22023'; end if;

  with base as (
    select product.id,product.legacy_id,product.slug,product.name,product.short_description,product.origin,product.unit_label,
           product.stock_mode,product.is_featured,product.published_at,product.currency,
           category.id category_id,category.slug category_slug,category.name category_name,
           producer.id producer_id,producer.display_name producer_name,producer.production_province,producer.production_district,producer.production_village,
           variant.id variant_id,variant.name variant_name,variant.sku,variant.price_minor,variant.compare_at_price_minor,
           case when product.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0)) else null end available_quantity,
           image.storage_path image_path,
           coalesce(review_stats.average_rating,0)::numeric average_rating,coalesce(review_stats.review_count,0)::bigint review_count,
           case when q='' then 0::numeric else
             greatest(
               extensions.similarity(product.search_text,q)::numeric,
               (extensions.similarity(lower(product.name),q)*1.8)::numeric,
               (extensions.similarity(lower(producer.display_name),q)*1.25)::numeric,
               extensions.similarity(lower(coalesce(producer.production_village,'')),q)::numeric,
               extensions.similarity(lower(category.name),q)::numeric
             ) + case when lower(product.name) like q||'%' then 1 else 0 end
           end relevance
    from public.products product
    join public.producers producer on producer.id=product.producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
    join public.categories category on category.id=product.category_id and category.is_active=true
    join lateral(
      select v.* from public.product_variants v where v.product_id=product.id and v.is_active=true order by v.is_default desc,v.created_at asc limit 1
    ) variant on true
    left join public.product_inventory inventory on inventory.variant_id=variant.id
    left join lateral(
      select pi.storage_path from public.product_images pi where pi.product_id=product.id order by pi.is_primary desc,pi.sort_order asc,pi.created_at asc limit 1
    ) image on true
    left join lateral(
      select round(avg(r.rating)::numeric,2) average_rating,count(*)::bigint review_count from public.reviews r where r.product_id=product.id and r.status='published'
    ) review_stats on true
    where product.status='published' and product.is_active=true and product.deleted_at is null
      and (requested_category_slug is null or category.slug=requested_category_slug)
      and (p_producer_id is null or producer.id=p_producer_id)
      and (province_value is null or lower(coalesce(producer.production_province,''))=province_value)
      and (district_value is null or lower(coalesce(producer.production_district,''))=district_value)
      and (village_value is null or lower(coalesce(producer.production_village,''))=village_value)
      and (p_min_price_minor is null or variant.price_minor>=p_min_price_minor)
      and (p_max_price_minor is null or variant.price_minor<=p_max_price_minor)
      and (not coalesce(p_in_stock,false) or product.stock_mode not in ('tracked','seasonal') or greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0))>0)
      and (p_featured is null or product.is_featured=p_featured)
      and (
        q='' or product.search_text ilike '%'||q||'%' or lower(product.name) ilike '%'||q||'%'
        or lower(producer.display_name) ilike '%'||q||'%' or lower(coalesce(producer.production_village,'')) ilike '%'||q||'%'
        or lower(category.name) ilike '%'||q||'%'
        or extensions.similarity(product.search_text,q)>=0.12 or extensions.similarity(lower(product.name),q)>=0.18
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
      published_at desc nulls last,id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from base),
    'query',q,
    'limit',p_limit,
    'offset',p_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'legacyId',legacy_id,'slug',slug,'name',name,'shortDescription',short_description,'origin',origin,'unitLabel',unit_label,
      'category',jsonb_build_object('id',category_id,'slug',category_slug,'name',category_name),
      'producer',jsonb_build_object('id',producer_id,'name',producer_name,'province',production_province,'district',production_district,'village',production_village),
      'variant',jsonb_build_object('id',variant_id,'name',variant_name,'sku',sku,'priceMinor',price_minor,'compareAtPriceMinor',compare_at_price_minor),
      'currency',currency,'stockMode',stock_mode,'availableQuantity',available_quantity,'featured',is_featured,'imagePath',image_path,
      'averageRating',average_rating,'reviewCount',review_count,'relevance',round(relevance,4)
    ) order by
      case when sort_value='price_asc' then price_minor end asc,
      case when sort_value='price_desc' then price_minor end desc,
      case when sort_value='rating' then average_rating end desc,
      case when sort_value='newest' then published_at end desc,
      case when sort_value='relevance' then relevance end desc,
      published_at desc nulls last,id) from page),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.search_catalog_v2(p_query text DEFAULT NULL::text, p_category_slug text DEFAULT NULL::text, p_producer_id uuid DEFAULT NULL::uuid, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_village text DEFAULT NULL::text, p_min_price_minor bigint DEFAULT NULL::bigint, p_max_price_minor bigint DEFAULT NULL::bigint, p_in_stock boolean DEFAULT false, p_featured boolean DEFAULT NULL::boolean, p_sort text DEFAULT 'relevance'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.list_public_producers_v1(p_query text DEFAULT NULL::text, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_village text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select api_public_bridge.list_public_producers_v1(p_query, p_province, p_district, p_village, p_limit, p_offset); $function$
;
