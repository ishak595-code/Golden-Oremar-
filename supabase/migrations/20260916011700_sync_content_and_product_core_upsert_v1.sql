-- Drift closure: content entry upsert (with health-claim rejection) and the
-- product core upsert, which routes producer edits of already-published
-- products into a change-request queue instead of applying them directly.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.management_upsert_content_v1(p_reference text, p_content_type text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_type text := lower(btrim(coalesce(p_content_type, '')));
  entry_id uuid;
  normalized_title text;
  normalized_slug text;
  normalized_body text;
  v_related_product_id uuid;
  metadata_value jsonb;
  entry_row public.content_entries%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('content.update'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if normalized_type not in ('blog', 'recipe', 'health_guide', 'product_health')
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_content_payload' using errcode = '22023';
  end if;
  select entry.id into entry_id
  from public.content_entries entry
  where entry.deleted_at is null
    and (entry.id::text = btrim(coalesce(p_reference, '')) or entry.legacy_id = btrim(coalesce(p_reference, '')))
  order by entry.created_at
  limit 1;

  normalized_title := btrim(coalesce(p_payload ->> 'title', ''));
  normalized_body := btrim(coalesce(p_payload ->> 'content', ''));
  if entry_id is null and char_length(normalized_title) not between 2 and 240 then
    raise exception 'content_title_required' using errcode = '22023';
  end if;
  if p_payload ? 'title' and char_length(normalized_title) not between 2 and 240 then
    raise exception 'invalid_content_title' using errcode = '22023';
  end if;
  if char_length(coalesce(p_payload ->> 'summary', '')) > 2000
    or char_length(normalized_body) > 200000
    or char_length(coalesce(p_payload ->> 'image', '')) > 2048 then
    raise exception 'invalid_content_field_length' using errcode = '22023';
  end if;
  if coalesce(p_payload ->> 'image', '') ~* '^(blob:|data:)' then
    raise exception 'persistent_content_image_required' using errcode = '22023';
  end if;
  if (normalized_title || ' ' || normalized_body || ' ' || coalesce(p_payload ->> 'summary', ''))
    ~* '(tedavi eder|doğal antibiyotik|mucize|kanseri? (önler|iyileştirir)|kolesterolü düşürür|kan şekerini dengeler|hastalıklara karşı zırh)' then
    raise exception 'unsupported_health_claim' using errcode = '22023';
  end if;

  if normalized_type = 'product_health' then
    v_related_product_id := private.resolve_product_id_v1(p_payload ->> 'productId');
    if v_related_product_id is null and entry_id is null then
      raise exception 'related_product_required' using errcode = '22023';
    end if;
  end if;
  metadata_value := jsonb_strip_nulls(jsonb_build_object(
    'originalDate', nullif(btrim(coalesce(p_payload ->> 'date', '')), ''),
    'originalCategory', nullif(btrim(coalesce(p_payload ->> 'category', '')), '')
  ));

  if entry_id is null then
    normalized_slug := private.slugify_tr_v1(normalized_title);
    if normalized_slug = '' then raise exception 'invalid_content_slug' using errcode = '22023'; end if;
    if exists (
      select 1 from public.content_entries entry
      where entry.content_type = normalized_type and entry.slug = normalized_slug and entry.locale = 'tr'
    ) then
      normalized_slug := normalized_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
    insert into public.content_entries(
      content_type, slug, title, summary, body_markdown, body_html_sanitized,
      hero_image_path, author_user_id, related_product_id, status, locale, metadata, published_at
    ) values (
      normalized_type,
      normalized_slug,
      normalized_title,
      btrim(coalesce(p_payload ->> 'summary', '')),
      normalized_body,
      '',
      nullif(btrim(coalesce(p_payload ->> 'image', '')), ''),
      caller_id,
      v_related_product_id,
      'published',
      'tr',
      metadata_value,
      timezone('utc', now())
    ) returning * into entry_row;
  else
    update public.content_entries
    set title = case when p_payload ? 'title' then normalized_title else title end,
        summary = case when p_payload ? 'summary' then btrim(coalesce(p_payload ->> 'summary', '')) else summary end,
        body_markdown = case when p_payload ? 'content' then normalized_body else body_markdown end,
        body_html_sanitized = case when p_payload ? 'content' then '' else body_html_sanitized end,
        hero_image_path = case when p_payload ? 'image' then nullif(btrim(coalesce(p_payload ->> 'image', '')), '') else hero_image_path end,
        related_product_id = coalesce(v_related_product_id, public.content_entries.related_product_id),
        metadata = metadata || metadata_value,
        status = 'published',
        published_at = coalesce(published_at, timezone('utc', now())),
        deleted_at = null
    where id = entry_id
    returning * into entry_row;
  end if;

  return jsonb_build_object(
    'id', coalesce(entry_row.legacy_id, entry_row.id::text),
    'databaseId', entry_row.id,
    'contentType', entry_row.content_type,
    'status', entry_row.status
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.management_upsert_product_core_v1(p_reference text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
  caller_producer_id uuid;
  v_product_id uuid := private.resolve_product_id_v1(p_reference);
  product_row public.products%rowtype;
  v_category_id uuid;
  v_producer_id uuid;
  normalized_name text;
  normalized_slug text;
  next_base_price bigint;
  next_compare_price bigint;
  next_status text;
  next_is_active boolean;
  next_specifications jsonb;
  next_features jsonb;
  next_tags text[];
  default_variant_id uuid;
  next_stock integer;
  media_values jsonb := '[]'::jsonb;
  media_path text;
  media_index integer := 0;
  change_request_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 262144 then
    raise exception 'invalid_product_payload' using errcode = '22023';
  end if;

  caller_is_admin := true;
  select producer.id into caller_producer_id
  from public.producers producer
  where producer.owner_user_id = caller_id
    and producer.deleted_at is null
    and producer.status = 'active'
  order by producer.created_at desc
  limit 1;
  if not caller_is_admin and caller_producer_id is null then
    raise exception 'active_producer_required' using errcode = '42501';
  end if;

  if v_product_id is not null then
    select * into product_row
    from public.products product
    where product.id = v_product_id
    for update;
    if not caller_is_admin and product_row.producer_id <> caller_producer_id then
      raise exception 'product_access_denied' using errcode = '42501';
    end if;
    if not caller_is_admin and product_row.status = 'published' then
      insert into public.product_change_requests(product_id, producer_id, requested_by, proposed_payload)
      values (product_row.id, product_row.producer_id, caller_id, p_payload)
      on conflict (product_id) where status = 'pending'
      do update set
        proposed_payload = excluded.proposed_payload,
        requested_by = excluded.requested_by,
        updated_at = timezone('utc', now())
      returning id into change_request_id;

      insert into public.notifications(user_id, type, title, message, action_url, metadata)
      select role.user_id, 'producer', 'Ürün değişikliği inceleme bekliyor',
        product_row.name || ' ürünü için satıcı değişiklik talebi gönderildi.',
        '/admin/products',
        jsonb_build_object('productId', product_row.id, 'changeRequestId', change_request_id)
      from private.user_roles role
      join public.profiles profile on profile.id = role.user_id and profile.status = 'active'
      where role.role in ('admin', 'super_admin')
        and (role.expires_at is null or role.expires_at > timezone('utc', now()))
      on conflict do nothing;

      return jsonb_build_object(
        'id', coalesce(product_row.legacy_id, product_row.id::text),
        'databaseId', product_row.id,
        'status', 'pending_change_review',
        'changeRequestId', change_request_id
      );
    end if;
  end if;

  normalized_name := btrim(coalesce(p_payload ->> 'name', ''));
  if v_product_id is null and char_length(normalized_name) not between 2 and 180 then
    raise exception 'product_name_required' using errcode = '22023';
  end if;
  if p_payload ? 'name' and char_length(normalized_name) not between 2 and 180 then
    raise exception 'invalid_product_name' using errcode = '22023';
  end if;
  if char_length(coalesce(p_payload ->> 'description', '')) > 20000
    or char_length(coalesce(p_payload ->> 'story', '')) > 20000
    or char_length(coalesce(p_payload ->> 'origin', '')) > 500
    or char_length(coalesce(p_payload ->> 'unit', '')) > 80
    or char_length(coalesce(p_payload ->> 'video', '')) > 2048 then
    raise exception 'invalid_product_field_length' using errcode = '22023';
  end if;
  if coalesce(p_payload ->> 'video', '') ~* '^(blob:|data:)' then
    raise exception 'persistent_product_media_required' using errcode = '22023';
  end if;
  if p_payload ? 'price' and jsonb_typeof(p_payload -> 'price') <> 'number' then
    raise exception 'invalid_product_price' using errcode = '22023';
  end if;
  if p_payload ? 'originalPrice' and jsonb_typeof(p_payload -> 'originalPrice') <> 'number' then
    raise exception 'invalid_compare_price' using errcode = '22023';
  end if;
  if p_payload ? 'stock' and jsonb_typeof(p_payload -> 'stock') <> 'number' then
    raise exception 'invalid_product_stock' using errcode = '22023';
  end if;
  if p_payload ? 'tags' and jsonb_typeof(p_payload -> 'tags') <> 'array' then
    raise exception 'invalid_product_tags' using errcode = '22023';
  end if;
  if p_payload ? 'features' and jsonb_typeof(p_payload -> 'features') <> 'array' then
    raise exception 'invalid_product_features' using errcode = '22023';
  end if;

  if v_product_id is null or p_payload ? 'category' or p_payload ? 'categoryId' then
    v_category_id := private.resolve_category_id_v1(coalesce(nullif(p_payload ->> 'categoryId', ''), p_payload ->> 'category'));
    if v_category_id is null then
      raise exception 'category_not_found' using errcode = 'P0002';
    end if;
  else
    v_category_id := product_row.category_id;
  end if;

  if v_product_id is null then
    if caller_is_admin then
      v_producer_id := nullif(p_payload ->> 'vendor_id', '')::uuid;
      if v_producer_id is null or not exists (
        select 1 from public.producers producer
        where producer.id = v_producer_id and producer.deleted_at is null
      ) then
        select producer.id into v_producer_id
        from public.producers producer
        where producer.status = 'active' and producer.deleted_at is null
        order by producer.is_verified desc, producer.created_at
        limit 1;
      end if;
    else
      v_producer_id := caller_producer_id;
    end if;
    if v_producer_id is null then
      raise exception 'producer_not_found' using errcode = 'P0002';
    end if;
  else
    v_producer_id := product_row.producer_id;
  end if;

  next_base_price := case
    when p_payload ? 'price' then round((p_payload ->> 'price')::numeric * 100)::bigint
    when v_product_id is not null then product_row.base_price_minor
    else 0
  end;
  if next_base_price < 0 or next_base_price > 100000000 then
    raise exception 'product_price_out_of_range' using errcode = '22023';
  end if;
  next_compare_price := case
    when p_payload ? 'originalPrice' then round((p_payload ->> 'originalPrice')::numeric * 100)::bigint
    when v_product_id is not null then product_row.compare_at_price_minor
    else next_base_price
  end;
  if next_compare_price is not null and next_compare_price < next_base_price then
    next_compare_price := next_base_price;
  end if;

  next_features := case
    when p_payload ? 'features' then p_payload -> 'features'
    when v_product_id is not null then product_row.features
    else '[]'::jsonb
  end;
  next_tags := case
    when p_payload ? 'tags' then array(select jsonb_array_elements_text(p_payload -> 'tags'))
    when v_product_id is not null then product_row.tags
    else '{}'::text[]
  end;
  if coalesce(array_length(next_tags, 1), 0) > 30
    or exists (select 1 from unnest(next_tags) tag where char_length(tag) > 80) then
    raise exception 'invalid_product_tags' using errcode = '22023';
  end if;
  if jsonb_array_length(next_features) > 40 then
    raise exception 'too_many_product_features' using errcode = '22023';
  end if;

  next_specifications := case when v_product_id is null then '{}'::jsonb else product_row.specifications end;
  if p_payload ? 'weight' then next_specifications := jsonb_set(next_specifications, '{originalWeight}', p_payload -> 'weight', true); end if;
  if p_payload ? 'weightOptions' then next_specifications := jsonb_set(next_specifications, '{weightOptions}', p_payload -> 'weightOptions', true); end if;
  if p_payload ? 'cutOptions' then next_specifications := jsonb_set(next_specifications, '{cutOptions}', p_payload -> 'cutOptions', true); end if;
  if p_payload ? 'preOrderTime' then next_specifications := jsonb_set(next_specifications, '{preOrderTime}', to_jsonb(coalesce(p_payload ->> 'preOrderTime', '')), true); end if;
  if p_payload ? 'pricePrefix' then next_specifications := jsonb_set(next_specifications, '{pricePrefix}', to_jsonb(coalesce(p_payload ->> 'pricePrefix', '')), true); end if;
  if p_payload ? 'video' then next_specifications := jsonb_set(next_specifications, '{video}', to_jsonb(coalesce(p_payload ->> 'video', '')), true); end if;
  if p_payload ? 'section' then next_specifications := jsonb_set(next_specifications, '{section}', to_jsonb(coalesce(p_payload ->> 'section', '')), true); end if;
  if p_payload ? 'homeSection' then next_specifications := jsonb_set(next_specifications, '{homeSection}', to_jsonb(coalesce(p_payload ->> 'homeSection', '')), true); end if;
  if p_payload ? 'verificationStatus' then next_specifications := jsonb_set(next_specifications, '{verificationStatus}', p_payload -> 'verificationStatus', true); end if;
  if p_payload ? 'claimReviewStatus' then next_specifications := jsonb_set(next_specifications, '{claimReviewStatus}', p_payload -> 'claimReviewStatus', true); end if;
  if p_payload ? 'rejection_reason' then next_specifications := jsonb_set(next_specifications, '{rejectionReason}', to_jsonb(coalesce(p_payload ->> 'rejection_reason', '')), true); end if;

  next_is_active := case
    when p_payload ? 'is_active' then (p_payload ->> 'is_active')::boolean
    when v_product_id is not null then product_row.is_active
    else true
  end;
  if caller_is_admin then
    next_status := case
      when coalesce((p_payload ->> 'is_rejected')::boolean, false) then 'rejected'
      when coalesce((p_payload ->> 'is_approved')::boolean, false) then 'published'
      when v_product_id is not null then product_row.status
      else 'draft'
    end;
  else
    next_status := 'review';
  end if;

  if v_product_id is null then
    normalized_slug := private.slugify_tr_v1(normalized_name);
    if normalized_slug = '' then raise exception 'invalid_product_slug' using errcode = '22023'; end if;
    if exists (select 1 from public.products product where product.slug = normalized_slug) then
      normalized_slug := normalized_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
    insert into public.products(
      producer_id, category_id, slug, name, short_description, description, story, origin,
      unit_label, base_price_minor, compare_at_price_minor, currency, status, stock_mode,
      preorder_lead_days, tags, features, specifications, is_active, published_at
    ) values (
      v_producer_id,
      v_category_id,
      normalized_slug,
      normalized_name,
      left(btrim(coalesce(p_payload ->> 'description', '')), 320),
      btrim(coalesce(p_payload ->> 'description', '')),
      btrim(coalesce(p_payload ->> 'story', '')),
      nullif(btrim(coalesce(p_payload ->> 'origin', '')), ''),
      coalesce(nullif(btrim(p_payload ->> 'unit'), ''), 'adet'),
      next_base_price,
      next_compare_price,
      'TRY',
      next_status,
      case when coalesce((p_payload ->> 'preOrder')::boolean, false) then 'preorder' else 'tracked' end,
      case when coalesce((p_payload ->> 'preOrder')::boolean, false) then 3 else null end,
      next_tags,
      next_features,
      next_specifications,
      next_is_active,
      case when next_status = 'published' then timezone('utc', now()) else null end
    ) returning * into product_row;
    v_product_id := product_row.id;
  else
    update public.products
    set category_id = v_category_id,
        name = case when p_payload ? 'name' then normalized_name else name end,
        short_description = case when p_payload ? 'description' then left(btrim(coalesce(p_payload ->> 'description', '')), 320) else short_description end,
        description = case when p_payload ? 'description' then btrim(coalesce(p_payload ->> 'description', '')) else description end,
        story = case when p_payload ? 'story' then btrim(coalesce(p_payload ->> 'story', '')) else story end,
        origin = case when p_payload ? 'origin' then nullif(btrim(coalesce(p_payload ->> 'origin', '')), '') else origin end,
        unit_label = case when p_payload ? 'unit' then coalesce(nullif(btrim(p_payload ->> 'unit'), ''), unit_label) else unit_label end,
        base_price_minor = next_base_price,
        compare_at_price_minor = next_compare_price,
        tags = next_tags,
        features = next_features,
        specifications = next_specifications,
        stock_mode = case when p_payload ? 'preOrder' then case when (p_payload ->> 'preOrder')::boolean then 'preorder' else 'tracked' end else stock_mode end,
        preorder_lead_days = case when p_payload ? 'preOrder' then case when (p_payload ->> 'preOrder')::boolean then coalesce(preorder_lead_days, 3) else null end else preorder_lead_days end,
        status = next_status,
        is_active = next_is_active,
        published_at = case when next_status = 'published' then coalesce(published_at, timezone('utc', now())) else null end
    where id = v_product_id
    returning * into product_row;
  end if;

  select variant.id into default_variant_id
  from public.product_variants variant
  where variant.product_id = v_product_id
  order by variant.is_default desc, variant.created_at
  limit 1
  for update;

  if default_variant_id is null then
    insert into public.product_variants(product_id, sku, name, price_minor, compare_at_price_minor, weight_grams, is_default, is_active)
    values (
      v_product_id,
      'GO-' || upper(substr(replace(v_product_id::text, '-', ''), 1, 12)),
      'Standart',
      next_base_price,
      next_compare_price,
      case when p_payload ? 'weight' then greatest(1, round((p_payload ->> 'weight')::numeric * 1000)::integer) else null end,
      true,
      true
    )
    returning id into default_variant_id;
  else
    update public.product_variants
    set price_minor = next_base_price,
        compare_at_price_minor = next_compare_price,
        weight_grams = case when p_payload ? 'weight' then greatest(1, round((p_payload ->> 'weight')::numeric * 1000)::integer) else weight_grams end,
        is_active = true
    where id = default_variant_id;
  end if;

  if p_payload ? 'stock' then
    next_stock := floor((p_payload ->> 'stock')::numeric)::integer;
    if next_stock < 0 or next_stock > 100000000 then
      raise exception 'product_stock_out_of_range' using errcode = '22023';
    end if;
    insert into public.product_inventory(variant_id, available_quantity, reserved_quantity, reorder_level)
    values (default_variant_id, next_stock, 0, least(10, next_stock))
    on conflict (variant_id) do update
    set available_quantity = greatest(excluded.available_quantity, public.product_inventory.reserved_quantity),
        reorder_level = least(10, greatest(excluded.available_quantity, public.product_inventory.reserved_quantity)),
        version = public.product_inventory.version + 1;
  elsif not exists (select 1 from public.product_inventory inventory where inventory.variant_id = default_variant_id) then
    insert into public.product_inventory(variant_id, available_quantity, reserved_quantity, reorder_level)
    values (default_variant_id, 0, 0, 0);
  end if;

  if p_payload ? 'gallery' or p_payload ? 'image' then
    if p_payload ? 'gallery' and jsonb_typeof(p_payload -> 'gallery') <> 'array' then
      raise exception 'invalid_product_gallery' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(p_payload ->> 'image', '')), '') is not null then
      media_values := jsonb_build_array(btrim(p_payload ->> 'image'));
    end if;
    if p_payload ? 'gallery' then media_values := media_values || (p_payload -> 'gallery'); end if;
    if jsonb_array_length(media_values) > 11 then
      raise exception 'too_many_product_images' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(media_values) value
      where char_length(value) > 2048 or value ~* '^(blob:|data:)'
    ) then
      raise exception 'persistent_product_image_required' using errcode = '22023';
    end if;

    delete from public.product_images image where image.product_id = v_product_id;
    media_index := 0;
    for media_path in
      select value
      from (
        select value, min(ordinality) as first_position
        from jsonb_array_elements_text(media_values) with ordinality media(value, ordinality)
        where btrim(value) <> ''
        group by value
      ) unique_media
      order by first_position
      limit 10
    loop
      insert into public.product_images(product_id, storage_path, alt_text, sort_order, is_primary)
      values (v_product_id, media_path, product_row.name, media_index, media_index = 0);
      media_index := media_index + 1;
    end loop;
  end if;

  if not caller_is_admin then
    insert into public.notifications(user_id, type, title, message, action_url, metadata)
    select role.user_id, 'producer', 'Yeni ürün inceleme bekliyor',
      product_row.name || ' ürünü satıcı tarafından incelemeye gönderildi.',
      '/admin/products',
      jsonb_build_object('productId', product_row.id, 'producerId', product_row.producer_id)
    from private.user_roles role
    join public.profiles profile on profile.id = role.user_id and profile.status = 'active'
    where role.role in ('admin', 'super_admin')
      and (role.expires_at is null or role.expires_at > timezone('utc', now()))
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'id', coalesce(product_row.legacy_id, product_row.id::text),
    'databaseId', product_row.id,
    'status', product_row.status,
    'is_approved', product_row.status = 'published',
    'is_rejected', product_row.status = 'rejected'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.management_upsert_content_v1(p_reference text, p_content_type text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_upsert_content_v1(p_reference, p_content_type, p_payload); $function$
;
