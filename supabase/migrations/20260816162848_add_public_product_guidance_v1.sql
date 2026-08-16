create or replace function private.get_public_product_guidance_v1(p_reference text, p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  ref text := btrim(coalesce(p_reference,''));
  locale_value text := lower(btrim(coalesce(p_locale,'tr')));
  product_id uuid;
  entry public.content_entries%rowtype;
  safety jsonb;
  warning_items jsonb;
  source_items jsonb;
begin
  if char_length(ref) not between 1 and 200 then
    raise exception 'invalid_product_reference' using errcode='22023';
  end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then
    raise exception 'invalid_locale' using errcode='22023';
  end if;

  select p.id into product_id
  from public.products p
  join public.producers pr on pr.id=p.producer_id
  where (p.id::text=ref or p.legacy_id=ref or p.slug=lower(ref))
    and p.status='published' and p.is_active=true and p.deleted_at is null
    and pr.status='active' and pr.is_verified=true and pr.deleted_at is null
  limit 1;

  if product_id is null then
    raise exception 'product_not_found' using errcode='P0002';
  end if;

  select ce.* into entry
  from public.content_entries ce
  where ce.related_product_id=product_id
    and ce.content_type='product_health'
    and ce.status='published'
    and ce.deleted_at is null
    and (ce.published_at is null or ce.published_at<=timezone('utc',now()))
    and ce.locale in (locale_value,'tr')
  order by case when ce.locale=locale_value then 0 else 1 end,
           coalesce(ce.published_at,ce.created_at) desc,
           ce.created_at desc
  limit 1;

  if entry.id is null then
    return null;
  end if;

  safety := case when jsonb_typeof(entry.metadata->'safetyV2')='object'
    then entry.metadata->'safetyV2' else '{}'::jsonb end;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'severity',nullif(btrim(item->>'severity'),''),
    'text',nullif(btrim(item->>'text'),'')
  ))),'[]'::jsonb)
  into warning_items
  from jsonb_array_elements(case when jsonb_typeof(safety->'warnings')='array' then safety->'warnings' else '[]'::jsonb end) item
  where jsonb_typeof(item)='object' and nullif(btrim(item->>'text'),'') is not null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'authority',nullif(btrim(item->>'authority'),''),
    'title',nullif(btrim(item->>'title'),''),
    'topic',nullif(btrim(item->>'topic'),''),
    'url',case when coalesce(item->>'url','') ~* '^https://' then item->>'url' else null end,
    'accessedAt',nullif(btrim(item->>'accessedAt'),'')
  ))),'[]'::jsonb)
  into source_items
  from jsonb_array_elements(case when jsonb_typeof(safety->'sources')='array' then safety->'sources' else '[]'::jsonb end) item
  where jsonb_typeof(item)='object';

  return jsonb_strip_nulls(jsonb_build_object(
    'contentId',entry.id,
    'slug',entry.slug,
    'title',entry.title,
    'summary',entry.summary,
    'locale',entry.locale,
    'publishedAt',entry.published_at,
    'schemaVersion',nullif(btrim(safety->>'schemaVersion'),''),
    'guidanceKind',nullif(btrim(safety->>'guidanceKind'),''),
    'safetyClass',nullif(btrim(safety->>'safetyClass'),''),
    'preparation',jsonb_build_object(
      'title',nullif(btrim(safety->'preparation'->>'title'),''),
      'items',case when jsonb_typeof(safety->'preparation'->'items')='array' then safety->'preparation'->'items' else '[]'::jsonb end
    ),
    'storage',jsonb_build_object(
      'title',nullif(btrim(safety->'storage'->>'title'),''),
      'items',case when jsonb_typeof(safety->'storage'->'items')='array' then safety->'storage'->'items' else '[]'::jsonb end
    ),
    'allergens',jsonb_strip_nulls(jsonb_build_object(
      'known',case when jsonb_typeof(safety->'allergens'->'known')='boolean' then safety->'allergens'->'known' else null end,
      'text',nullif(btrim(safety->'allergens'->>'text'),''),
      'verifyLabel',nullif(btrim(safety->'allergens'->>'verifyLabel'),'')
    )),
    'warnings',warning_items,
    'sources',source_items
  ));
end;
$$;

create or replace function public.get_public_product_guidance_v1(p_reference text, p_locale text default 'tr')
returns jsonb
language sql
stable
set search_path to ''
as $$ select private.get_public_product_guidance_v1(p_reference,p_locale); $$;

revoke all on function public.get_public_product_guidance_v1(text,text) from public;
grant execute on function public.get_public_product_guidance_v1(text,text) to anon, authenticated;
