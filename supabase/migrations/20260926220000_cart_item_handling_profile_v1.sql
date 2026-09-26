-- Right of withdrawal in the cart (roadmap 3.7b).
--
-- The product page already tells the customer, before buying, whether the
-- 14-day right of withdrawal applies (src/features/catalog/withdrawalRight.ts,
-- fed by private.product_handling_profile_v1). The same notice belongs next to
-- the cart total, because it is part of the pre-contract information shown
-- before payment. The cart snapshot now carries the same handlingProfile the
-- product page reads, so both places can never disagree.
--
-- Additive only: one more key per item. get_my_cart_v1, set_my_cart_item_v1,
-- remove_my_cart_item_v1 and clear_my_cart_v1 all return this snapshot, so
-- older clients simply ignore the key.

create or replace function private.get_customer_cart_snapshot_v1(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare cart_row public.carts%rowtype; result jsonb;
begin
  if p_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into cart_row from public.carts where user_id=p_user_id and status='active' and (expires_at is null or expires_at>timezone('utc',now())) order by created_at desc limit 1;
  if cart_row.id is null then return jsonb_build_object('cartId',null,'currency','TRY','itemCount',0,'subtotalMinor',0,'items','[]'::jsonb); end if;
  with rows as (
    select item.id cart_item_id,item.quantity,item.selected_options,
      variant.id variant_id,variant.name raw_variant_name,variant.sku,variant.price_minor,variant.compare_at_price_minor,variant.weight_grams,
      product.id product_id,product.legacy_id,product.slug,product.name product_name,product.unit_label,product.stock_mode,product.currency,
      producer.id producer_id,producer.display_name producer_name,image.storage_path image_path,
      case when product.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inventory.available_quantity,0)-coalesce(inventory.reserved_quantity,0)) else null end sellable_quantity,
      (item.quantity*variant.price_minor)::bigint line_total_minor,
      (product.status='published' and product.is_active=true and product.deleted_at is null and variant.is_active=true and producer.status='active' and producer.is_verified=true and producer.deleted_at is null) available
    from public.cart_items item
    join public.product_variants variant on variant.id=item.variant_id
    join public.products product on product.id=variant.product_id
    join public.producers producer on producer.id=product.producer_id
    left join public.product_inventory inventory on inventory.variant_id=variant.id
    left join lateral(select pi.storage_path from public.product_images pi where pi.product_id=product.id order by pi.is_primary desc,pi.sort_order asc limit 1) image on true
    where item.cart_id=cart_row.id
  )
  select jsonb_build_object(
    'cartId',cart_row.id,'currency',cart_row.currency,'expiresAt',cart_row.expires_at,
    'itemCount',coalesce(sum(quantity),0),'subtotalMinor',coalesce(sum(line_total_minor),0),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'cartItemId',cart_item_id,'quantity',quantity,'selectedOptions',selected_options,
      'productId',product_id,'legacyId',legacy_id,'slug',slug,'productName',product_name,'unitLabel',unit_label,
      'variantId',variant_id,'variantName',left(raw_variant_name||case when private.order_customization_summary_v1(selected_options)<>'' then ' · '||private.order_customization_summary_v1(selected_options) else '' end,240),'sku',sku,'priceMinor',price_minor,'compareAtPriceMinor',compare_at_price_minor,'weightGrams',weight_grams,
      'producer',jsonb_build_object('id',producer_id,'name',producer_name),'imagePath',image_path,
      'stockMode',stock_mode,'sellableQuantity',sellable_quantity,'available',available,'lineTotalMinor',line_total_minor,
      'handlingProfile',private.product_handling_profile_v1(product_id)
    ) order by product_name,raw_variant_name),'[]'::jsonb)
  ) into result from rows;
  return result;
end;
$function$;
