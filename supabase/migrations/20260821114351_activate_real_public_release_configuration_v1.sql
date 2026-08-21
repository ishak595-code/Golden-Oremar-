do $$
declare
  cfg private.super_admin_company_configuration_v1%rowtype;
  current_config jsonb;
  release_config jsonb;
  payment_config jsonb;
begin
  select * into cfg
  from private.super_admin_company_configuration_v1
  where singleton=true;
  if cfg.singleton is null then raise exception 'release_configuration_missing'; end if;

  select coalesce(public_config,'{}'::jsonb)
    into current_config
  from public.brand_settings
  where slug='golden-oremar'
  for update;

  release_config := coalesce(current_config->'releaseSetup','{}'::jsonb);
  payment_config := coalesce(current_config->'payments','{}'::jsonb);

  release_config := jsonb_set(release_config,'{publicShareOrigin}',jsonb_build_object('url',cfg.public_origin,'status','configured'),true);
  release_config := jsonb_set(release_config,'{payment}',coalesce(release_config->'payment','{}'::jsonb) || jsonb_build_object('provider','iyzico','callbackPath','/payment/iyzico/return','returnUrl',cfg.iyzico_return_url,'status','return_url_configured_provider_credentials_required'),true);
  release_config := jsonb_set(release_config,'{transactionalEmail}',coalesce(release_config->'transactionalEmail','{}'::jsonb) || jsonb_build_object('from',cfg.transactional_email_from,'status','sender_configured_api_key_required'),true);
  release_config := jsonb_set(release_config,'{notifications}',coalesce(release_config->'notifications','{}'::jsonb) || jsonb_build_object('fcmProjectId',cfg.fcm_project_id,'apnsBundleId',cfg.apns_bundle_id,'fcm','credentials_required','apns','credentials_required'),true);
  release_config := jsonb_set(release_config,'{socialOAuth}',coalesce(release_config->'socialOAuth','{}'::jsonb) || jsonb_build_object('googleClientId',cfg.google_oauth_client_id,'facebookAppId',cfg.facebook_app_id,'status','public_ids_configured_provider_secrets_required'),true);

  payment_config := payment_config || jsonb_build_object(
    'mode','provider',
    'provider','iyzico',
    'return_url',cfg.iyzico_return_url,
    'requires_provider_configuration',true,
    'checkout_form_enabled',false,
    'card_enrollment_enabled',false,
    'live_card_payments_enabled',false
  );

  current_config := jsonb_set(current_config,'{releaseSetup}',release_config,true);
  current_config := jsonb_set(current_config,'{payments}',payment_config,true);

  update public.brand_settings
  set public_config=current_config,
      updated_at=timezone('utc',now())
  where slug='golden-oremar';
end;
$$;
