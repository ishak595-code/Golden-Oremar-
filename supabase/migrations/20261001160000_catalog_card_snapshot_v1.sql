-- Catalogue card snapshot: fast public browsing at any traffic level.
--
-- Every public catalogue screen (home composition, home sections, category
-- counts, search) reads private.catalog_public_card_rows_v1(), which builds a
-- card for every published product with three per-row helper functions. It
-- cost about 0.5 ms per product on each call and the home composition called
-- it six times: about 155 ms of database time per home visit with 42 products,
-- growing linearly with the catalogue. Under load that is the first thing to
-- saturate the database.
--
-- The cards are now kept in private.catalog_card_snapshot, rebuilt by pg_cron
-- every 30 seconds (only rows that changed are written). Reads use the snapshot
-- while it is fresh and fall back to the live query otherwise, so the result
-- is always correct:
-- - an edit to products, variants, images, categories or producers marks the
--   snapshot stale at once (statement trigger), so sellers and admins see
--   their change immediately;
-- - stock counts and review averages on cards may lag by up to 30 seconds;
--   product pages, cart and checkout always read live stock and prices;
-- - if the cron job stops, the snapshot is ignored after 2 minutes.

-- 1. The live query, unchanged, under its own name.
CREATE OR REPLACE FUNCTION private.catalog_public_card_rows_live_v1()
 RETURNS TABLE(product_id uuid, category_id uuid, category_slug text, category_name text, producer_id uuid, producer_name text, province text, district text, village text, product_name text, product_search_text text, price_minor bigint, compare_at_price_minor bigint, stock_mode text, available_quantity integer, is_featured boolean, published_at timestamp with time zone, home_section text, average_rating numeric, review_count bigint, card jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

revoke all on function private.catalog_public_card_rows_live_v1() from public, anon, authenticated, service_role;
grant execute on function private.catalog_public_card_rows_live_v1() to service_role;

-- 2. Snapshot storage.
create table if not exists private.catalog_card_snapshot (
  product_id uuid primary key,
  category_id uuid, category_slug text, category_name text,
  producer_id uuid, producer_name text, province text, district text, village text,
  product_name text, product_search_text text,
  price_minor bigint, compare_at_price_minor bigint, stock_mode text, available_quantity integer,
  is_featured boolean, published_at timestamp with time zone, home_section text,
  average_rating numeric, review_count bigint, card jsonb
);
create index if not exists catalog_card_snapshot_category_idx on private.catalog_card_snapshot (category_slug);
alter table private.catalog_card_snapshot enable row level security;
revoke all on table private.catalog_card_snapshot from public, anon, authenticated, service_role;
grant select on table private.catalog_card_snapshot to service_role;

create table if not exists private.catalog_card_snapshot_state (
  id boolean primary key default true check (id),
  refreshed_at timestamp with time zone,
  row_count integer not null default 0,
  last_duration_ms numeric,
  last_changed_rows integer not null default 0,
  -- Bumped by every catalogue edit. A rebuild only marks itself fresh when no
  -- edit happened while it was computing, so an edit can never be hidden
  -- behind a rebuild that started before it.
  version bigint not null default 0
);
insert into private.catalog_card_snapshot_state (id) values (true) on conflict (id) do nothing;
alter table private.catalog_card_snapshot_state enable row level security;
revoke all on table private.catalog_card_snapshot_state from public, anon, authenticated, service_role;
grant select on table private.catalog_card_snapshot_state to service_role;

-- 3. Rebuild: compute once, write only what changed.
create or replace function private.refresh_catalog_card_snapshot_v1()
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to ''
as $function$
declare
  started timestamptz:=clock_timestamp();
  removed integer:=0;
  written integer:=0;
  total integer:=0;
  seen_version bigint;
begin
  -- One rebuild at a time; a second caller simply skips.
  if not pg_try_advisory_xact_lock(hashtext('golden-oremar:catalog-card-snapshot')) then
    return jsonb_build_object('skipped',true);
  end if;
  select state.version into seen_version from private.catalog_card_snapshot_state state where state.id;
  create temporary table if not exists catalog_card_rebuild on commit drop as
    select * from private.catalog_public_card_rows_live_v1() with no data;
  truncate catalog_card_rebuild;
  insert into catalog_card_rebuild select * from private.catalog_public_card_rows_live_v1();
  select count(*) into total from catalog_card_rebuild;

  delete from private.catalog_card_snapshot snapshot
  where not exists (select 1 from catalog_card_rebuild fresh where fresh.product_id=snapshot.product_id);
  get diagnostics removed=row_count;

  insert into private.catalog_card_snapshot as snapshot
  select * from catalog_card_rebuild
  on conflict (product_id) do update set
      category_id=excluded.category_id,
      category_slug=excluded.category_slug,
      category_name=excluded.category_name,
      producer_id=excluded.producer_id,
      producer_name=excluded.producer_name,
      province=excluded.province,
      district=excluded.district,
      village=excluded.village,
      product_name=excluded.product_name,
      product_search_text=excluded.product_search_text,
      price_minor=excluded.price_minor,
      compare_at_price_minor=excluded.compare_at_price_minor,
      stock_mode=excluded.stock_mode,
      available_quantity=excluded.available_quantity,
      is_featured=excluded.is_featured,
      published_at=excluded.published_at,
      home_section=excluded.home_section,
      average_rating=excluded.average_rating,
      review_count=excluded.review_count,
      card=excluded.card
  where (snapshot.*) is distinct from (excluded.*);
  get diagnostics written=row_count;

  update private.catalog_card_snapshot_state set
    refreshed_at=clock_timestamp(),
    row_count=total,
    last_duration_ms=round(extract(epoch from clock_timestamp()-started)*1000,1),
    last_changed_rows=removed+written
  where id and version=seen_version;
  return jsonb_build_object('rows',total,'removed',removed,'written',written,'ms',round(extract(epoch from clock_timestamp()-started)*1000,1));
end;
$function$;
revoke all on function private.refresh_catalog_card_snapshot_v1() from public, anon, authenticated, service_role;
grant execute on function private.refresh_catalog_card_snapshot_v1() to service_role;

-- 4. Readers: snapshot while fresh, live otherwise. Same signature as before,
--    so every caller keeps working unchanged.
create or replace function private.catalog_public_card_rows_v1()
 returns table(product_id uuid, category_id uuid, category_slug text, category_name text, producer_id uuid, producer_name text, province text, district text, village text, product_name text, product_search_text text, price_minor bigint, compare_at_price_minor bigint, stock_mode text, available_quantity integer, is_featured boolean, published_at timestamp with time zone, home_section text, average_rating numeric, review_count bigint, card jsonb)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if exists (
    select 1 from private.catalog_card_snapshot_state state
    where state.id and state.refreshed_at > now() - interval '2 minutes'
  ) then
    return query select snapshot.product_id, snapshot.category_id, snapshot.category_slug, snapshot.category_name, snapshot.producer_id, snapshot.producer_name, snapshot.province, snapshot.district, snapshot.village, snapshot.product_name, snapshot.product_search_text, snapshot.price_minor, snapshot.compare_at_price_minor, snapshot.stock_mode, snapshot.available_quantity, snapshot.is_featured, snapshot.published_at, snapshot.home_section, snapshot.average_rating, snapshot.review_count, snapshot.card from private.catalog_card_snapshot snapshot;
  else
    return query select * from private.catalog_public_card_rows_live_v1();
  end if;
end;
$function$;

-- 5. Catalogue edits mark the snapshot stale at once.
create or replace function private.mark_catalog_card_snapshot_stale_v1()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update private.catalog_card_snapshot_state set refreshed_at=null, version=version+1 where id;
  return null;
end;
$function$;
revoke all on function private.mark_catalog_card_snapshot_stale_v1() from public, anon, authenticated, service_role;

drop trigger if exists catalog_card_snapshot_stale on public.products;
create trigger catalog_card_snapshot_stale after insert or update or delete on public.products for each statement execute function private.mark_catalog_card_snapshot_stale_v1();
drop trigger if exists catalog_card_snapshot_stale on public.product_variants;
create trigger catalog_card_snapshot_stale after insert or update or delete on public.product_variants for each statement execute function private.mark_catalog_card_snapshot_stale_v1();
drop trigger if exists catalog_card_snapshot_stale on public.product_images;
create trigger catalog_card_snapshot_stale after insert or update or delete on public.product_images for each statement execute function private.mark_catalog_card_snapshot_stale_v1();
drop trigger if exists catalog_card_snapshot_stale on public.categories;
create trigger catalog_card_snapshot_stale after insert or update or delete on public.categories for each statement execute function private.mark_catalog_card_snapshot_stale_v1();
drop trigger if exists catalog_card_snapshot_stale on public.producers;
create trigger catalog_card_snapshot_stale after insert or update or delete on public.producers for each statement execute function private.mark_catalog_card_snapshot_stale_v1();

-- 6. First build and the schedule.
select private.refresh_catalog_card_snapshot_v1();
do $do$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if exists (select 1 from cron.job where jobname='golden-oremar-catalog-card-snapshot') then
      perform cron.unschedule('golden-oremar-catalog-card-snapshot');
    end if;
    perform cron.schedule('golden-oremar-catalog-card-snapshot','30 seconds','select private.refresh_catalog_card_snapshot_v1();');
  end if;
end;
$do$;
