alter table private.super_admin_company_configuration_v1
  add column if not exists iyzico_environment text not null default 'sandbox';
alter table private.super_admin_company_configuration_v1
  drop constraint if exists super_admin_company_configuration_v1_iyzico_environment_check;
alter table private.super_admin_company_configuration_v1
  add constraint super_admin_company_configuration_v1_iyzico_environment_check check (iyzico_environment in ('sandbox','production'));

create or replace function private.integration_secret_allowed_v1(p_name text)
returns boolean language sql immutable set search_path to '' as $$
  select p_name = any(array['golden_oremar_iyzico_api_key','golden_oremar_iyzico_secret_key','golden_oremar_resend_api_key','golden_oremar_fcm_service_account_email','golden_oremar_fcm_private_key','golden_oremar_apns_team_id','golden_oremar_apns_key_id','golden_oremar_apns_private_key']::text[]);
$$;
revoke all on function private.integration_secret_allowed_v1(text) from public,anon,authenticated;
grant execute on function private.integration_secret_allowed_v1(text) to service_role;

do $$
declare item record; existing_id uuid;
begin
 for item in select * from (values
  ('golden_oremar_iyzico_api_key','replace-before-release:iyzico-api-key','Golden Oremar iyzico API key'),
  ('golden_oremar_iyzico_secret_key','replace-before-release:iyzico-secret-key','Golden Oremar iyzico secret key'),
  ('golden_oremar_resend_api_key','replace-before-release:resend-api-key','Golden Oremar Resend API key'),
  ('golden_oremar_fcm_service_account_email','replace-before-release:fcm-service-account-email','Golden Oremar FCM service account email'),
  ('golden_oremar_fcm_private_key','replace-before-release:fcm-private-key','Golden Oremar FCM private key'),
  ('golden_oremar_apns_team_id','replace-before-release:apns-team-id','Golden Oremar APNs Team ID'),
  ('golden_oremar_apns_key_id','replace-before-release:apns-key-id','Golden Oremar APNs Key ID'),
  ('golden_oremar_apns_private_key','replace-before-release:apns-private-key','Golden Oremar APNs private key')
 ) as x(name,value,description)
 loop
  select id into existing_id from vault.secrets where name=item.name limit 1;
  if existing_id is null then perform vault.create_secret(item.value,item.name,item.description,null); end if;
 end loop;
end;
$$;

create or replace function private.integration_secret_configured_v1(p_name text)
returns boolean language plpgsql stable security definer set search_path to '' as $$
declare value text;
begin
 if not private.integration_secret_allowed_v1(p_name) then return false; end if;
 select nullif(btrim(decrypted_secret),'') into value from vault.decrypted_secrets where name=p_name limit 1;
 return value is not null and value not like 'replace-before-release:%';
end;
$$;
revoke all on function private.integration_secret_configured_v1(text) from public,anon,authenticated;
grant execute on function private.integration_secret_configured_v1(text) to service_role;

create or replace function private.super_admin_get_integration_secret_status_v1()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
 if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 return jsonb_build_object(
  'iyzicoApiKeyConfigured',private.integration_secret_configured_v1('golden_oremar_iyzico_api_key'),
  'iyzicoSecretKeyConfigured',private.integration_secret_configured_v1('golden_oremar_iyzico_secret_key'),
  'resendApiKeyConfigured',private.integration_secret_configured_v1('golden_oremar_resend_api_key'),
  'fcmServiceAccountEmailConfigured',private.integration_secret_configured_v1('golden_oremar_fcm_service_account_email'),
  'fcmPrivateKeyConfigured',private.integration_secret_configured_v1('golden_oremar_fcm_private_key'),
  'apnsTeamIdConfigured',private.integration_secret_configured_v1('golden_oremar_apns_team_id'),
  'apnsKeyIdConfigured',private.integration_secret_configured_v1('golden_oremar_apns_key_id'),
  'apnsPrivateKeyConfigured',private.integration_secret_configured_v1('golden_oremar_apns_private_key'));
end;
$$;
create or replace function public.super_admin_get_integration_secret_status_v1() returns jsonb language sql stable set search_path to '' as $$ select private.super_admin_get_integration_secret_status_v1(); $$;
revoke all on function public.super_admin_get_integration_secret_status_v1() from public,anon;
grant execute on function public.super_admin_get_integration_secret_status_v1() to authenticated,service_role;
revoke all on function private.super_admin_get_integration_secret_status_v1() from public,anon;
grant execute on function private.super_admin_get_integration_secret_status_v1() to authenticated,service_role;

