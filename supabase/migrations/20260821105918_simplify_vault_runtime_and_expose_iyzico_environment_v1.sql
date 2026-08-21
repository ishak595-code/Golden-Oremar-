create or replace function private.service_get_integration_runtime_v1()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  cfg private.super_admin_company_configuration_v1%rowtype;
  result jsonb;
  value text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  select * into cfg from private.super_admin_company_configuration_v1 where singleton=true;
  if cfg.singleton is null then raise exception 'integration_configuration_missing' using errcode='P0002'; end if;
  result:=jsonb_build_object(
    'iyzicoBaseUrl',case when cfg.iyzico_environment='production' then 'https://api.iyzipay.com' else 'https://sandbox-api.iyzipay.com' end,
    'transactionalEmailFrom',cfg.transactional_email_from,
    'fcmProjectId',cfg.fcm_project_id,
    'apnsBundleId',cfg.apns_bundle_id
  );
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_iyzico_api_key' limit 1;
  result:=result||jsonb_build_object('iyzicoApiKey',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_iyzico_secret_key' limit 1;
  result:=result||jsonb_build_object('iyzicoSecretKey',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_resend_api_key' limit 1;
  result:=result||jsonb_build_object('resendApiKey',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_fcm_service_account_email' limit 1;
  result:=result||jsonb_build_object('fcmServiceAccountEmail',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_fcm_private_key' limit 1;
  result:=result||jsonb_build_object('fcmPrivateKey',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_apns_team_id' limit 1;
  result:=result||jsonb_build_object('apnsTeamId',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_apns_key_id' limit 1;
  result:=result||jsonb_build_object('apnsKeyId',case when value like 'replace-before-release:%' then null else value end);
  select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_apns_private_key' limit 1;
  result:=result||jsonb_build_object('apnsPrivateKey',case when value like 'replace-before-release:%' then null else value end);
  return result;
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
    'iyzicoEnvironment',cfg.iyzico_environment,
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

create or replace function private.super_admin_set_iyzico_environment_v1(p_environment text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare caller_id uuid:=auth.uid(); env_value text:=lower(btrim(coalesce(p_environment,'')));
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if env_value not in ('sandbox','production') then raise exception 'invalid_iyzico_environment' using errcode='22023'; end if;
  update private.super_admin_company_configuration_v1 set iyzico_environment=env_value,updated_at=timezone('utc',now()),updated_by=caller_id where singleton=true;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'integration.iyzico_environment_updated','brand_settings','golden-oremar',jsonb_build_object('environment',env_value));
  return private.super_admin_get_release_setup_v2();
end;
$$;
create or replace function public.super_admin_set_iyzico_environment_v1(p_environment text)
returns jsonb language sql set search_path to '' as $$ select private.super_admin_set_iyzico_environment_v1(p_environment); $$;
revoke all on function public.super_admin_set_iyzico_environment_v1(text) from public,anon;
grant execute on function public.super_admin_set_iyzico_environment_v1(text) to authenticated,service_role;
revoke all on function private.super_admin_set_iyzico_environment_v1(text) from public,anon;
grant execute on function private.super_admin_set_iyzico_environment_v1(text) to authenticated,service_role;
