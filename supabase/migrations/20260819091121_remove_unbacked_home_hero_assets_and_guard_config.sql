update public.brand_settings
set public_config=jsonb_set(
  public_config,
  '{heroCategories}',
  coalesce((
    select jsonb_agg(
      case
        when coalesce(item->>'image','') ~ '^/images/products/' then jsonb_set(item,'{image}','""'::jsonb,true)
        else item
      end
      order by ordinality
    )
    from jsonb_array_elements(coalesce(public_config->'heroCategories','[]'::jsonb)) with ordinality as rows(item,ordinality)
  ),'[]'::jsonb),
  true
),updated_at=timezone('utc',now())
where slug='golden-oremar';

create or replace function private.guard_brand_public_config_v1()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if jsonb_typeof(coalesce(new.public_config->'heroCategories','[]'::jsonb))<>'array' then
    raise exception 'invalid_hero_categories' using errcode='22023';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(coalesce(new.public_config->'heroCategories','[]'::jsonb)) item
    where btrim(coalesce(item->>'image',''))<>''
      and (
        btrim(item->>'image') ~ '^/'
        or btrim(item->>'image') ~* '^[a-z][a-z0-9+.-]*:'
        or btrim(item->>'image') ~ '(^|/)\.\.?(/|$)'
        or position(E'\\' in btrim(item->>'image'))>0
      )
  ) then
    raise exception 'invalid_hero_category_image' using errcode='22023';
  end if;
  return new;
end;
$$;

drop trigger if exists brand_settings_public_config_guard on public.brand_settings;
create trigger brand_settings_public_config_guard
before insert or update of public_config on public.brand_settings
for each row execute function private.guard_brand_public_config_v1();