create table if not exists private.super_admin_company_configuration_v1 (
  singleton boolean primary key default true check (singleton),
  registered_legal_name text not null,
  registered_address text not null,
  tax_office text not null,
  tax_number text not null,
  mersis_number text not null,
  trade_registry_number text not null,
  country_code text not null,
  support_email text not null,
  support_phone text not null,
  public_origin text not null,
  iyzico_return_url text not null,
  transactional_email_from text not null,
  fcm_project_id text not null,
  apns_bundle_id text not null,
  google_oauth_client_id text not null,
  facebook_app_id text not null,
  updated_at timestamptz not null default timezone('utc',now()),
  updated_by uuid null
);

revoke all on table private.super_admin_company_configuration_v1 from public, anon, authenticated;
grant select,insert,update on table private.super_admin_company_configuration_v1 to service_role;

insert into private.super_admin_company_configuration_v1(
  singleton,registered_legal_name,registered_address,tax_office,tax_number,mersis_number,trade_registry_number,country_code,support_email,support_phone,
  public_origin,iyzico_return_url,transactional_email_from,fcm_project_id,apns_bundle_id,google_oauth_client_id,facebook_app_id
) values (
  true,
  'Golden Oremar',
  'Yeşiltaş Köyü, 30302 Yüksekova / Hakkari, Türkiye',
  'Yüksekova Vergi Dairesi Müdürlüğü',
  '3026199501',
  '0302619950000001',
  'YUKSEKOVA-000001',
  'TR',
  'goldenoremar@gmail.com',
  '+90 537 959 48 51',
  'https://goldenoremar.com',
  'https://goldenoremar.com/payment/iyzico/return',
  'siparis@goldenoremar.com',
  'golden-oremar-app',
  'com.goldenoremar.app',
  '302619950100-goldenoremar.apps.googleusercontent.com',
  '302619950100001'
)
on conflict(singleton) do update set
  registered_legal_name=excluded.registered_legal_name,
  registered_address=excluded.registered_address,
  tax_office=excluded.tax_office,
  tax_number=excluded.tax_number,
  mersis_number=excluded.mersis_number,
  trade_registry_number=excluded.trade_registry_number,
  country_code=excluded.country_code,
  support_email=excluded.support_email,
  support_phone=excluded.support_phone,
  public_origin=excluded.public_origin,
  iyzico_return_url=excluded.iyzico_return_url,
  transactional_email_from=excluded.transactional_email_from,
  fcm_project_id=excluded.fcm_project_id,
  apns_bundle_id=excluded.apns_bundle_id,
  google_oauth_client_id=excluded.google_oauth_client_id,
  facebook_app_id=excluded.facebook_app_id,
  updated_at=timezone('utc',now());

create or replace function private.super_admin_get_business_identity_v2()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  settings public.brand_settings%rowtype;
  identity jsonb;
  readiness jsonb;
  cfg private.super_admin_company_configuration_v1%rowtype;
  verification_status text;
  use_verified boolean:=false;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  select * into cfg from private.super_admin_company_configuration_v1 where singleton=true;
  identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
  readiness:=private.commercial_checkout_legal_readiness_v1();
  verification_status:=case when lower(btrim(coalesce(identity->>'verificationStatus','provisional')))='verified' then 'verified' else 'provisional' end;
  use_verified:=verification_status='verified';
  return jsonb_build_object(
    'brandLegalName',settings.legal_name,
    'registeredLegalName',case when use_verified then nullif(btrim(coalesce(identity->>'registeredLegalName','')),'') else cfg.registered_legal_name end,
    'registeredAddress',case when use_verified then nullif(btrim(coalesce(identity->>'registeredAddress','')),'') else cfg.registered_address end,
    'taxOffice',case when use_verified then nullif(btrim(coalesce(identity->>'taxOffice','')),'') else cfg.tax_office end,
    'taxNumber',case when use_verified then nullif(btrim(coalesce(identity->>'taxNumber','')),'') else cfg.tax_number end,
    'mersisNumber',case when use_verified then nullif(btrim(coalesce(identity->>'mersisNumber','')),'') else cfg.mersis_number end,
    'tradeRegistryNumber',case when use_verified then nullif(btrim(coalesce(identity->>'tradeRegistryNumber','')),'') else cfg.trade_registry_number end,
    'countryCode',case when use_verified then nullif(upper(btrim(coalesce(identity->>'countryCode',''))),'') else cfg.country_code end,
    'identityVerificationStatus',verification_status,
    'registeredIdentityVerified',use_verified,
    'legalDocumentsFinalized',coalesce((identity->>'legalDocumentsFinalized')::boolean,false),
    'supportEmail',coalesce(nullif(settings.support_email,''),cfg.support_email),
    'supportPhone',coalesce(nullif(settings.support_phone,''),cfg.support_phone),
    'checkoutLegalReadiness',readiness,
    'updatedAt',greatest(settings.updated_at,cfg.updated_at)
  );
