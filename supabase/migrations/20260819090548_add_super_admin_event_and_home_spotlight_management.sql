create or replace function private.management_upsert_event_v2(p_reference text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid := auth.uid();
  v_event_id uuid;
  current_row public.events%rowtype;
  event_row public.events%rowtype;
  normalized_title text;
  normalized_description text;
  normalized_location text;
  normalized_image text;
  normalized_status text;
  next_starts_at timestamptz;
  next_ends_at timestamptz;
  next_deadline timestamptz;
  next_capacity integer;
  has_capacity boolean := false;
  has_deadline boolean := false;
  normalized_slug text;
begin
  if caller_id is null or not coalesce(private.is_admin(), false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_event_payload' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) key
    where key not in ('title','description','image','location','startsAt','endsAt','capacity','reservationDeadline','status')
  ) then
    raise exception 'unsupported_event_field' using errcode='22023';
  end if;

  select e.* into current_row
  from public.events e
  where e.id::text=btrim(coalesce(p_reference,''))
     or e.legacy_id=btrim(coalesce(p_reference,''))
     or e.slug=btrim(coalesce(p_reference,''))
  order by e.created_at
  limit 1;
  if found then v_event_id:=current_row.id; end if;

  normalized_title := case when p_payload ? 'title' then btrim(coalesce(p_payload->>'title','')) else current_row.title end;
  normalized_description := case when p_payload ? 'description' then btrim(coalesce(p_payload->>'description','')) else current_row.description end;
  normalized_location := case when p_payload ? 'location' then btrim(coalesce(p_payload->>'location','')) else current_row.location_name end;
  normalized_image := case when p_payload ? 'image' then btrim(coalesce(p_payload->>'image','')) else current_row.image_path end;
  normalized_status := lower(btrim(coalesce(case when p_payload ? 'status' then p_payload->>'status' else current_row.status end, case when v_event_id is null then 'draft' else '' end)));

  if char_length(coalesce(normalized_title,'')) not between 2 and 180 then raise exception 'invalid_event_title' using errcode='22023'; end if;
  if char_length(coalesce(normalized_description,'')) > 20000 then raise exception 'invalid_event_description' using errcode='22023'; end if;
  if char_length(coalesce(normalized_location,'')) not between 2 and 500 then raise exception 'invalid_event_location' using errcode='22023'; end if;
  if char_length(coalesce(normalized_image,'')) > 2048 then raise exception 'invalid_event_image' using errcode='22023'; end if;
  if coalesce(normalized_image,'') ~* '^(blob:|data:|javascript:)' then raise exception 'persistent_event_image_required' using errcode='22023'; end if;
  if normalized_status not in ('draft','published','sold_out','cancelled','completed') then raise exception 'invalid_event_status' using errcode='22023'; end if;

  if p_payload ? 'startsAt' then
    begin next_starts_at := (p_payload->>'startsAt')::timestamptz; exception when others then raise exception 'invalid_event_start' using errcode='22007'; end;
  else next_starts_at := current_row.starts_at; end if;
  if p_payload ? 'endsAt' then
    begin next_ends_at := (p_payload->>'endsAt')::timestamptz; exception when others then raise exception 'invalid_event_end' using errcode='22007'; end;
  else next_ends_at := current_row.ends_at; end if;
  if v_event_id is null and (next_starts_at is null or next_ends_at is null) then raise exception 'event_dates_required' using errcode='22023'; end if;
  if next_starts_at is null or next_ends_at is null or next_ends_at <= next_starts_at then raise exception 'invalid_event_date_range' using errcode='22023'; end if;

  if p_payload ? 'capacity' then
    has_capacity := true;
    if jsonb_typeof(p_payload->'capacity')='null' then next_capacity:=null;
    elsif jsonb_typeof(p_payload->'capacity')='number' then
      begin next_capacity := (p_payload->>'capacity')::integer; exception when others then raise exception 'invalid_event_capacity' using errcode='22023'; end;
      if next_capacity < 1 or next_capacity > 1000000 then raise exception 'invalid_event_capacity' using errcode='22023'; end if;
    else raise exception 'invalid_event_capacity' using errcode='22023'; end if;
  else next_capacity := current_row.capacity; end if;

  if p_payload ? 'reservationDeadline' then
    has_deadline := true;
    if jsonb_typeof(p_payload->'reservationDeadline')='null' or btrim(coalesce(p_payload->>'reservationDeadline',''))='' then next_deadline:=null;
    else begin next_deadline := (p_payload->>'reservationDeadline')::timestamptz; exception when others then raise exception 'invalid_event_reservation_deadline' using errcode='22007'; end; end if;
  else next_deadline := current_row.reservation_deadline; end if;
  if next_deadline is not null and next_deadline > next_starts_at then raise exception 'invalid_event_reservation_deadline' using errcode='22023'; end if;

  if v_event_id is null then
    normalized_slug:=private.slugify_tr_v1(normalized_title);
    if exists(select 1 from public.events e where e.slug=normalized_slug) then normalized_slug:=normalized_slug||'-'||substr(gen_random_uuid()::text,1,8); end if;
    insert into public.events(slug,title,description,image_path,location_name,location_details,starts_at,ends_at,capacity,reservation_deadline,status)
    values(normalized_slug,normalized_title,normalized_description,nullif(normalized_image,''),normalized_location,'{}'::jsonb,next_starts_at,next_ends_at,next_capacity,next_deadline,normalized_status)
    returning * into event_row;
  else
    update public.events set
      title=normalized_title,
      description=normalized_description,
      image_path=nullif(normalized_image,''),
      location_name=normalized_location,
      starts_at=next_starts_at,
      ends_at=next_ends_at,
      capacity=case when has_capacity then next_capacity else capacity end,
      reservation_deadline=case when has_deadline then next_deadline else reservation_deadline end,
      status=normalized_status,
      updated_at=timezone('utc',now())
    where id=v_event_id
    returning * into event_row;
  end if;

  return jsonb_build_object('id',coalesce(event_row.legacy_id,event_row.slug),'databaseId',event_row.id,'status',event_row.status);
end;
$$;

create or replace function public.management_upsert_event_v2(p_reference text,p_payload jsonb)
returns jsonb language sql set search_path='' as $$ select private.management_upsert_event_v2(p_reference,p_payload); $$;
revoke all on function public.management_upsert_event_v2(text,jsonb) from public,anon;
grant execute on function public.management_upsert_event_v2(text,jsonb) to authenticated;

create or replace function private.admin_update_event_spotlight_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  settings public.brand_settings%rowtype;
  normalized jsonb;
  featured_ref text;
  max_items integer;
  placement text;
begin
  if caller_id is null or not private.has_role('super_admin') then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_event_spotlight_payload' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('enabled','title','subtitle','maxItems','featuredEventReference','showCountdown','showCapacity','showShare','showAllLink','placement')) then
    raise exception 'unsupported_event_spotlight_setting' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload->'enabled')<>'boolean' or jsonb_typeof(p_payload->'showCountdown')<>'boolean' or jsonb_typeof(p_payload->'showCapacity')<>'boolean' or jsonb_typeof(p_payload->'showShare')<>'boolean' or jsonb_typeof(p_payload->'showAllLink')<>'boolean' then
    raise exception 'invalid_event_spotlight_boolean' using errcode='22023';
  end if;
  if char_length(btrim(coalesce(p_payload->>'title',''))) not between 2 and 120 or char_length(btrim(coalesce(p_payload->>'subtitle',''))) > 300 then raise exception 'invalid_event_spotlight_copy' using errcode='22023'; end if;
  begin max_items:=(p_payload->>'maxItems')::integer; exception when others then raise exception 'invalid_event_spotlight_max_items' using errcode='22023'; end;
  if max_items not between 1 and 6 then raise exception 'invalid_event_spotlight_max_items' using errcode='22023'; end if;
  placement:=btrim(coalesce(p_payload->>'placement',''));
  if placement not in ('after_hero','after_categories','before_products') then raise exception 'invalid_event_spotlight_placement' using errcode='22023'; end if;
  featured_ref:=nullif(btrim(coalesce(p_payload->>'featuredEventReference','')),'');
  if featured_ref is not null then
    if char_length(featured_ref)>220 then raise exception 'invalid_featured_event_reference' using errcode='22023'; end if;
    if not exists(select 1 from public.events e where e.id::text=featured_ref or e.slug=featured_ref or e.legacy_id=featured_ref) then raise exception 'featured_event_not_found' using errcode='22023'; end if;
  end if;
  normalized:=jsonb_build_object(
    'enabled',(p_payload->>'enabled')::boolean,
    'title',btrim(p_payload->>'title'),
    'subtitle',btrim(coalesce(p_payload->>'subtitle','')),
    'maxItems',max_items,
    'featuredEventReference',featured_ref,
    'showCountdown',(p_payload->>'showCountdown')::boolean,
    'showCapacity',(p_payload->>'showCapacity')::boolean,
    'showShare',(p_payload->>'showShare')::boolean,
    'showAllLink',(p_payload->>'showAllLink')::boolean,
    'placement',placement
  );
  update public.brand_settings
  set public_config=jsonb_set(public_config,'{eventSpotlight}',normalized,true),updated_at=timezone('utc',now())
  where slug='golden-oremar'
  returning * into settings;
  if not found then raise exception 'brand_configuration_not_found' using errcode='P0002'; end if;
  return normalized||jsonb_build_object('updatedAt',settings.updated_at);
