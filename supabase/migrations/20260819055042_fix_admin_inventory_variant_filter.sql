create or replace function private.admin_list_inventory_v1()
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
      'variant_id', variant.id,
      'sku', variant.sku,
      'variant_name', variant.name,
      'product_id', product.id,
      'product_name', product.name,
      'product_status', product.status,
      'stock_mode', product.stock_mode,
      'currency', product.currency,
      'price_minor', variant.price_minor,
      'producer_id', producer.id,
      'producer_name', producer.display_name,
      'producer_status', producer.status,
      'producer_verified', producer.is_verified,
      'available_quantity', coalesce(inventory.available_quantity, 0),
      'reserved_quantity', coalesce(inventory.reserved_quantity, 0),
      'sellable_quantity', greatest(0, coalesce(inventory.available_quantity, 0) - coalesce(inventory.reserved_quantity, 0)),
      'reorder_level', coalesce(inventory.reorder_level, 0),
      'version', coalesce(inventory.version, 0),
      'updated_at', coalesce(inventory.updated_at, variant.updated_at),
      'is_active', variant.is_active
    ) order by greatest(0, coalesce(inventory.available_quantity, 0) - coalesce(inventory.reserved_quantity, 0)) asc, product.name, variant.name)
    from public.product_variants variant
    join public.products product on product.id = variant.product_id and product.deleted_at is null
    join public.producers producer on producer.id = product.producer_id and producer.deleted_at is null
    left join public.product_inventory inventory on inventory.variant_id = variant.id
  ), '[]'::jsonb);
end;
$function$;