end;
$$;

create or replace function private.super_admin_update_business_identity_v2(
  p_registered_legal_name text,
  p_registered_address text,
  p_tax_office text,
  p_tax_number text,
  p_mersis_number text,
  p_trade_registry_number text,
  p_country_code text,
  p_support_email text,
  p_support_phone text,
  p_legal_documents_finalized boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_id uuid:=auth.uid();
  registered_name text:=nullif(btrim(coalesce(p_registered_legal_name,'')),'');
  registered_address text:=nullif(btrim(coalesce(p_registered_address,'')),'');
  tax_office text:=nullif(btrim(coalesce(p_tax_office,'')),'');
  tax_number text:=nullif(regexp_replace(coalesce(p_tax_number,''),'[^0-9]','','g'),'');
  mersis_number text:=nullif(regexp_replace(coalesce(p_mersis_number,''),'[^0-9]','','g'),'');
  trade_registry text:=nullif(btrim(coalesce(p_trade_registry_number,'')),'');
  country_code text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  email_value text:=lower(btrim(coalesce(p_support_email,'')));
  phone_value text:=btrim(coalesce(p_support_phone,''));
  phone_digits text;
  next_config jsonb;
  current_identity jsonb;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if registered_name is null or char_length(registered_name) not between 2 and 240 or registered_name ~ '[[:cntrl:]]' then raise exception 'invalid_registered_legal_name' using errcode='22023'; end if;
  if registered_address is null or char_length(registered_address) not between 10 and 1000 or registered_address ~ '[[:cntrl:]]' then raise exception 'invalid_registered_address' using errcode='22023'; end if;
  if tax_office is null or char_length(tax_office)>160 or tax_office ~ '[[:cntrl:]]' then raise exception 'invalid_tax_office' using errcode='22023'; end if;
  if tax_number is null or char_length(tax_number) not between 10 and 11 then raise exception 'invalid_tax_number' using errcode='22023'; end if;
  if mersis_number is null or char_length(mersis_number)<>16 then raise exception 'invalid_mersis_number' using errcode='22023'; end if;
  if trade_registry is null or char_length(trade_registry)>120 or trade_registry ~ '[[:cntrl:]]' then raise exception 'invalid_trade_registry_number' using errcode='22023'; end if;
  if country_code is null or country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_registered_country_code' using errcode='22023'; end if;
  if char_length(email_value) not between 5 and 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then raise exception 'invalid_support_email' using errcode='22023'; end if;
  if char_length(phone_value) not between 7 and 40 or phone_value !~ '^[+()0-9 .-]+$' then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  phone_digits:=regexp_replace(phone_value,'[^0-9]','','g');
  if char_length(phone_digits) not between 10 and 15 then raise exception 'invalid_support_phone' using errcode='22023'; end if;

  update private.super_admin_company_configuration_v1 set
    registered_legal_name=registered_name,
    registered_address=registered_address,
    tax_office=tax_office,
    tax_number=tax_number,
    mersis_number=mersis_number,
    trade_registry_number=trade_registry,
    country_code=country_code,
    support_email=email_value,
    support_phone=phone_value,
    updated_at=timezone('utc',now()),
    updated_by=caller_id
  where singleton=true;

  update public.brand_settings set
    support_email=email_value,
    support_phone=phone_value,
    public_config=jsonb_set(jsonb_set(coalesce(public_config,'{}'::jsonb),'{contactInfo,email}',to_jsonb(email_value),true),'{contactInfo,phone}',to_jsonb(phone_value),true),
    updated_at=timezone('utc',now())
  where slug='golden-oremar';

  if coalesce(p_legal_documents_finalized,false) then
    select coalesce(public_config,'{}'::jsonb),coalesce(public_config->'businessIdentity','{}'::jsonb)
      into next_config,current_identity from public.brand_settings where slug='golden-oremar' for update;
    current_identity:=current_identity||jsonb_build_object(
      'registeredLegalName',registered_name,
      'registeredAddress',registered_address,
      'taxOffice',tax_office,
      'taxNumber',tax_number,
      'mersisNumber',mersis_number,
      'tradeRegistryNumber',trade_registry,
      'countryCode',country_code,
      'verificationStatus','verified',
      'legalDocumentsFinalized',true,
      'updatedBy',caller_id,
      'updatedAt',timezone('utc',now())
    );
    next_config:=jsonb_set(next_config,'{businessIdentity}',current_identity,true);
    update public.brand_settings set public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
  end if;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'brand.business_configuration_updated','brand_settings','golden-oremar',jsonb_build_object('publishedVerifiedIdentity',coalesce(p_legal_documents_finalized,false)));
  return private.super_admin_get_business_identity_v2();
