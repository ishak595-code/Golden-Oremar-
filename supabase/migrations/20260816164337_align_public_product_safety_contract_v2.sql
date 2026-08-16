create or replace function private.get_public_product_safety_v1(p_reference text, p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  ref text:=btrim(coalesce(p_reference,''));
  locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  target_product_id uuid;
  entry public.content_entries%rowtype;
  raw_safety jsonb;
  warning_items jsonb;
  source_items jsonb;
  known_allergens jsonb;
  verification_items jsonb;
begin
  if char_length(ref) not between 1 and 240 then
    raise exception 'invalid_product_reference' using errcode='22023';
  end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then
    raise exception 'invalid_locale' using errcode='22023';
  end if;

  select p.id into target_product_id
  from public.products p
  where (p.id::text=ref or p.slug=lower(ref) or p.legacy_id=ref)
    and p.status='published' and p.is_active=true and p.deleted_at is null
    and exists(
      select 1 from public.producers producer
      where producer.id=p.producer_id
        and producer.status='active'
        and producer.is_verified=true
        and producer.deleted_at is null
    )
  order by case when p.id::text=ref then 0 when p.slug=lower(ref) then 1 else 2 end
  limit 1;

  if target_product_id is null then
    raise exception 'product_not_found' using errcode='P0002';
  end if;

  select ce.* into entry
  from public.content_entries ce
  where ce.related_product_id=target_product_id
    and ce.content_type='product_health'
    and ce.locale in (locale_value,'tr')
    and ce.status='published'
    and ce.deleted_at is null
    and (ce.published_at is null or ce.published_at<=timezone('utc',now()))
  order by case when ce.locale=locale_value then 0 else 1 end,
           ce.updated_at desc,
           ce.id
  limit 1;

  if entry.id is null then
    return '{}'::jsonb;
  end if;

  raw_safety:=case when jsonb_typeof(entry.metadata->'safetyV2')='object'
    then entry.metadata->'safetyV2' else '{}'::jsonb end;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'code',nullif(btrim(item->>'code'),''),
    'severity',nullif(btrim(item->>'severity'),''),
    'text',nullif(btrim(item->>'text'),'')
  ))),'[]'::jsonb)
  into warning_items
  from jsonb_array_elements(case when jsonb_typeof(raw_safety->'warnings')='array' then raw_safety->'warnings' else '[]'::jsonb end) item
  where jsonb_typeof(item)='object'
    and nullif(btrim(item->>'text'),'') is not null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'authority',nullif(btrim(item->>'authority'),''),
    'title',nullif(btrim(item->>'title'),''),
    'topic',nullif(btrim(item->>'topic'),''),
    'url',case when coalesce(item->>'url','') ~* '^https://' then item->>'url' else null end,
    'accessedAt',nullif(btrim(item->>'accessedAt'),'')
  ))),'[]'::jsonb)
  into source_items
  from jsonb_array_elements(case when jsonb_typeof(raw_safety->'sources')='array' then raw_safety->'sources' else '[]'::jsonb end) item
  where jsonb_typeof(item)='object'
    and (nullif(btrim(item->>'authority'),'') is not null
      or nullif(btrim(item->>'title'),'') is not null
      or nullif(btrim(item->>'topic'),'') is not null
      or coalesce(item->>'url','') ~* '^https://');

  select coalesce(jsonb_agg(to_jsonb(value)),'[]'::jsonb)
  into known_allergens
  from jsonb_array_elements_text(case when jsonb_typeof(raw_safety->'allergens'->'known')='array' then raw_safety->'allergens'->'known' else '[]'::jsonb end) value
  where nullif(btrim(value),'') is not null;

  select coalesce(jsonb_agg(to_jsonb(value)),'[]'::jsonb)
  into verification_items
  from jsonb_array_elements_text(case when jsonb_typeof(raw_safety->'verificationNeeded')='array' then raw_safety->'verificationNeeded' else '[]'::jsonb end) value
  where nullif(btrim(value),'') is not null;

  return jsonb_build_object(
    'contentId',entry.id,
    'contentSlug',entry.slug,
    'title',entry.title,
    'summary',entry.summary,
    'locale',entry.locale,
    'safety',jsonb_strip_nulls(jsonb_build_object(
      'schemaVersion',case when jsonb_typeof(raw_safety->'schemaVersion')='number' then raw_safety->'schemaVersion' else null end,
      'guidanceKind',nullif(btrim(raw_safety->>'guidanceKind'),''),
      'safetyClass',nullif(btrim(raw_safety->>'safetyClass'),''),
      'storage',jsonb_build_object(
        'title',nullif(btrim(raw_safety->'storage'->>'title'),''),
        'items',case when jsonb_typeof(raw_safety->'storage'->'items')='array' then raw_safety->'storage'->'items' else '[]'::jsonb end
      ),
      'preparation',jsonb_build_object(
        'title',nullif(btrim(raw_safety->'preparation'->>'title'),''),
        'items',case when jsonb_typeof(raw_safety->'preparation'->'items')='array' then raw_safety->'preparation'->'items' else '[]'::jsonb end
      ),
      'warnings',warning_items,
      'allergens',jsonb_strip_nulls(jsonb_build_object(
        'known',known_allergens,
        'verifyLabel',case when jsonb_typeof(raw_safety->'allergens'->'verifyLabel')='boolean' then raw_safety->'allergens'->'verifyLabel' else null end,
        'text',nullif(btrim(raw_safety->'allergens'->>'text'),'')
      )),
      'verificationNeeded',verification_items,
      'claimPolicy',nullif(btrim(raw_safety->>'claimPolicy'),''),
      'sources',source_items
    )),
    'updatedAt',entry.updated_at
  );
end;
$$;
