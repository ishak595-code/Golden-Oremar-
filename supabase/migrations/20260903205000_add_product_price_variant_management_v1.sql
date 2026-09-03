-- Canonical management contract for price-changing package/weight variants.
-- Preparation-only choices remain in product_commerce_profiles.option_schema.

create or replace function private.product_price_variants_payload_v1(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,
    'sku',v.sku,
    'name',v.name,
    'priceMinor',v.price_minor,
    'compareAtPriceMinor',v.compare_at_price_minor,
    'weightGrams',v.weight_grams,
    'default',v.is_default,
    'active',v.is_active,
    'updatedAt',v.updated_at
  ) order by v.is_default desc,v.is_active desc,v.created_at,v.id),'[]'::jsonb)
  from public.product_variants v
  where v.product_id=p_product_id;
$$;

revoke all on function private.product_price_variants_payload_v1(uuid) from public;

create or replace function private.management_save_product_price_variants_v1(p_product_id uuid,p_variants jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  owner_id uuid;
  item jsonb;
  item_id uuid;
  existing public.product_variants%rowtype;
  sku_value text;
  name_value text;
  price_value bigint;
  compare_value bigint;
  weight_value integer;
  active_value boolean;
  default_value boolean;
  expected_updated_at timestamptz;
  active_default_count integer:=0;
  item_count integer:=0;
  seen_skus text[]:='{}';
  saved_ids uuid[]:='{}';
  saved_id uuid;
  default_price bigint;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then
    raise exception 'permission_required:product.update' using errcode='42501';
  end if;
  if p_variants is null or jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants) not between 1 and 12 or pg_column_size(p_variants)>65536 then
    raise exception 'invalid_product_price_variants' using errcode='22023';
  end if;

  select * into product_row from public.products where id=p_product_id and deleted_at is null for update;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select owner_user_id into owner_id from public.producers where id=product_row.producer_id;
  if owner_id is distinct from caller_id and not coalesce(private.has_permission('product.approve'),false) then
    raise exception 'product_owner_or_admin_required' using errcode='42501';
  end if;
  if product_row.status='published' and not coalesce(private.has_permission('product.approve'),false) then
    raise exception 'permission_required:product.approve' using errcode='42501';
  end if;

  -- Validate the complete payload before mutating anything.
  for item in select value from jsonb_array_elements(p_variants)
  loop
    item_count:=item_count+1;
    if jsonb_typeof(item)<>'object' or exists(
      select 1 from jsonb_object_keys(item) key
      where key<>all(array['id','sku','name','priceMinor','compareAtPriceMinor','weightGrams','default','active','updatedAt']::text[])
    ) then raise exception 'invalid_product_price_variant:%',item_count using errcode='22023'; end if;

    begin item_id:=nullif(btrim(coalesce(item->>'id','')),'')::uuid; exception when others then raise exception 'invalid_product_price_variant_id:%',item_count using errcode='22023'; end;
    sku_value:=upper(btrim(coalesce(item->>'sku','')));
    name_value:=btrim(coalesce(item->>'name',''));
    begin price_value:=(item->>'priceMinor')::bigint; exception when others then raise exception 'invalid_product_price_variant_price:%',item_count using errcode='22023'; end;
    begin compare_value:=nullif(item->>'compareAtPriceMinor','')::bigint; exception when others then raise exception 'invalid_product_price_variant_compare_price:%',item_count using errcode='22023'; end;
    begin weight_value:=(item->>'weightGrams')::integer; exception when others then raise exception 'invalid_product_price_variant_weight:%',item_count using errcode='22023'; end;
    if item ? 'active' and jsonb_typeof(item->'active')<>'boolean' then raise exception 'invalid_product_price_variant_active:%',item_count using errcode='22023'; end if;
    if item ? 'default' and jsonb_typeof(item->'default')<>'boolean' then raise exception 'invalid_product_price_variant_default:%',item_count using errcode='22023'; end if;
    active_value:=coalesce((item->>'active')::boolean,true);
    default_value:=coalesce((item->>'default')::boolean,false);

    if sku_value !~ '^[A-Z0-9][A-Z0-9._-]{2,79}$' then raise exception 'invalid_product_price_variant_sku:%',item_count using errcode='22023'; end if;
    if char_length(name_value) not between 1 and 120 then raise exception 'invalid_product_price_variant_name:%',item_count using errcode='22023'; end if;
    if price_value not between 0 and 1000000000 then raise exception 'invalid_product_price_variant_price:%',item_count using errcode='22023'; end if;
    if compare_value is not null and (compare_value<price_value or compare_value>1000000000) then raise exception 'invalid_product_price_variant_compare_price:%',item_count using errcode='22023'; end if;
    if weight_value not between 1 and 1000000 then raise exception 'invalid_product_price_variant_weight:%',item_count using errcode='22023'; end if;
    if default_value and not active_value then raise exception 'inactive_product_price_variant_cannot_be_default:%',item_count using errcode='22023'; end if;
    if sku_value=any(seen_skus) then raise exception 'duplicate_product_price_variant_sku:%',sku_value using errcode='22023'; end if;
    seen_skus:=array_append(seen_skus,sku_value);
    if active_value and default_value then active_default_count:=active_default_count+1; end if;

    if item_id is not null then
      select * into existing from public.product_variants where id=item_id;
      if existing.id is null or existing.product_id<>product_row.id then raise exception 'product_price_variant_not_owned:%',item_id using errcode='42501'; end if;
      begin expected_updated_at:=nullif(item->>'updatedAt','')::timestamptz; exception when others then raise exception 'invalid_product_price_variant_revision:%',item_count using errcode='22023'; end;
      if expected_updated_at is null or existing.updated_at is distinct from expected_updated_at then
        raise exception 'stale_product_price_variant:%',item_id using errcode='40001';
      end if;
    end if;
  end loop;

  if active_default_count<>1 then raise exception 'exactly_one_active_default_product_price_variant_required' using errcode='22023'; end if;

  -- Clear the old default first so the partial unique default index cannot race the replacement.
  update public.product_variants set is_default=false,updated_at=timezone('utc',now())
  where product_id=product_row.id and is_default=true;

  for item in select value from jsonb_array_elements(p_variants)
  loop
    item_id:=nullif(btrim(coalesce(item->>'id','')),'')::uuid;
    sku_value:=upper(btrim(item->>'sku'));
    name_value:=btrim(item->>'name');
    price_value:=(item->>'priceMinor')::bigint;
    compare_value:=nullif(item->>'compareAtPriceMinor','')::bigint;
    weight_value:=(item->>'weightGrams')::integer;
    active_value:=coalesce((item->>'active')::boolean,true);
    default_value:=coalesce((item->>'default')::boolean,false);

    if item_id is null then
      insert into public.product_variants(product_id,sku,name,option_values,price_minor,compare_at_price_minor,weight_grams,is_default,is_active,shipping_weight_source,shipping_weight_note)
      values(product_row.id,sku_value,name_value,jsonb_build_object('packageVariant',true),price_value,compare_value,weight_value,default_value,active_value,'estimated','Admin fiyat/paket varyantı. Sevkiyat ağırlığı gerektiğinde ölçümle doğrulanır.')
      returning id into saved_id;
      insert into public.product_inventory(variant_id,available_quantity,reserved_quantity,reorder_level,version)
      values(saved_id,0,0,0,1) on conflict(variant_id) do nothing;
    else
      update public.product_variants
      set sku=sku_value,name=name_value,price_minor=price_value,compare_at_price_minor=compare_value,weight_grams=weight_value,is_default=default_value,is_active=active_value,updated_at=timezone('utc',now())
      where id=item_id and product_id=product_row.id
      returning id into saved_id;
    end if;
    saved_ids:=array_append(saved_ids,saved_id);
  end loop;

  update public.product_variants
  set is_active=false,is_default=false,updated_at=timezone('utc',now())
  where product_id=product_row.id and not(id=any(saved_ids));

  select price_minor into default_price from public.product_variants
  where product_id=product_row.id and is_active=true and is_default=true limit 1;
  if default_price is null then raise exception 'active_default_product_price_variant_missing' using errcode='23514'; end if;

  update public.products
  set base_price_minor=default_price,updated_at=timezone('utc',now())
  where id=product_row.id;

  return private.product_price_variants_payload_v1(product_row.id);
