create or replace function private.admin_list_products_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'producer_id', p.producer_id,
      'producer_name', producer.display_name,
      'producer_verified', producer.is_verified,
      'producer_origin_verified', producer.origin_verified,
      'category_id', p.category_id,
      'category_name', category.name,
      'slug', p.slug,
      'name', p.name,
      'short_description', p.short_description,
      'description', p.description,
      'origin', p.origin,
      'unit_label', p.unit_label,
      'base_price_minor', p.base_price_minor,
      'compare_at_price_minor', p.compare_at_price_minor,
      'currency', p.currency,
      'status', p.status,
      'stock_mode', p.stock_mode,
      'is_featured', p.is_featured,
      'is_active', p.is_active,
      'export_status', p.export_status,
      'country_of_origin_code', p.country_of_origin_code,
      'requires_cold_chain', p.requires_cold_chain,
      'is_perishable', p.is_perishable,
      'shelf_life_days', p.shelf_life_days,
      'published_at', p.published_at,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'variant_count', metrics.variant_count,
      'active_variant_count', metrics.active_variant_count,
      'missing_weight_variant_count', metrics.missing_weight_variant_count,
      'primary_image_count', metrics.primary_image_count,
      'available_quantity', metrics.available_quantity,
      'review_count', metrics.review_count,
      'rating_average', metrics.rating_average,
      'shipping_weight_ready', metrics.active_variant_count > 0 and metrics.missing_weight_variant_count = 0,
      'origin_code_ready', p.country_of_origin_code ~ '^[A-Z]{2}$',
      'shelf_life_ready', (not p.is_perishable) or p.shelf_life_days is not null,
      'export_ready',
        p.export_status = 'eligible'
        and p.country_of_origin_code ~ '^[A-Z]{2}$'
        and metrics.active_variant_count > 0
        and metrics.missing_weight_variant_count = 0
        and ((not p.is_perishable) or p.shelf_life_days is not null),
      'catalog_issue_count',
        (case when producer.id is null or producer.status <> 'active' or producer.is_verified is not true then 1 else 0 end)
        + (case when category.id is null or category.is_active is not true then 1 else 0 end)
        + (case when metrics.active_variant_count = 0 then 1 else 0 end)
        + (case when metrics.priced_variant_count = 0 then 1 else 0 end)
        + (case when metrics.primary_image_count <> 1 then 1 else 0 end)
        + (case when p.export_status = 'eligible' and p.country_of_origin_code !~ '^[A-Z]{2}$' then 1 else 0 end)
        + (case when p.export_status = 'eligible' and metrics.missing_weight_variant_count > 0 then 1 else 0 end)
        + (case when p.is_perishable and p.shelf_life_days is null then 1 else 0 end)
    ) order by p.updated_at desc)
    from public.products p
    left join public.producers producer on producer.id = p.producer_id
    left join public.categories category on category.id = p.category_id
    cross join lateral (
      select
        (select count(*)::integer from public.product_variants v where v.product_id = p.id and v.deleted_at is null) as variant_count,
        (select count(*)::integer from public.product_variants v where v.product_id = p.id and v.deleted_at is null and v.is_active) as active_variant_count,
        (select count(*)::integer from public.product_variants v where v.product_id = p.id and v.deleted_at is null and v.is_active and v.price_minor > 0) as priced_variant_count,
        (select count(*)::integer from public.product_variants v where v.product_id = p.id and v.deleted_at is null and v.is_active and (v.weight_grams is null or v.weight_grams <= 0)) as missing_weight_variant_count,
        (select count(*)::integer from public.product_images image where image.product_id = p.id and image.is_primary) as primary_image_count,
        coalesce((
          select sum(greatest(0, i.available_quantity - i.reserved_quantity))::bigint
          from public.product_inventory i
          join public.product_variants v on v.id = i.variant_id
          where v.product_id = p.id and v.deleted_at is null
        ), 0) as available_quantity,
        (select count(*)::integer from public.reviews r where r.product_id = p.id and r.status = 'published') as review_count,
        coalesce((select avg(r.rating)::numeric(4,2) from public.reviews r where r.product_id = p.id and r.status = 'published'), 0) as rating_average
    ) metrics
    where p.deleted_at is null
  ), '[]'::jsonb);
end;
$function$;
