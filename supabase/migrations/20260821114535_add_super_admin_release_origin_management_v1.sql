create table if not exists private.super_admin_release_origins_v1 (
  id uuid primary key default gen_random_uuid(),
  origin text not null unique,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  created_by uuid null,
  updated_by uuid null,
  constraint super_admin_release_origins_v1_origin_check check (origin ~ '^https://[^[:space:]/?#]+(?::[0-9]{1,5})?$')
);
revoke all on table private.super_admin_release_origins_v1 from public,anon,authenticated;
grant select,insert,update,delete on table private.super_admin_release_origins_v1 to service_role;
create unique index if not exists super_admin_release_origins_one_primary_v1 on private.super_admin_release_origins_v1((is_primary)) where is_primary=true;
insert into private.super_admin_release_origins_v1(origin,is_primary,is_active)
select public_origin,true,true from private.super_admin_company_configuration_v1 where singleton=true
on conflict(origin) do update set is_primary=true,is_active=true,updated_at=timezone('utc',now());

create or replace function private.super_admin_list_release_origins_v1() returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
 if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'origin',origin,'isPrimary',is_primary,'isActive',is_active,'createdAt',created_at,'updatedAt',updated_at) order by is_primary desc,origin) from private.super_admin_release_origins_v1),'[]'::jsonb));
end;$$;
create or replace function public.super_admin_list_release_origins_v1() returns jsonb language sql stable set search_path to '' as $$select private.super_admin_list_release_origins_v1();$$;
revoke all on function public.super_admin_list_release_origins_v1() from public,anon; grant execute on function public.super_admin_list_release_origins_v1() to authenticated,service_role;
revoke all on function private.super_admin_list_release_origins_v1() from public,anon; grant execute on function private.super_admin_list_release_origins_v1() to authenticated,service_role;

create or replace function private.super_admin_upsert_release_origin_v1(p_origin text,p_make_primary boolean default false,p_is_active boolean default true) returns jsonb language plpgsql security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); origin_value text:=regexp_replace(btrim(coalesce(p_origin,'')),'/+$','','g'); next_config jsonb; release_config jsonb;
begin
 if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if origin_value='' or char_length(origin_value)>2048 or origin_value !~ '^https://[^[:space:]/?#]+(?::[0-9]{1,5})?$' then raise exception 'invalid_public_origin' using errcode='22023'; end if;
 if coalesce(p_make_primary,false) then update private.super_admin_release_origins_v1 set is_primary=false,updated_at=timezone('utc',now()),updated_by=caller_id where is_primary=true; end if;
 insert into private.super_admin_release_origins_v1(origin,is_primary,is_active,created_by,updated_by) values(origin_value,coalesce(p_make_primary,false),coalesce(p_is_active,true),caller_id,caller_id)
 on conflict(origin) do update set is_primary=case when coalesce(p_make_primary,false) then true else private.super_admin_release_origins_v1.is_primary end,is_active=excluded.is_active,updated_at=timezone('utc',now()),updated_by=caller_id;
 if coalesce(p_make_primary,false) then
  update private.super_admin_company_configuration_v1 set public_origin=origin_value,updated_at=timezone('utc',now()),updated_by=caller_id where singleton=true;
  select coalesce(public_config,'{}'::jsonb) into next_config from public.brand_settings where slug='golden-oremar' for update;
  release_config:=coalesce(next_config->'releaseSetup','{}'::jsonb);
  release_config:=jsonb_set(release_config,'{publicShareOrigin}',jsonb_build_object('url',origin_value,'status','configured'),true);
  next_config:=jsonb_set(next_config,'{releaseSetup}',release_config,true);
  update public.brand_settings set public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
 end if;
 insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.release_origin_upserted','release_origin',origin_value,jsonb_build_object('makePrimary',coalesce(p_make_primary,false),'active',coalesce(p_is_active,true)));
 return private.super_admin_list_release_origins_v1();
end;$$;
create or replace function public.super_admin_upsert_release_origin_v1(p_origin text,p_make_primary boolean default false,p_is_active boolean default true) returns jsonb language sql set search_path to '' as $$select private.super_admin_upsert_release_origin_v1(p_origin,p_make_primary,p_is_active);$$;
revoke all on function public.super_admin_upsert_release_origin_v1(text,boolean,boolean) from public,anon; grant execute on function public.super_admin_upsert_release_origin_v1(text,boolean,boolean) to authenticated,service_role;
revoke all on function private.super_admin_upsert_release_origin_v1(text,boolean,boolean) from public,anon; grant execute on function private.super_admin_upsert_release_origin_v1(text,boolean,boolean) to authenticated,service_role;

create or replace function private.super_admin_delete_release_origin_v1(p_id uuid) returns jsonb language plpgsql security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); target private.super_admin_release_origins_v1%rowtype; active_count integer;
begin
 if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 select * into target from private.super_admin_release_origins_v1 where id=p_id for update;
 if target.id is null then raise exception 'release_origin_not_found' using errcode='P0002'; end if;
 if target.is_primary then raise exception 'primary_release_origin_cannot_be_deleted' using errcode='22023'; end if;
 select count(*)::integer into active_count from private.super_admin_release_origins_v1 where is_active=true;
 if target.is_active and active_count<=1 then raise exception 'last_active_release_origin_cannot_be_deleted' using errcode='22023'; end if;
 delete from private.super_admin_release_origins_v1 where id=p_id;
 insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.release_origin_deleted','release_origin',target.origin,'{}'::jsonb);
 return private.super_admin_list_release_origins_v1();
