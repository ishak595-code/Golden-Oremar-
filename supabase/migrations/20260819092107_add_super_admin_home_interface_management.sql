create or replace function private.admin_update_home_interface_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  entry_row public.content_entries%rowtype;
  current_payload jsonb;
  next_payload jsonb;
  hero_title text;
  hero_subtitle text;
  hero_button text;
  categories_title text;
  footer_text text;
begin
  if auth.uid() is null or not private.has_role('super_admin') then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_home_interface_payload' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('heroTitle','heroSubtitle','heroButtonText','categoriesTitle','footerText')) then
    raise exception 'unsupported_home_interface_field' using errcode='22023';
  end if;

  select * into entry_row
  from public.content_entries
  where legacy_source='repository-static-content-v1' and legacy_id='interface' and locale='tr' and deleted_at is null
  order by updated_at desc
  limit 1
  for update;
  if not found then raise exception 'home_interface_not_found' using errcode='P0002'; end if;

  begin current_payload:=entry_row.body_markdown::jsonb; exception when others then raise exception 'invalid_home_interface_storage' using errcode='22023'; end;
  if jsonb_typeof(current_payload)<>'object' then raise exception 'invalid_home_interface_storage' using errcode='22023'; end if;

  hero_title:=btrim(coalesce(p_payload->>'heroTitle',current_payload->>'heroTitle',''));
  hero_subtitle:=btrim(coalesce(p_payload->>'heroSubtitle',current_payload->>'heroSubtitle',''));
  hero_button:=btrim(coalesce(p_payload->>'heroButtonText',current_payload->>'heroButtonText',''));
  categories_title:=btrim(coalesce(p_payload->>'categoriesTitle',current_payload->>'categoriesTitle',''));
  footer_text:=btrim(coalesce(p_payload->>'footerText',current_payload->>'footerText',''));

  if char_length(hero_title) not between 2 and 180 then raise exception 'invalid_home_hero_title' using errcode='22023'; end if;
  if char_length(hero_subtitle) not between 2 and 500 then raise exception 'invalid_home_hero_subtitle' using errcode='22023'; end if;
  if char_length(hero_button) not between 2 and 80 then raise exception 'invalid_home_hero_button' using errcode='22023'; end if;
  if char_length(categories_title) not between 2 and 160 then raise exception 'invalid_home_categories_title' using errcode='22023'; end if;
  if char_length(footer_text)>500 then raise exception 'invalid_home_footer_text' using errcode='22023'; end if;

  next_payload:=current_payload||jsonb_build_object(
    'heroTitle',hero_title,
    'heroSubtitle',hero_subtitle,
    'heroButtonText',hero_button,
    'categoriesTitle',categories_title,
    'footerText',footer_text
  );
  update public.content_entries set body_markdown=next_payload::text,updated_at=timezone('utc',now()) where id=entry_row.id returning * into entry_row;
  return next_payload||jsonb_build_object('updatedAt',entry_row.updated_at);
end;
$$;

create or replace function public.admin_update_home_interface_v1(p_payload jsonb)
returns jsonb language sql set search_path='' as $$ select private.admin_update_home_interface_v1(p_payload); $$;
revoke all on function public.admin_update_home_interface_v1(jsonb) from public,anon;
grant execute on function public.admin_update_home_interface_v1(jsonb) to authenticated;