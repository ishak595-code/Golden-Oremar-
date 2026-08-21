alter table private.super_admin_company_configuration_v1
  add column if not exists production_enabled boolean not null default true;

create or replace function private.super_admin_get_release_setup_v2()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare settings public.brand_settings%rowtype; cfg private.super_admin_company_configuration_v1%rowtype; release_config jsonb; payment_config jsonb; live_origin text; live_return text;
begin
 if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 select * into settings from public.brand_settings where slug='golden-oremar'; select * into cfg from private.super_admin_company_configuration_v1 where singleton=true;
 if settings.slug is null or cfg.singleton is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
 release_config:=coalesce(settings.public_config->'releaseSetup','{}'::jsonb); payment_config:=coalesce(settings.public_config->'payments','{}'::jsonb);
 live_origin:=nullif(btrim(coalesce(release_config#>>'{publicShareOrigin,url}','')),''); live_return:=nullif(btrim(coalesce(payment_config->>'return_url',release_config#>>'{payment,returnUrl}','')),'');
 return jsonb_build_object('appId',coalesce(nullif(release_config->>'appId',''),'com.goldenoremar.app'),'androidApplicationId',coalesce(nullif(release_config->>'androidApplicationId',''),'com.goldenoremar.app'),'iosBundleId',coalesce(nullif(release_config->>'iosBundleId',''),'com.goldenoremar.app'),'publicOrigin',coalesce(live_origin,cfg.public_origin),'publicOriginConfigured',live_origin is not null,'iyzicoReturnUrl',coalesce(live_return,cfg.iyzico_return_url),'iyzicoReturnUrlConfigured',live_return is not null,'iyzicoReturnPath','/payment/iyzico/return','iyzicoEnvironment',cfg.iyzico_environment,'transactionalEmailFrom',coalesce(nullif(btrim(coalesce(release_config#>>'{transactionalEmail,from}','')),''),cfg.transactional_email_from),'fcmProjectId',coalesce(nullif(btrim(coalesce(release_config#>>'{notifications,fcmProjectId}','')),''),cfg.fcm_project_id),'apnsBundleId',coalesce(nullif(btrim(coalesce(release_config#>>'{notifications,apnsBundleId}','')),''),cfg.apns_bundle_id),'googleOAuthClientId',coalesce(nullif(btrim(coalesce(release_config#>>'{socialOAuth,googleClientId}','')),''),cfg.google_oauth_client_id),'facebookAppId',coalesce(nullif(btrim(coalesce(release_config#>>'{socialOAuth,facebookAppId}','')),''),cfg.facebook_app_id),'productionActivated',cfg.production_enabled,'secretsPolicy','server_only_never_store_in_public_config','updatedAt',greatest(settings.updated_at,cfg.updated_at));
end;$$;

create or replace function private.super_admin_update_release_setup_v2(p_public_origin text,p_iyzico_return_url text,p_transactional_email_from text,p_fcm_project_id text,p_apns_bundle_id text,p_google_oauth_client_id text,p_facebook_app_id text,p_activate_for_production boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); origin_value text:=regexp_replace(btrim(coalesce(p_public_origin,'')),'/+$','','g'); return_url_value text:=btrim(coalesce(p_iyzico_return_url,'')); email_from_value text:=lower(btrim(coalesce(p_transactional_email_from,''))); fcm_project_value text:=btrim(coalesce(p_fcm_project_id,'')); apns_bundle_value text:=btrim(coalesce(p_apns_bundle_id,'')); google_client_value text:=btrim(coalesce(p_google_oauth_client_id,'')); facebook_app_value text:=btrim(coalesce(p_facebook_app_id,'')); next_config jsonb; release_config jsonb; payment_config jsonb;
begin
 if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if origin_value='' or char_length(origin_value)>2048 or origin_value !~ '^https://[^[:space:]/?#]+(?::[0-9]{1,5})?$' then raise exception 'invalid_public_origin' using errcode='22023'; end if;
 if return_url_value='' or char_length(return_url_value)>2048 or return_url_value !~ '^https://[^[:space:]]+$' then raise exception 'invalid_iyzico_return_url' using errcode='22023'; end if;
 if email_from_value='' or char_length(email_from_value)>254 or email_from_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_transactional_email_from' using errcode='22023'; end if;
 if fcm_project_value='' or char_length(fcm_project_value)>255 or fcm_project_value !~ '^[A-Za-z0-9._:-]+$' then raise exception 'invalid_fcm_project_id' using errcode='22023'; end if;
 if apns_bundle_value='' or char_length(apns_bundle_value)>255 or apns_bundle_value !~ '^[A-Za-z0-9.-]+$' then raise exception 'invalid_apns_bundle_id' using errcode='22023'; end if;
 if google_client_value='' or char_length(google_client_value)>512 or google_client_value !~ '^[A-Za-z0-9._:-]+\.apps\.googleusercontent\.com$' then raise exception 'invalid_google_oauth_client_id' using errcode='22023'; end if;
 if facebook_app_value='' or char_length(facebook_app_value)>64 or facebook_app_value !~ '^[0-9]+$' then raise exception 'invalid_facebook_app_id' using errcode='22023'; end if;
 update private.super_admin_company_configuration_v1 set public_origin=origin_value,iyzico_return_url=return_url_value,transactional_email_from=email_from_value,fcm_project_id=fcm_project_value,apns_bundle_id=apns_bundle_value,google_oauth_client_id=google_client_value,facebook_app_id=facebook_app_value,production_enabled=coalesce(p_activate_for_production,false),updated_at=timezone('utc',now()),updated_by=caller_id where singleton=true;
 update private.super_admin_release_origins_v1 set is_primary=false,updated_at=timezone('utc',now()),updated_by=caller_id where is_primary=true and origin<>origin_value;
 insert into private.super_admin_release_origins_v1(origin,is_primary,is_active,created_by,updated_by) values(origin_value,true,true,caller_id,caller_id) on conflict(origin) do update set is_primary=true,is_active=true,updated_at=timezone('utc',now()),updated_by=caller_id;
 select coalesce(public_config,'{}'::jsonb) into next_config from public.brand_settings where slug='golden-oremar' for update;
 release_config:=coalesce(next_config->'releaseSetup','{}'::jsonb); payment_config:=coalesce(next_config->'payments','{}'::jsonb);
 release_config:=jsonb_set(release_config,'{publicShareOrigin}',jsonb_build_object('url',origin_value,'status','configured'),true);
 release_config:=jsonb_set(release_config,'{payment}',coalesce(release_config->'payment','{}'::jsonb)||jsonb_build_object('provider','iyzico','callbackPath','/payment/iyzico/return','returnUrl',return_url_value,'status','return_url_configured_provider_credentials_required'),true);
 release_config:=jsonb_set(release_config,'{transactionalEmail}',coalesce(release_config->'transactionalEmail','{}'::jsonb)||jsonb_build_object('from',email_from_value,'status','sender_configured_api_key_required'),true);
 release_config:=jsonb_set(release_config,'{notifications}',coalesce(release_config->'notifications','{}'::jsonb)||jsonb_build_object('fcmProjectId',fcm_project_value,'apnsBundleId',apns_bundle_value,'fcm','credentials_required','apns','credentials_required'),true);
 release_config:=jsonb_set(release_config,'{socialOAuth}',coalesce(release_config->'socialOAuth','{}'::jsonb)||jsonb_build_object('googleClientId',google_client_value,'facebookAppId',facebook_app_value,'status','public_ids_configured_provider_secrets_required'),true);
 release_config:=jsonb_set(release_config,'{productionEnabled}',to_jsonb(coalesce(p_activate_for_production,false)),true);
 payment_config:=payment_config||jsonb_build_object('return_url',return_url_value,'provider','iyzico','mode','provider');
 next_config:=jsonb_set(jsonb_set(next_config,'{releaseSetup}',release_config,true),'{payments}',payment_config,true);
 update public.brand_settings set public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
 insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.release_configuration_updated','brand_settings','golden-oremar',jsonb_build_object('productionActivated',coalesce(p_activate_for_production,false),'publicOrigin',origin_value));
 return private.super_admin_get_release_setup_v2();
end;$$;