end;
$$;

create or replace function public.admin_update_event_spotlight_v1(p_payload jsonb)
returns jsonb language sql set search_path='' as $$ select private.admin_update_event_spotlight_v1(p_payload); $$;
revoke all on function public.admin_update_event_spotlight_v1(jsonb) from public,anon;
grant execute on function public.admin_update_event_spotlight_v1(jsonb) to authenticated;

update public.brand_settings
set public_config=jsonb_set(public_config,'{eventSpotlight}',coalesce(public_config->'eventSpotlight',jsonb_build_object(
  'enabled',true,
  'title','Yaklaşan etkinlikler',
  'subtitle','Herkese açık etkinlikleri keşfedin, yerinizi ayırın veya kontenjan dolduysa bekleme listesine katılın.',
  'maxItems',3,
  'featuredEventReference',null,
  'showCountdown',true,
  'showCapacity',true,
  'showShare',true,
  'showAllLink',true,
  'placement','after_hero'
)),true),updated_at=timezone('utc',now())
where slug='golden-oremar';

create or replace function private.get_public_storefront_config_v1(p_locale text default 'tr')
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  settings public.brand_settings%rowtype;
  interface_entry public.content_entries%rowtype;
  interface_payload jsonb:='{}'::jsonb;
  readiness_status text;
  readiness_message text;