end;$$;
create or replace function public.super_admin_delete_release_origin_v1(p_id uuid) returns jsonb language sql set search_path to '' as $$select private.super_admin_delete_release_origin_v1(p_id);$$;
revoke all on function public.super_admin_delete_release_origin_v1(uuid) from public,anon; grant execute on function public.super_admin_delete_release_origin_v1(uuid) to authenticated,service_role;
revoke all on function private.super_admin_delete_release_origin_v1(uuid) from public,anon; grant execute on function private.super_admin_delete_release_origin_v1(uuid) to authenticated,service_role;

create or replace function private.super_admin_update_release_setup_v2(
  p_public_origin text,p_iyzico_return_url text,p_transactional_email_from text,p_fcm_project_id text,p_apns_bundle_id text,p_google_oauth_client_id text,p_facebook_app_id text,p_activate_for_production boolean default false
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  caller_id uuid:=auth.uid(); origin_value text:=regexp_replace(btrim(coalesce(p_public_origin,'')),'/+$','','g'); return_url_value text:=btrim(coalesce(p_iyzico_return_url,'')); email_from_value text:=lower(btrim(coalesce(p_transactional_email_from,''))); fcm_project_value text:=btrim(coalesce(p_fcm_project_id,'')); apns_bundle_value text:=btrim(coalesce(p_apns_bundle_id,'')); google_client_value text:=btrim(coalesce(p_google_oauth_client_id,'')); facebook_app_value text:=btrim(coalesce(p_facebook_app_id,'')); next_config jsonb; release_config jsonb; payment_config jsonb;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if origin_value='' or char_length(origin_value)>2048 or origin_value !~ '^https://[^[:space:]/?#]+(?::[0-9]{1,5})?$' then raise exception 'invalid_public_origin' using errcode='22023'; end if;
  if return_url_value='' or char_length(return_url_value)>2048 or return_url_value !~ '^https://[^[:space:]]+$' then raise exception 'invalid_iyzico_return_url' using errcode='22023'; end if;
  if email_from_value='' or char_length(email_from_value)>254 or email_from_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_transactional_email_from' using errcode='22023'; end if;
  if fcm_project_value='' or char_length(fcm_project_value)>255 or fcm_project_value !~ '^[A-Za-z0-9._:-]+$' then raise exception 'invalid_fcm_project_id' using errcode='22023'; end if;
  if apns_bundle_value='' or char_length(apns_bundle_value)>255 or apns_bundle_value !~ '^[A-Za-z0-9.-]+$' then raise exception 'invalid_apns_bundle_id' using errcode='22023'; end if;
  if google_client_value='' or char_length(google_client_value)>512 or google_client_value !~ '^[A-Za-z0-9._:-]+\.apps\.googleusercontent\.com$' then raise exception 'invalid_google_oauth_client_id' using errcode='22023'; end if;
  if facebook_app_value='' or char_length(facebook_app_value)>64 or facebook_app_value !~ '^[0-9]+$' then raise exception 'invalid_facebook_app_id' using errcode='22023'; end if;
  update private.super_admin_company_configuration_v1 set public_origin=origin_value,iyzico_return_url=return_url_value,transactional_email_from=email_from_value,fcm_project_id=fcm_project_value,apns_bundle_id=apns_bundle_value,google_oauth_client_id=google_client_value,facebook_app_id=facebook_app_value,updated_at=timezone('utc',now()),updated_by=caller_id where singleton=true;
  update private.super_admin_release_origins_v1 set is_primary=false,updated_at=timezone('utc',now()),updated_by=caller_id where is_primary=true and origin<>origin_value;
  insert into private.super_admin_release_origins_v1(origin,is_primary,is_active,created_by,updated_by) values(origin_value,true,true,caller_id,caller_id) on conflict(origin) do update set is_primary=true,is_active=true,updated_at=timezone('utc',now()),updated_by=caller_id;
  if coalesce(p_activate_for_production,false) then
    select coalesce(public_config,'{}'::jsonb) into next_config from public.brand_settings where slug='golden-oremar' for update;
    release_config:=coalesce(next_config->'releaseSetup','{}'::jsonb); payment_config:=coalesce(next_config->'payments','{}'::jsonb);
    release_config:=jsonb_set(release_config,'{publicShareOrigin}',jsonb_build_object('url',origin_value,'status','configured'),true);
    release_config:=jsonb_set(release_config,'{payment}',coalesce(release_config->'payment','{}'::jsonb)||jsonb_build_object('provider','iyzico','callbackPath','/payment/iyzico/return','returnUrl',return_url_value,'status','return_url_configured_provider_credentials_required'),true);
    release_config:=jsonb_set(release_config,'{transactionalEmail}',coalesce(release_config->'transactionalEmail','{}'::jsonb)||jsonb_build_object('from',email_from_value,'status','sender_configured_api_key_required'),true);
    release_config:=jsonb_set(release_config,'{notifications}',coalesce(release_config->'notifications','{}'::jsonb)||jsonb_build_object('fcmProjectId',fcm_project_value,'apnsBundleId',apns_bundle_value,'fcm','credentials_required','apns','credentials_required'),true);
    release_config:=jsonb_set(release_config,'{socialOAuth}',coalesce(release_config->'socialOAuth','{}'::jsonb)||jsonb_build_object('googleClientId',google_client_value,'facebookAppId',facebook_app_value,'status','public_ids_configured_provider_secrets_required'),true);
    payment_config:=payment_config||jsonb_build_object('return_url',return_url_value,'provider','iyzico','mode','provider');
    next_config:=jsonb_set(jsonb_set(next_config,'{releaseSetup}',release_config,true),'{payments}',payment_config,true);
    update public.brand_settings set public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
  end if;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.release_configuration_updated','brand_settings','golden-oremar',jsonb_build_object('productionActivated',coalesce(p_activate_for_production,false),'publicOrigin',origin_value));
  return private.super_admin_get_release_setup_v2();
end;$$;
