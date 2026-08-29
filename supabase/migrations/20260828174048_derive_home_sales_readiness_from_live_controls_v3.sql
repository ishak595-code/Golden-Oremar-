-- Golden Oremar Home readiness v3
-- Derive the public Home sales-readiness projection from canonical legal and payment controls.
-- This prevents persisted launch copy from becoming stale after identity/payment state changes.

create or replace function private.home_sales_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  legal jsonb:=private.commercial_checkout_legal_readiness_v1();
  payment jsonb:=private.get_checkout_payment_readiness_v3();
  legal_ready boolean:=coalesce((legal->>'ready')::boolean,false);
  live_payments boolean:=coalesce((payment->>'liveCardPaymentsEnabled')::boolean,false);
  provider_configuration_required boolean:=coalesce((payment->>'requiresProviderConfiguration')::boolean,true);
begin
  if not legal_ready then
    return jsonb_build_object(
      'status','blocked_pending_business_identity',
      'message','Canlı satış açılmadan önce işletme kimliği ve yasal belgeler doğrulanmalıdır.'
    );
  end if;

  if not live_payments then
    return jsonb_build_object(
      'status',case when provider_configuration_required then 'blocked_pending_payment_provider_configuration' else 'blocked_pending_live_payment_enablement' end,
      'message','Katalog kullanıma hazır; canlı ödeme altyapısı production sağlayıcı yapılandırması tamamlanana kadar kapalıdır.'
    );
  end if;

  return jsonb_build_object(
    'status','ready',
    'message','Canlı satış için yasal kimlik ve ödeme altyapısı hazır.'
  );
end;
$function$;

revoke all on function private.home_sales_readiness_v1() from public,anon,authenticated;
grant execute on function private.home_sales_readiness_v1() to service_role;

create or replace function private.get_public_storefront_config_v1(p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  settings public.brand_settings%rowtype;
  interface_entry public.content_entries%rowtype;
  interface_payload jsonb:='{}'::jsonb;
  readiness jsonb;
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
  readiness:=private.home_sales_readiness_v1();
  return jsonb_build_object(
    'brand',jsonb_build_object('slug',settings.slug,'name',settings.brand_name,'defaultLocale',settings.default_locale,'defaultCurrency',settings.default_currency),
    'interface',interface_payload,
    'heroCategories',coalesce(settings.public_config->'heroCategories','[]'::jsonb),
    'homeSections',coalesce(settings.public_config->'homeSections','[]'::jsonb),
    'eventSpotlight',coalesce(settings.public_config->'eventSpotlight','{}'::jsonb),
    'salesReadiness',readiness,
    'updatedAt',settings.updated_at
  );
end;
$function$;
