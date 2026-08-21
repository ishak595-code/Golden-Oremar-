update public.brand_settings
set support_phone = '+90 537 959 48 51',
    public_config = jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(public_config,'{}'::jsonb),
          '{businessIdentity}',
          coalesce(public_config->'businessIdentity','{}'::jsonb)
          || jsonb_build_object(
            'registeredLegalName', coalesce(nullif(btrim(public_config#>>'{businessIdentity,registeredLegalName}'),''),'Golden Oremar'),
            'registeredAddress', coalesce(nullif(btrim(public_config#>>'{businessIdentity,registeredAddress}'),''),'Hakkari, Türkiye'),
            'countryCode', coalesce(nullif(upper(btrim(public_config#>>'{businessIdentity,countryCode}')),''),'TR'),
            'verificationStatus', coalesce(nullif(lower(btrim(public_config#>>'{businessIdentity,verificationStatus}')),''),'provisional'),
            'provisionalDefaults', jsonb_build_object(
              'registeredLegalName','Golden Oremar',
              'registeredAddress','Hakkari, Türkiye',
              'countryCode','TR',
              'source','owner_project_context',
              'editableInSuperAdmin',true,
              'requiresDocumentVerification',true
            )
          ),
          true
        ),
        '{contactInfo,phone}',
        to_jsonb('+90 537 959 48 51'::text),
        true
      ),
      '{contactInfo,whatsapp}',
      to_jsonb('https://wa.me/905379594851'::text),
      true
    ) || jsonb_build_object(
      'releaseSetup', jsonb_build_object(
        'appId','com.goldenoremar.app',
        'androidApplicationId','com.goldenoremar.app',
        'iosBundleId','com.goldenoremar.app',
        'payment',jsonb_build_object('provider','iyzico','callbackPath','/payment/iyzico/return','status','provider_credentials_required'),
        'publicShareOrigin',jsonb_build_object('status','real_https_origin_required'),
        'notifications',jsonb_build_object('fcm','credentials_required','apns','credentials_required'),
        'socialOAuth',jsonb_build_object('status','provider_console_required'),
        'storeSigning',jsonb_build_object('android','credentials_required','ios','credentials_required'),
        'transactionalEmail',jsonb_build_object('status','verified_sender_and_api_key_required'),
        'secretsPolicy','server_only_never_store_in_public_config'
      )
    ),
    updated_at = timezone('utc',now())
where slug='golden-oremar';

create or replace function private.commercial_checkout_legal_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  settings public.brand_settings%rowtype;
  identity jsonb;
  missing jsonb:='[]'::jsonb;
  registered_name text;
  registered_address text;
  country_code text;
  verification_status text;
  finalized boolean:=false;
  legal_count integer:=0;
begin
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then return jsonb_build_object('ready',false,'missing',jsonb_build_array('brand_settings')); end if;
  identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
  registered_name:=nullif(btrim(coalesce(identity->>'registeredLegalName','')),'');
  registered_address:=nullif(btrim(coalesce(identity->>'registeredAddress','')),'');
  country_code:=upper(btrim(coalesce(identity->>'countryCode','')));
  verification_status:=lower(btrim(coalesce(identity->>'verificationStatus','provisional')));
  finalized:=coalesce((identity->>'legalDocumentsFinalized')::boolean,false);
  if registered_name is null then missing:=missing||jsonb_build_array('registered_legal_name'); end if;
  if registered_address is null or char_length(registered_address)<10 then missing:=missing||jsonb_build_array('registered_address'); end if;
  if country_code !~ '^[A-Z]{2}$' then missing:=missing||jsonb_build_array('registered_country_code'); end if;
  if verification_status<>'verified' then missing:=missing||jsonb_build_array('registered_identity_verification'); end if;
  if settings.support_email is null or btrim(settings.support_email)='' then missing:=missing||jsonb_build_array('support_email'); end if;
  if settings.support_phone is null or btrim(settings.support_phone)='' then missing:=missing||jsonb_build_array('support_phone'); end if;
  select count(*) into legal_count from public.content_entries ce where ce.content_type='legal' and ce.slug in('about','returns','privacy','terms') and ce.locale='tr' and ce.status='published' and ce.deleted_at is null and char_length(btrim(coalesce(ce.body_markdown,'')))>=100;
  if legal_count<>4 then missing:=missing||jsonb_build_array('published_legal_documents'); end if;
  if not finalized then missing:=missing||jsonb_build_array('legal_documents_finalized'); end if;
  return jsonb_build_object(
    'ready',jsonb_array_length(missing)=0,
    'missing',missing,
    'registeredLegalName',registered_name,
    'registeredAddress',registered_address,
    'countryCode',case when country_code~'^[A-Z]{2}$' then country_code else null end,
    'identityVerificationStatus',case when verification_status='verified' then 'verified' else 'provisional' end,
    'registeredIdentityVerified',verification_status='verified',
    'legalDocumentsFinalized',finalized,
    'publishedLegalDocumentCount',legal_count
  );
end;
$$;
revoke all on function private.commercial_checkout_legal_readiness_v1() from public,anon,authenticated;
grant execute on function private.commercial_checkout_legal_readiness_v1() to postgres,service_role;

create or replace function private.super_admin_get_business_identity_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare settings public.brand_settings%rowtype; identity jsonb; readiness jsonb; verification_status text;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
  readiness:=private.commercial_checkout_legal_readiness_v1();
  verification_status:=case when lower(btrim(coalesce(identity->>'verificationStatus','provisional')))='verified' then 'verified' else 'provisional' end;
  return jsonb_build_object(
    'brandLegalName',settings.legal_name,
    'registeredLegalName',nullif(btrim(coalesce(identity->>'registeredLegalName','')),''),
    'registeredAddress',nullif(btrim(coalesce(identity->>'registeredAddress','')),''),
    'taxOffice',nullif(btrim(coalesce(identity->>'taxOffice','')),''),
    'taxNumber',nullif(btrim(coalesce(identity->>'taxNumber','')),''),
    'mersisNumber',nullif(btrim(coalesce(identity->>'mersisNumber','')),''),
    'tradeRegistryNumber',nullif(btrim(coalesce(identity->>'tradeRegistryNumber','')),''),
    'countryCode',nullif(upper(btrim(coalesce(identity->>'countryCode',''))),''),
    'identityVerificationStatus',verification_status,
    'registeredIdentityVerified',verification_status='verified',
    'legalDocumentsFinalized',coalesce((identity->>'legalDocumentsFinalized')::boolean,false),
    'supportEmail',settings.support_email,
    'supportPhone',settings.support_phone,
    'checkoutLegalReadiness',readiness,
    'updatedAt',settings.updated_at
  );
end;
$$;
revoke all on function private.super_admin_get_business_identity_v2() from public,anon,authenticated;
grant execute on function private.super_admin_get_business_identity_v2() to postgres,service_role;

create or replace function private.super_admin_update_business_identity_v2(p_registered_legal_name text,p_registered_address text,p_tax_office text,p_tax_number text,p_mersis_number text,p_trade_registry_number text,p_country_code text,p_support_email text,p_support_phone text,p_legal_documents_finalized boolean default false)
returns jsonb
language plpgsql
security definer
set search_path=''
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
  current_status text;
  next_status text;
  identity_changed boolean:=false;
  updated public.brand_settings%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if registered_name is not null and (char_length(registered_name) not between 2 and 240 or registered_name ~ '[[:cntrl:]]') then raise exception 'invalid_registered_legal_name' using errcode='22023'; end if;
  if registered_address is not null and (char_length(registered_address) not between 10 and 1000 or registered_address ~ '[[:cntrl:]]') then raise exception 'invalid_registered_address' using errcode='22023'; end if;
  if tax_office is not null and (char_length(tax_office)>160 or tax_office ~ '[[:cntrl:]]') then raise exception 'invalid_tax_office' using errcode='22023'; end if;
  if tax_number is not null and char_length(tax_number) not between 10 and 11 then raise exception 'invalid_tax_number' using errcode='22023'; end if;
  if mersis_number is not null and char_length(mersis_number)<>16 then raise exception 'invalid_mersis_number' using errcode='22023'; end if;
  if trade_registry is not null and (char_length(trade_registry)>120 or trade_registry ~ '[[:cntrl:]]') then raise exception 'invalid_trade_registry_number' using errcode='22023'; end if;
  if country_code is not null and country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_registered_country_code' using errcode='22023'; end if;
  if char_length(email_value) not between 5 and 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_support_email' using errcode='22023'; end if;
  if char_length(phone_value) not between 7 and 40 or phone_value !~ '^[+()0-9 .-]+$' then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  phone_digits:=regexp_replace(phone_value,'[^0-9]','','g'); if char_length(phone_digits) not between 10 and 15 then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  if coalesce(p_legal_documents_finalized,false) and (registered_name is null or registered_address is null or country_code is null) then raise exception 'registered_identity_required_before_legal_finalization' using errcode='22023'; end if;
  select coalesce(public_config,'{}'::jsonb),coalesce(public_config->'businessIdentity','{}'::jsonb) into next_config,current_identity from public.brand_settings where slug='golden-oremar' for update;
  if next_config is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  current_status:=case when lower(btrim(coalesce(current_identity->>'verificationStatus','provisional')))='verified' then 'verified' else 'provisional' end;
  identity_changed :=
    coalesce(current_identity->>'registeredLegalName','') is distinct from coalesce(registered_name,'') or
    coalesce(current_identity->>'registeredAddress','') is distinct from coalesce(registered_address,'') or
    coalesce(current_identity->>'countryCode','') is distinct from coalesce(country_code,'') or
    coalesce(current_identity->>'taxOffice','') is distinct from coalesce(tax_office,'') or
    coalesce(current_identity->>'taxNumber','') is distinct from coalesce(tax_number,'') or
    coalesce(current_identity->>'mersisNumber','') is distinct from coalesce(mersis_number,'') or
    coalesce(current_identity->>'tradeRegistryNumber','') is distinct from coalesce(trade_registry,'');
  next_status:=case when coalesce(p_legal_documents_finalized,false) then 'verified' when identity_changed then 'provisional' else current_status end;
  current_identity:=current_identity||jsonb_build_object(
    'registeredLegalName',registered_name,
    'registeredAddress',registered_address,
    'taxOffice',tax_office,
    'taxNumber',tax_number,
    'mersisNumber',mersis_number,
    'tradeRegistryNumber',trade_registry,
    'countryCode',country_code,
    'verificationStatus',next_status,
    'legalDocumentsFinalized',coalesce(p_legal_documents_finalized,false),
    'updatedBy',caller_id,
    'updatedAt',timezone('utc',now())
  );
  next_config:=jsonb_set(next_config,'{businessIdentity}',current_identity,true);
  next_config:=jsonb_set(next_config,'{contactInfo,email}',to_jsonb(email_value),true);
  next_config:=jsonb_set(next_config,'{contactInfo,phone}',to_jsonb(phone_value),true);
  next_config:=jsonb_set(next_config,'{contactInfo,whatsapp}',to_jsonb('https://wa.me/'||phone_digits),true);
  update public.brand_settings set support_email=email_value,support_phone=phone_value,public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar' returning * into updated;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.registered_business_identity_updated','brand_settings','golden-oremar',jsonb_build_object('registeredLegalNameConfigured',registered_name is not null,'registeredAddressConfigured',registered_address is not null,'taxNumberConfigured',tax_number is not null,'mersisConfigured',mersis_number is not null,'tradeRegistryConfigured',trade_registry is not null,'verificationStatus',next_status,'legalDocumentsFinalized',coalesce(p_legal_documents_finalized,false)));
  return private.super_admin_get_business_identity_v2();
end;
$$;
revoke all on function private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) to postgres,service_role;