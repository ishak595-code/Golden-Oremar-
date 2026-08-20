create or replace function private.product_handling_profile_v1(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  product_row public.products%rowtype;
  safety_class text;
  product_type text;
begin
  select * into product_row from public.products p where p.id=p_product_id and p.deleted_at is null;
  if product_row.id is null then return null; end if;

  select nullif(btrim(ce.metadata#>>'{safetyV2,safetyClass}'),'')
  into safety_class
  from public.content_entries ce
  where ce.related_product_id=product_row.id
    and ce.content_type='product_health'
    and ce.status='published'
    and ce.deleted_at is null
  order by ce.updated_at desc
  limit 1;

  product_type:=case
    when product_row.specifications->>'productType' in ('fish','red_meat','poultry','egg','animal_fat','dairy','produce','pantry','beverage','non_food') then product_row.specifications->>'productType'
    when safety_class in ('lamb','goat') then 'red_meat'
    when safety_class='fish' then 'fish'
    when safety_class='poultry' then 'poultry'
    when safety_class='egg' then 'egg'
    when safety_class='animal_fat' then 'animal_fat'
    when safety_class in ('raw_milk','dairy') then 'dairy'
    when safety_class in ('wild_mushroom','fresh_produce') then 'produce'
    when safety_class in ('honey','salt','dry_pantry') then 'pantry'
    when safety_class in ('water','distillate','processed_beverage') then 'beverage'
    when safety_class='non_food_safety' then 'non_food'
    else null
  end;

  return jsonb_build_object(
    'productType',product_type,
    'safetyClass',safety_class,
    'isPerishable',coalesce(product_row.is_perishable,false),
    'requiresColdChain',coalesce(product_row.requires_cold_chain,false),
    'shelfLifeDays',product_row.shelf_life_days
  );
end;
$$;
revoke all on function private.product_handling_profile_v1(uuid) from public,anon,authenticated;
grant execute on function private.product_handling_profile_v1(uuid) to postgres,service_role;

create or replace function private.list_my_favorites_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'productId',p.id,
    'legacyId',p.legacy_id,
    'slug',p.slug,
    'name',p.name,
    'shortDescription',p.short_description,
    'origin',p.origin,
    'currency',p.currency,
    'stockMode',p.stock_mode,
    'availableQuantity',case when p.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0)) else null end,
    'handlingProfile',private.product_handling_profile_v1(p.id),
    'producer',jsonb_build_object(
      'id',pr.id,
      'name',pr.display_name,
      'verified',private.is_producer_trust_badge_active_v1(pr.id),
      'originVerified',pr.origin_verified and private.is_producer_trust_badge_active_v1(pr.id),
      'locationLabel',pr.production_location,
      'storeKind',pr.store_kind,
      'storefrontTier',pr.storefront_tier,
      'badgeTone',case when pr.store_kind='official' then 'ruby' else 'blue' end,
      'storeBadgeLabel',case when pr.store_kind='official' then 'Golden Oremar Resmi Mağazası' else 'Golden Oremar Doğrulanmış Üretici' end
    ),
    'variant',case when v.id is null then jsonb_build_object('id',null) else jsonb_build_object('id',v.id,'name',v.name,'priceMinor',v.price_minor,'compareAtPriceMinor',v.compare_at_price_minor) end,
    'imagePath',private.verified_public_storage_path_v1('catalog-public',(
      select i.storage_path from public.product_images i where i.product_id=p.id order by i.is_primary desc,i.sort_order,i.created_at limit 1
    )),
    'available',p.status='published' and p.is_active=true and p.deleted_at is null
      and pr.status='active' and pr.is_verified=true and pr.deleted_at is null
      and v.id is not null
      and (p.stock_mode not in ('tracked','seasonal') or greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0))>0),
    'favoritedAt',f.created_at
  ) order by f.created_at desc),'[]'::jsonb)
  into result
  from public.favorites f
  join public.products p on p.id=f.product_id
  join public.producers pr on pr.id=p.producer_id
  left join lateral(
    select pv.* from public.product_variants pv where pv.product_id=p.id and pv.is_active=true order by pv.is_default desc,pv.created_at limit 1
  ) v on true
  left join public.product_inventory inv on inv.variant_id=v.id
  where f.user_id=caller_id;
  return result;
end;
$$;
revoke all on function private.list_my_favorites_v1() from public,anon;
grant execute on function private.list_my_favorites_v1() to authenticated,service_role;

create or replace function public.list_my_favorites_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_my_favorites_v1(); $$;
revoke all on function public.list_my_favorites_v1() from public,anon;
grant execute on function public.list_my_favorites_v1() to authenticated;
