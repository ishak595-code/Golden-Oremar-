create or replace function private.get_public_content_entry_v2(p_reference text,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  base jsonb;
  safety jsonb;
  entry_id uuid;
begin
  base:=private.get_public_content_entry_v1(p_reference,p_locale);
  entry_id:=(base->>'id')::uuid;
  select coalesce(metadata->'safetyV2','{}'::jsonb)
    into safety
  from public.content_entries
  where id=entry_id;
  return base || jsonb_build_object('safety',coalesce(safety,'{}'::jsonb));
end;
$$;
revoke all on function private.get_public_content_entry_v2(text,text) from public;

create or replace function public.get_public_content_entry_v2(p_reference text,p_locale text default 'tr')
returns jsonb
language sql
stable
set search_path to ''
as $$
  select private.get_public_content_entry_v2(p_reference,p_locale);
$$;
revoke all on function public.get_public_content_entry_v2(text,text) from public;
grant execute on function public.get_public_content_entry_v2(text,text) to anon,authenticated;

create or replace function private.get_public_product_safety_v1(p_reference text,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  target_product_id uuid;
  result jsonb;
begin
  if char_length(btrim(coalesce(p_reference,''))) not between 1 and 240 then
    raise exception 'invalid_product_reference' using errcode='22023';
  end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then
    raise exception 'invalid_locale' using errcode='22023';
  end if;

  select p.id into target_product_id
  from public.products p
  where (p.id::text=btrim(p_reference) or p.slug=btrim(p_reference) or p.legacy_id=btrim(p_reference))
    and p.status='published' and p.is_active=true and p.deleted_at is null
    and exists(
      select 1 from public.producers producer
      where producer.id=p.producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
    )
  order by case when p.id::text=btrim(p_reference) then 0 when p.slug=btrim(p_reference) then 1 else 2 end
  limit 1;

  if target_product_id is null then
    raise exception 'product_not_found' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'contentId',ce.id,
    'contentSlug',ce.slug,
    'title',ce.title,
    'summary',ce.summary,
    'safety',coalesce(ce.metadata->'safetyV2','{}'::jsonb),
    'updatedAt',ce.updated_at
  ) into result
  from public.content_entries ce
  where ce.related_product_id=target_product_id
    and ce.content_type='product_health'
    and ce.locale=locale_value
    and ce.status='published'
    and ce.deleted_at is null
    and (ce.published_at is null or ce.published_at<=timezone('utc',now()))
  order by ce.updated_at desc,ce.id
  limit 1;

  return coalesce(result,'{}'::jsonb);
end;
$$;
revoke all on function private.get_public_product_safety_v1(text,text) from public;

create or replace function public.get_public_product_safety_v1(p_reference text,p_locale text default 'tr')
returns jsonb
language sql
stable
set search_path to ''
as $$
  select private.get_public_product_safety_v1(p_reference,p_locale);
$$;
revoke all on function public.get_public_product_safety_v1(text,text) from public;
grant execute on function public.get_public_product_safety_v1(text,text) to anon,authenticated;