end;
$$;

revoke all on function private.management_save_product_price_variants_v1(uuid,jsonb) from public;

create or replace function public.management_save_product_price_variants_v1(p_product_id uuid,p_variants jsonb)
returns jsonb
language sql
set search_path=''
as $$ select private.management_save_product_price_variants_v1(p_product_id,p_variants); $$;
revoke all on function public.management_save_product_price_variants_v1(uuid,jsonb) from public;
grant execute on function public.management_save_product_price_variants_v1(uuid,jsonb) to authenticated;

create or replace function private.management_product_commerce_editor_v1(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  owner_id uuid;
  profile public.product_commerce_profiles%rowtype;
  can_approve boolean:=false;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  select * into product_row from public.products where id=p_product_id and deleted_at is null;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select owner_user_id into owner_id from public.producers where id=product_row.producer_id;
  can_approve:=coalesce(private.has_permission('product.approve'),false);
  if owner_id is distinct from caller_id and not can_approve then raise exception 'product_owner_or_admin_required' using errcode='42501'; end if;
  select * into profile from public.product_commerce_profiles where product_id=product_row.id;
  return jsonb_build_object(
    'product',jsonb_build_object('id',product_row.id,'name',product_row.name,'slug',product_row.slug,'stockMode',product_row.stock_mode,'status',product_row.status,'preorderLeadDays',product_row.preorder_lead_days),
    'profile',case when profile.product_id is null then jsonb_build_object('optionSchema','[]'::jsonb,'seasonalityMode','year_round','seasonStartMonth',null,'seasonEndMonth',null,'preorderEnabled',product_row.stock_mode='preorder','preparationDaysMin',null,'preparationDaysMax',product_row.preorder_lead_days,'customerSeasonNote',null,'researchBasis',null,'researchSourceLabel',null) else jsonb_build_object('optionSchema',profile.option_schema,'seasonalityMode',profile.seasonality_mode,'seasonStartMonth',profile.season_start_month,'seasonEndMonth',profile.season_end_month,'preorderEnabled',profile.preorder_enabled,'preparationDaysMin',profile.preparation_days_min,'preparationDaysMax',profile.preparation_days_max,'customerSeasonNote',profile.customer_season_note,'researchBasis',profile.research_basis,'researchSourceLabel',profile.research_source_label,'updatedAt',profile.updated_at) end,
    'variants',private.product_price_variants_payload_v1(product_row.id),
    'canManageLivePricing',(product_row.status<>'published' or can_approve),
    'windows',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'seasonYear',w.season_year,'opensAt',w.preorder_opens_at,'closesAt',w.preorder_closes_at,'fulfillmentStartsAt',w.fulfillment_starts_at,'fulfillmentEndsAt',w.fulfillment_ends_at,'status',w.status,'confirmed',w.is_confirmed,'publicNote',w.public_note,'internalNote',w.internal_note) order by w.season_year desc,w.created_at desc) from public.product_sales_windows w where w.product_id=product_row.id),'[]'::jsonb),
    'canConfirmWindow',can_approve
  );
end;
$$;

create or replace function public.management_product_commerce_editor_v1(p_product_id uuid)
returns jsonb language sql set search_path='' as $$ select private.management_product_commerce_editor_v1(p_product_id); $$;
revoke all on function public.management_product_commerce_editor_v1(uuid) from public;
grant execute on function public.management_product_commerce_editor_v1(uuid) to authenticated;
