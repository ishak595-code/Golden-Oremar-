create or replace function private.super_admin_update_release_setup_v1(
  p_public_origin text,
  p_iyzico_return_url text,
  p_transactional_email_from text,
  p_fcm_project_id text,
  p_apns_bundle_id text,
  p_google_oauth_client_id text,
  p_facebook_app_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  origin_value text:=nullif(regexp_replace(btrim(coalesce(p_public_origin,'')),'/+$','','g'),'');
  return_url_value text:=nullif(btrim(coalesce(p_iyzico_return_url,'')),'');
  email_from_value text:=nullif(lower(btrim(coalesce(p_transactional_email_from,''))),'');
  fcm_project_value text:=nullif(btrim(coalesce(p_fcm_project_id,'')),'');
  apns_bundle_value text:=nullif(btrim(coalesce(p_apns_bundle_id,'')),'');
  google_client_value text:=nullif(btrim(coalesce(p_google_oauth_client_id,'')),'');
  facebook_app_value text:=nullif(btrim(coalesce(p_facebook_app_id,'')),'');
  next_config jsonb;
  release_config jsonb;
  payment_config jsonb;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if origin_value is not null and (char_length(origin_value)>2048 or origin_value !~ '^https://[^[:space:]/?#]+(?::[0-9]{1,5})?$') then raise exception 'invalid_public_origin' using errcode='22023'; end if;
  if return_url_value is not null and (char_length(return_url_value)>2048 or return_url_value !~ '^https://[^[:space:]]+$') then raise exception 'invalid_iyzico_return_url' using errcode='22023'; end if;
  if email_from_value is not null and (char_length(email_from_value)>254 or email_from_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid_transactional_email_from' using errcode='22023'; end if;
  if fcm_project_value is not null and (char_length(fcm_project_value)>255 or fcm_project_value !~ '^[A-Za-z0-9._:-]+$') then raise exception 'invalid_fcm_project_id' using errcode='22023'; end if;
  if apns_bundle_value is not null and (char_length(apns_bundle_value)>255 or apns_bundle_value !~ '^[A-Za-z0-9.-]+$') then raise exception 'invalid_apns_bundle_id' using errcode='22023'; end if;
  if google_client_value is not null and (char_length(google_client_value)>512 or google_client_value !~ '^[A-Za-z0-9._:-]+\.apps\.googleusercontent\.com$') then raise exception 'invalid_google_oauth_client_id' using errcode='22023'; end if;
  if facebook_app_value is not null and (char_length(facebook_app_value)>64 or facebook_app_value !~ '^[0-9]+$') then raise exception 'invalid_facebook_app_id' using errcode='22023'; end if;
  select coalesce(public_config,'{}'::jsonb) into next_config from public.brand_settings where slug='golden-oremar' for update;
  if next_config is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  release_config:=coalesce(next_config->'releaseSetup','{}'::jsonb);
  payment_config:=coalesce(next_config->'payments','{}'::jsonb);
  release_config:=jsonb_set(release_config,'{publicShareOrigin}',jsonb_build_object('url',origin_value,'status',case when origin_value is null then 'real_https_origin_required' else 'configured_pending_external_verification' end),true);
  release_config:=jsonb_set(release_config,'{payment}',coalesce(release_config->'payment','{}'::jsonb)||jsonb_build_object('provider','iyzico','callbackPath','/payment/iyzico/return','returnUrl',return_url_value,'status',case when return_url_value is null then 'provider_credentials_required' else 'return_url_configured_provider_credentials_required' end),true);
  release_config:=jsonb_set(release_config,'{transactionalEmail}',coalesce(release_config->'transactionalEmail','{}'::jsonb)||jsonb_build_object('from',email_from_value,'status',case when email_from_value is null then 'verified_sender_and_api_key_required' else 'sender_configured_api_key_and_domain_verification_required' end),true);
  release_config:=jsonb_set(release_config,'{notifications}',coalesce(release_config->'notifications','{}'::jsonb)||jsonb_build_object('fcmProjectId',fcm_project_value,'apnsBundleId',apns_bundle_value,'fcm',case when fcm_project_value is null then 'credentials_required' else 'project_id_configured_credentials_required' end,'apns',case when apns_bundle_value is null then 'credentials_required' else 'bundle_id_configured_credentials_required' end),true);
  release_config:=jsonb_set(release_config,'{socialOAuth}',coalesce(release_config->'socialOAuth','{}'::jsonb)||jsonb_build_object('googleClientId',google_client_value,'facebookAppId',facebook_app_value,'status',case when google_client_value is null and facebook_app_value is null then 'provider_console_required' else 'public_ids_configured_provider_secrets_required' end),true);
  release_config:=jsonb_set(release_config,'{secretsPolicy}',to_jsonb('server_only_never_store_in_public_config'::text),true);
  payment_config:=jsonb_set(payment_config,'{return_url}',coalesce(to_jsonb(return_url_value),'null'::jsonb),true);
  next_config:=jsonb_set(next_config,'{releaseSetup}',release_config,true);
  next_config:=jsonb_set(next_config,'{payments}',payment_config,true);
  update public.brand_settings set public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.release_setup_updated','brand_settings','golden-oremar',jsonb_build_object('publicOriginConfigured',origin_value is not null,'iyzicoReturnUrlConfigured',return_url_value is not null,'transactionalEmailFromConfigured',email_from_value is not null,'fcmProjectIdConfigured',fcm_project_value is not null,'apnsBundleIdConfigured',apns_bundle_value is not null,'googleOAuthClientIdConfigured',google_client_value is not null,'facebookAppIdConfigured',facebook_app_value is not null));
  return private.super_admin_get_release_setup_v1();
end;
$$;
revoke all on function private.super_admin_update_release_setup_v1(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.super_admin_update_release_setup_v1(text,text,text,text,text,text,text) to postgres,service_role;