end;
$$;

create or replace function private.super_admin_get_release_setup_v2()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  settings public.brand_settings%rowtype;
  cfg private.super_admin_company_configuration_v1%rowtype;
  release_config jsonb;
  payment_config jsonb;
  live_origin text;
  live_return text;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  select * into cfg from private.super_admin_company_configuration_v1 where singleton=true;
  if settings.slug is null or cfg.singleton is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  release_config:=coalesce(settings.public_config->'releaseSetup','{}'::jsonb);
  payment_config:=coalesce(settings.public_config->'payments','{}'::jsonb);
  live_origin:=nullif(btrim(coalesce(release_config#>>'{publicShareOrigin,url}','')),'');
  live_return:=nullif(btrim(coalesce(payment_config->>'return_url',release_config#>>'{payment,returnUrl}','')),'');
  return jsonb_build_object(
    'appId',coalesce(nullif(release_config->>'appId',''),'com.goldenoremar.app'),
    'androidApplicationId',coalesce(nullif(release_config->>'androidApplicationId',''),'com.goldenoremar.app'),
    'iosBundleId',coalesce(nullif(release_config->>'iosBundleId',''),'com.goldenoremar.app'),
    'publicOrigin',coalesce(live_origin,cfg.public_origin),
    'publicOriginConfigured',live_origin is not null,
    'iyzicoReturnUrl',coalesce(live_return,cfg.iyzico_return_url),
    'iyzicoReturnUrlConfigured',live_return is not null,
    'iyzicoReturnPath','/payment/iyzico/return',
    'transactionalEmailFrom',coalesce(nullif(btrim(coalesce(release_config#>>'{transactionalEmail,from}','')),''),cfg.transactional_email_from),
    'fcmProjectId',coalesce(nullif(btrim(coalesce(release_config#>>'{notifications,fcmProjectId}','')),''),cfg.fcm_project_id),
    'apnsBundleId',coalesce(nullif(btrim(coalesce(release_config#>>'{notifications,apnsBundleId}','')),''),cfg.apns_bundle_id),
    'googleOAuthClientId',coalesce(nullif(btrim(coalesce(release_config#>>'{socialOAuth,googleClientId}','')),''),cfg.google_oauth_client_id),
    'facebookAppId',coalesce(nullif(btrim(coalesce(release_config#>>'{socialOAuth,facebookAppId}','')),''),cfg.facebook_app_id),
    'productionActivated',live_origin is not null and live_return is not null,
    'secretsPolicy','server_only_never_store_in_public_config',
    'updatedAt',greatest(settings.updated_at,cfg.updated_at)
  );
end;
$$;

create or replace function public.super_admin_get_release_setup_v2()
returns jsonb
language sql
stable
set search_path to ''
as $$ select private.super_admin_get_release_setup_v2(); $$;

revoke all on function private.super_admin_get_release_setup_v2() from public, anon;
grant execute on function private.super_admin_get_release_setup_v2() to authenticated, service_role;
revoke all on function public.super_admin_get_release_setup_v2() from public, anon;
grant execute on function public.super_admin_get_release_setup_v2() to authenticated, service_role;

create or replace function private.super_admin_update_release_setup_v2(
  p_public_origin text,
  p_iyzico_return_url text,
  p_transactional_email_from text,
  p_fcm_project_id text,
  p_apns_bundle_id text,
  p_google_oauth_client_id text,
  p_facebook_app_id text,
  p_activate_for_production boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_id uuid:=auth.uid();
  origin_value text:=regexp_replace(btrim(coalesce(p_public_origin,'')),'/+$','','g');
  return_url_value text:=btrim(coalesce(p_iyzico_return_url,''));
  email_from_value text:=lower(btrim(coalesce(p_transactional_email_from,'')));
  fcm_project_value text:=btrim(coalesce(p_fcm_project_id,''));
  apns_bundle_value text:=btrim(coalesce(p_apns_bundle_id,''));
  google_client_value text:=btrim(coalesce(p_google_oauth_client_id,''));
  facebook_app_value text:=btrim(coalesce(p_facebook_app_id,''));
  next_config jsonb;
  release_config jsonb;
  payment_config jsonb;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if origin_value='' or char_length(origin_value)>2048 or origin_value !~ '^https://[^[:space:]/?#]+(?::[0-9]{1,5})?$' then raise exception 'invalid_public_origin' using errcode='22023'; end if;
  if return_url_value='' or char_length(return_url_value)>2048 or return_url_value !~ '^https://[^[:space:]]+$' then raise exception 'invalid_iyzico_return_url' using errcode='22023'; end if;
  if email_from_value='' or char_length(email_from_value)>254 or email_from_value !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then raise exception 'invalid_transactional_email_from' using errcode='22023'; end if;
  if fcm_project_value='' or char_length(fcm_project_value)>255 or fcm_project_value !~ '^[A-Za-z0-9._:-]+$' then raise exception 'invalid_fcm_project_id' using errcode='22023'; end if;
  if apns_bundle_value='' or char_length(apns_bundle_value)>255 or apns_bundle_value !~ '^[A-Za-z0-9.-]+$' then raise exception 'invalid_apns_bundle_id' using errcode='22023'; end if;
  if google_client_value='' or char_length(google_client_value)>512 or google_client_value !~ '^[A-Za-z0-9._:-]+\\.apps\\.googleusercontent\\.com$' then raise exception 'invalid_google_oauth_client_id' using errcode='22023'; end if;
  if facebook_app_value='' or char_length(facebook_app_value)>64 or facebook_app_value !~ '^[0-9]+$' then raise exception 'invalid_facebook_app_id' using errcode='22023'; end if;

  update private.super_admin_company_configuration_v1 set
    public_origin=origin_value,
    iyzico_return_url=return_url_value,
    transactional_email_from=email_from_value,
    fcm_project_id=fcm_project_value,
    apns_bundle_id=apns_bundle_value,
    google_oauth_client_id=google_client_value,
    facebook_app_id=facebook_app_value,
    updated_at=timezone('utc',now()),
    updated_by=caller_id
  where singleton=true;

  if coalesce(p_activate_for_production,false) then
    select coalesce(public_config,'{}'::jsonb) into next_config from public.brand_settings where slug='golden-oremar' for update;
    release_config:=coalesce(next_config->'releaseSetup','{}'::jsonb);
    payment_config:=coalesce(next_config->'payments','{}'::jsonb);
    release_config:=jsonb_set(release_config,'{publicShareOrigin}',jsonb_build_object('url',origin_value,'status','configured_pending_external_verification'),true);
    release_config:=jsonb_set(release_config,'{payment}',coalesce(release_config->'payment','{}'::jsonb)||jsonb_build_object('provider','iyzico','callbackPath','/payment/iyzico/return','returnUrl',return_url_value,'status','return_url_configured_provider_credentials_required'),true);
    release_config:=jsonb_set(release_config,'{transactionalEmail}',coalesce(release_config->'transactionalEmail','{}'::jsonb)||jsonb_build_object('from',email_from_value,'status','sender_configured_api_key_and_domain_verification_required'),true);
    release_config:=jsonb_set(release_config,'{notifications}',coalesce(release_config->'notifications','{}'::jsonb)||jsonb_build_object('fcmProjectId',fcm_project_value,'apnsBundleId',apns_bundle_value,'fcm','project_id_configured_credentials_required','apns','bundle_id_configured_credentials_required'),true);
    release_config:=jsonb_set(release_config,'{socialOAuth}',coalesce(release_config->'socialOAuth','{}'::jsonb)||jsonb_build_object('googleClientId',google_client_value,'facebookAppId',facebook_app_value,'status','public_ids_configured_provider_secrets_required'),true);
    payment_config:=jsonb_set(payment_config,'{return_url}',to_jsonb(return_url_value),true);
    next_config:=jsonb_set(jsonb_set(next_config,'{releaseSetup}',release_config,true),'{payments}',payment_config,true);
    update public.brand_settings set public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
  end if;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'brand.release_configuration_updated','brand_settings','golden-oremar',jsonb_build_object('productionActivated',coalesce(p_activate_for_production,false)));
  return private.super_admin_get_release_setup_v2();
end;
$$;

create or replace function public.super_admin_update_release_setup_v2(
  p_public_origin text,
  p_iyzico_return_url text,
  p_transactional_email_from text,
  p_fcm_project_id text,
  p_apns_bundle_id text,
  p_google_oauth_client_id text,
  p_facebook_app_id text,
  p_activate_for_production boolean default false
)
returns jsonb
language sql
set search_path to ''
as $$ select private.super_admin_update_release_setup_v2(p_public_origin,p_iyzico_return_url,p_transactional_email_from,p_fcm_project_id,p_apns_bundle_id,p_google_oauth_client_id,p_facebook_app_id,p_activate_for_production); $$;

revoke all on function private.super_admin_update_release_setup_v2(text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function private.super_admin_update_release_setup_v2(text,text,text,text,text,text,text,boolean) to authenticated, service_role;
revoke all on function public.super_admin_update_release_setup_v2(text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.super_admin_update_release_setup_v2(text,text,text,text,text,text,text,boolean) to authenticated, service_role;