begin
  if locale_value not in ('tr','en','de','fr','ku','ar') then locale_value:='tr'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_configuration_missing' using errcode='P0002'; end if;
  select entry.* into interface_entry from public.content_entries entry
  where entry.deleted_at is null and entry.status='published' and entry.legacy_source='repository-static-content-v1' and entry.legacy_id='interface' and entry.locale in (locale_value,'tr')
  order by case when entry.locale=locale_value then 0 else 1 end,entry.published_at desc nulls last,entry.updated_at desc limit 1;
  if interface_entry.id is not null then
    begin interface_payload:=interface_entry.body_markdown::jsonb; if jsonb_typeof(interface_payload)<>'object' then interface_payload:='{}'::jsonb; end if; exception when others then interface_payload:='{}'::jsonb; end;
  end if;
  readiness_status:=coalesce(settings.public_config#>>'{launchReadiness,status}','unknown');
  readiness_message:=case when readiness_status='blocked_pending_business_identity' then 'Canlı satış açılmadan önce işletme ve destek kimliği tamamlanmalıdır.' when readiness_status='ready' then 'Canlı satış için temel yapılandırma hazır.' else 'Satış hazırlık durumu yapılandırılıyor.' end;
  return jsonb_build_object(
    'brand',jsonb_build_object('slug',settings.slug,'name',settings.brand_name,'defaultLocale',settings.default_locale,'defaultCurrency',settings.default_currency),
    'interface',interface_payload,
    'heroCategories',coalesce(settings.public_config->'heroCategories','[]'::jsonb),
    'homeSections',coalesce(settings.public_config->'homeSections','[]'::jsonb),
    'eventSpotlight',coalesce(settings.public_config->'eventSpotlight','{}'::jsonb),
    'salesReadiness',jsonb_build_object('status',readiness_status,'message',readiness_message),
    'updatedAt',settings.updated_at
  );
end;
$$;