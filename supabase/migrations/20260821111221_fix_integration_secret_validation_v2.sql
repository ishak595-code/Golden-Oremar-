create or replace function private.super_admin_set_integration_secret_v1(p_name text,p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_id uuid:=auth.uid();
  secret_name text:=btrim(coalesce(p_name,''));
  secret_value text:=coalesce(p_secret,'');
  existing_id uuid;
  configured boolean;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if not private.integration_secret_allowed_v1(secret_name) then raise exception 'integration_secret_name_invalid' using errcode='22023'; end if;
  if char_length(secret_value)<6 or char_length(secret_value)>20000 then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
  if secret_name='golden_oremar_fcm_service_account_email'
     and secret_value not like 'replace-before-release:%'
     and secret_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
  if secret_name in ('golden_oremar_fcm_private_key','golden_oremar_apns_private_key')
     and secret_value not like 'replace-before-release:%'
     and position('BEGIN PRIVATE KEY' in secret_value)=0
  then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
  if secret_name in ('golden_oremar_apns_team_id','golden_oremar_apns_key_id')
     and secret_value not like 'replace-before-release:%'
     and secret_value !~ '^[A-Z0-9]{10}$'
  then raise exception 'integration_secret_value_invalid' using errcode='22023'; end if;
  select id into existing_id from vault.secrets where name=secret_name limit 1;
  if existing_id is null then
    perform vault.create_secret(secret_value,secret_name,'Golden Oremar integration secret',null);
  else
    perform vault.update_secret(existing_id,secret_value,secret_name,'Golden Oremar integration secret',null);
  end if;
  configured:=secret_value not like 'replace-before-release:%';
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'integration.secret_updated','vault_secret',secret_name,jsonb_build_object('configured',configured));
  return jsonb_build_object('ok',true,'name',secret_name,'configured',configured);
end;
$$;

create or replace function public.super_admin_set_integration_secret_v1(p_name text,p_secret text)
returns jsonb
language sql
set search_path to ''
as $$ select private.super_admin_set_integration_secret_v1(p_name,p_secret); $$;

revoke all on function public.super_admin_set_integration_secret_v1(text,text) from public,anon;
grant execute on function public.super_admin_set_integration_secret_v1(text,text) to authenticated,service_role;
revoke all on function private.super_admin_set_integration_secret_v1(text,text) from public,anon;
grant execute on function private.super_admin_set_integration_secret_v1(text,text) to authenticated,service_role;
