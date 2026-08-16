create or replace function private.get_public_storefront_config_v1(p_locale text default 'tr'::text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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

  select entry.* into interface_entry
  from public.content_entries entry
  where entry.deleted_at is null and entry.status='published'
    and entry.legacy_source='repository-static-content-v1' and entry.legacy_id='interface'
    and entry.locale in (locale_value,'tr')
  order by case when entry.locale=locale_value then 0 else 1 end,entry.published_at desc nulls last,entry.updated_at desc
  limit 1;
  if interface_entry.id is not null then
    begin
      interface_payload:=interface_entry.body_markdown::jsonb;
      if jsonb_typeof(interface_payload)<>'object' then interface_payload:='{}'::jsonb; end if;
    exception when others then interface_payload:='{}'::jsonb; end;
  end if;

  readiness_status:=coalesce(settings.public_config#>>'{launchReadiness,status}','unknown');
  readiness_message:=case
    when readiness_status='blocked_pending_business_identity' then 'Canlı satış açılmadan önce işletme ve destek kimliği tamamlanmalıdır.'
    when readiness_status='ready' then 'Canlı satış için temel yapılandırma hazır.'
    else 'Satış hazırlık durumu yapılandırılıyor.'
  end;

  return jsonb_build_object(
    'brand',jsonb_build_object('slug',settings.slug,'name',settings.brand_name,'defaultLocale',settings.default_locale,'defaultCurrency',settings.default_currency),
    'interface',interface_payload,
    'heroCategories',coalesce(settings.public_config->'heroCategories','[]'::jsonb),
    'homeSections',coalesce(settings.public_config->'homeSections','[]'::jsonb),
    'salesReadiness',jsonb_build_object('status',readiness_status,'message',readiness_message),
    'updatedAt',settings.updated_at
  );
end;
$function$;
