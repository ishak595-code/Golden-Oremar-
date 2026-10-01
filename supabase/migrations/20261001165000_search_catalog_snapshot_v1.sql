-- Catalogue search: fast at any catalogue size, and fewer false matches.
--
-- search_catalog_v3 (what the app calls) rebuilt every product row with five
-- joins and then ran trigram similarity against each product's full search
-- text (about 1,800 characters). On text that long similarity is never above
-- 0.012, so it could not rank anything, yet it was most of the cost: about
-- 20 ms per search with 42 products, growing linearly (about half a second at
-- 1,000 products).
--
-- It now reads the card snapshot (see 20261001160000) and matches like this:
-- - name, store name, village: substring, as before;
-- - category name and the long search text: a word must start with the query,
--   and for queries under 4 letters the word must be exactly the query. So
--   "bal" finds honey and a description that says "bal", but no longer every
--   meat and fish product because their category is "Et & Balık", nor
--   "sobalık" or "alabalığı";
-- - typos on the product name still match (name similarity >= 0.18).
-- Ranking keeps the name/store/village/category similarity and the name-prefix
-- bonus, adds a bonus when a word of the name starts with the query (so
-- "balık" ranks fish above "Sobalık"), then featured, then newest. The answer has the same shape, plus the
-- fields cards already carry.

create or replace function private.search_catalog_v3(p_query text default null::text, p_category_slug text default null::text, p_producer_id uuid default null::uuid, p_province text default null::text, p_district text default null::text, p_village text default null::text, p_min_price_minor bigint default null::bigint, p_max_price_minor bigint default null::bigint, p_in_stock boolean default false, p_featured boolean default null::boolean, p_sort text default 'relevance'::text, p_limit integer default 20, p_offset integer default 0)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  q text:=lower(btrim(coalesce(p_query,'')));
  q_pattern text;
  word_pattern text;
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

  -- The query as a literal inside a regular expression.
  q_pattern:=regexp_replace(q,'([.^$*+?()\[\]{}|\\-])','\\\1','g');
  word_pattern:=case when char_length(q)>=4 then '(^|[^[:alnum:]])'||q_pattern else '(^|[^[:alnum:]])'||q_pattern||'([^[:alnum:]]|$)' end;

  with cards as materialized (
    select * from private.catalog_public_card_rows_v1()
  ), base as (
    select cards.*,
      case when q='' then 0::numeric else
        greatest(
          (extensions.similarity(lower(cards.product_name),q)*1.8)::numeric,
          (extensions.similarity(lower(cards.producer_name),q)*1.25)::numeric,
          extensions.similarity(lower(coalesce(cards.village,'')),q)::numeric,
          extensions.similarity(lower(cards.category_name),q)::numeric
        )
        + case when lower(cards.product_name) like q||'%' then 1 else 0 end
        + case when lower(cards.product_name) ~ ('(^|[^[:alnum:]])'||q_pattern) then 0.5 else 0 end
      end relevance
    from cards
    where (requested_category_slug is null or cards.category_slug=requested_category_slug)
      and (p_producer_id is null or cards.producer_id=p_producer_id)
      and (province_value is null or lower(coalesce(cards.province,''))=province_value)
      and (district_value is null or lower(coalesce(cards.district,''))=district_value)
      and (village_value is null or lower(coalesce(cards.village,''))=village_value)
      and (p_min_price_minor is null or cards.price_minor>=p_min_price_minor)
      and (p_max_price_minor is null or cards.price_minor<=p_max_price_minor)
      and (not coalesce(p_in_stock,false) or cards.stock_mode not in ('tracked','seasonal') or coalesce(cards.available_quantity,0)>0)
      and (p_featured is null or cards.is_featured=p_featured)
      and (
        q=''
        or lower(cards.product_name) like '%'||q||'%'
        or lower(cards.producer_name) like '%'||q||'%'
        or lower(coalesce(cards.village,'')) like '%'||q||'%'
        or lower(cards.category_name) ~ word_pattern
        or cards.product_search_text ~ word_pattern
        or extensions.similarity(lower(cards.product_name),q)>=0.18
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
    'items',coalesce((select jsonb_agg(
      (card-'homeSection')||jsonb_build_object('variant',(card->'variant')-'weightGrams','relevance',round(relevance,4))
      order by
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
