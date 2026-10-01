-- Product page context: the product's own card plus other products from the
-- same category and from the same store, in one small call.
--
-- The product page used to download the whole home catalogue (every
-- published product, 54 KB today) twice per visit, only to pick these few
-- cards out of it in the browser. That grows with every product added, and
-- the client refuses a catalogue above 500 products, so the page would have
-- lost these sections entirely as the store grew. This reads the card
-- snapshot and returns at most 1 + 2 x p_limit cards whatever the size of the
-- catalogue. Order matches the home catalogue: featured first, newest first,
-- then by name.

create or replace function private.get_public_product_context_v1(p_reference text, p_limit integer default 8)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  -- One statement, no temporary objects: the API runs this in a read-only
  -- transaction.
  with cards as materialized (
    select * from private.catalog_public_card_rows_v1()
  ), target as (
    select cards.* from cards
    where char_length(btrim(coalesce(p_reference,''))) between 1 and 220
      and (cards.product_id::text=btrim(p_reference) or cards.card->>'slug'=lower(btrim(p_reference)) or cards.card->>'legacyId'=btrim(p_reference))
    limit 1
  ), bounded as (
    select least(12,greatest(1,coalesce(p_limit,8))) n
  )
  select jsonb_build_object(
    'product',(select target.card from target),
    'sameCategory',coalesce((
      select jsonb_agg(picked.card order by picked.is_featured desc,picked.published_at desc nulls last,picked.product_name)
      from (
        select cards.* from cards,target
        where cards.product_id<>target.product_id and cards.category_id=target.category_id
        order by cards.is_featured desc,cards.published_at desc nulls last,cards.product_name
        limit (select n from bounded)
      ) picked),'[]'::jsonb),
    'sameStore',coalesce((
      select jsonb_agg(picked.card order by picked.is_featured desc,picked.published_at desc nulls last,picked.product_name)
      from (
        select cards.* from cards,target
        where cards.product_id<>target.product_id and cards.producer_id=target.producer_id and cards.category_id is distinct from target.category_id
        order by cards.is_featured desc,cards.published_at desc nulls last,cards.product_name
        limit (select n from bounded)
      ) picked),'[]'::jsonb)
  );
$function$;
revoke all on function private.get_public_product_context_v1(text,integer) from public, anon, authenticated, service_role;
grant execute on function private.get_public_product_context_v1(text,integer) to service_role;

create or replace function api_public_bridge.get_public_product_context_v1(p_reference text, p_limit integer default 8)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$select private.get_public_product_context_v1(p_reference,p_limit);$function$;
revoke all on function api_public_bridge.get_public_product_context_v1(text,integer) from public, anon, authenticated, service_role;
grant execute on function api_public_bridge.get_public_product_context_v1(text,integer) to anon;
grant execute on function api_public_bridge.get_public_product_context_v1(text,integer) to authenticated;

create or replace function public.get_public_product_context_v1(p_reference text, p_limit integer default 8)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$select api_public_bridge.get_public_product_context_v1(p_reference,p_limit);$function$;
revoke all on function public.get_public_product_context_v1(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_public_product_context_v1(text,integer) to anon;
grant execute on function public.get_public_product_context_v1(text,integer) to authenticated;