create or replace function private.super_admin_set_integration_secret_v1(p_name text,p_secret text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); secret_name text:=btrim(coalesce(p_name,'')); secret_value text:=coalesce(p_secret,''); existing_id uuid; configured boolean;
begin
 if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if not private.integration_secret_allowed_v1(secret_name) then raise exception 'integration_secret_name_invalid' using errcode='22023'; end if;
 if char_length(secret_value)<6 or char_length(secret_value)>20000 or secret_value ~ '[\\u0000]' then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
 if secret_name='golden_oremar_fcm_service_account_email' and secret_value not like 'replace-before-release:%' and secret_value !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
 if secret_name in ('golden_oremar_fcm_private_key','golden_oremar_apns_private_key') and secret_value not like 'replace-before-release:%' and position('BEGIN PRIVATE KEY' in secret_value)=0 then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
 if secret_name in ('golden_oremar_apns_team_id','golden_oremar_apns_key_id') and secret_value not like 'replace-before-release:%' and secret_value !~ '^[A-Z0-9]{10}$' then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
 select id into existing_id from vault.secrets where name=secret_name limit 1;
 if existing_id is null then perform vault.create_secret(secret_value,secret_name,'Golden Oremar integration secret',null); else perform vault.update_secret(existing_id,secret_value,secret_name,'Golden Oremar integration secret',null); end if;
 configured:=secret_value not like 'replace-before-release:%';
 insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'integration.secret_updated','vault_secret',secret_name,jsonb_build_object('configured',configured));
 return jsonb_build_object('ok',true,'name',secret_name,'configured',configured);
end;
$$;
create or replace function public.super_admin_set_integration_secret_v1(p_name text,p_secret text) returns jsonb language sql set search_path to '' as $$ select private.super_admin_set_integration_secret_v1(p_name,p_secret); $$;
revoke all on function public.super_admin_set_integration_secret_v1(text,text) from public,anon;
grant execute on function public.super_admin_set_integration_secret_v1(text,text) to authenticated,service_role;
revoke all on function private.super_admin_set_integration_secret_v1(text,text) from public,anon;
grant execute on function private.super_admin_set_integration_secret_v1(text,text) to authenticated,service_role;

create or replace function private.service_get_integration_runtime_v1()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare cfg private.super_admin_company_configuration_v1%rowtype; result jsonb; value text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 select * into cfg from private.super_admin_company_configuration_v1 where singleton=true;
 if cfg.singleton is null then raise exception 'integration_configuration_missing' using errcode='P0002'; end if;
 result:=jsonb_build_object('iyzicoBaseUrl',case when cfg.iyzico_environment='production' then 'https://api.iyzipay.com' else 'https://sandbox-api.iyzipay.com' end,'transactionalEmailFrom',cfg.transactional_email_from,'fcmProjectId',cfg.fcm_project_id,'apnsBundleId',cfg.apns_bundle_id);
 for value in select name from vault.decrypted_secrets where name like 'golden_oremar_%' loop null; end loop;
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_iyzico_api_key' limit 1; result:=result||jsonb_build_object('iyzicoApiKey',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_iyzico_secret_key' limit 1; result:=result||jsonb_build_object('iyzicoSecretKey',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_resend_api_key' limit 1; result:=result||jsonb_build_object('resendApiKey',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_fcm_service_account_email' limit 1; result:=result||jsonb_build_object('fcmServiceAccountEmail',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_fcm_private_key' limit 1; result:=result||jsonb_build_object('fcmPrivateKey',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_apns_team_id' limit 1; result:=result||jsonb_build_object('apnsTeamId',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_apns_key_id' limit 1; result:=result||jsonb_build_object('apnsKeyId',case when value like 'replace-before-release:%' then null else value end);
 select decrypted_secret into value from vault.decrypted_secrets where name='golden_oremar_apns_private_key' limit 1; result:=result||jsonb_build_object('apnsPrivateKey',case when value like 'replace-before-release:%' then null else value end);
 return result;
end;
$$;
create or replace function public.service_get_integration_runtime_v1() returns jsonb language sql stable set search_path to '' as $$ select private.service_get_integration_runtime_v1(); $$;
revoke all on function public.service_get_integration_runtime_v1() from public,anon,authenticated;
grant execute on function public.service_get_integration_runtime_v1() to service_role;
revoke all on function private.service_get_integration_runtime_v1() from public,anon,authenticated;
grant execute on function private.service_get_integration_runtime_v1() to service_role;
