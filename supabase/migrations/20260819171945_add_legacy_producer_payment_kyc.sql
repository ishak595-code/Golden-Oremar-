create table if not exists private.producer_payment_kyc_profiles (
  producer_id uuid primary key references public.producers(id) on delete cascade,
  legal_name text not null,
  national_id_ciphertext text,
  tax_office text,
  tax_number_ciphertext text,
  iban_ciphertext text not null,
  bank_account_holder text not null,
  phone text not null,
  contact_email text not null,
  address jsonb not null,
  consent_version text not null,
  consented_at timestamptz not null default timezone('utc',now()),
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint producer_payment_kyc_address_object check (jsonb_typeof(address)='object')
);

alter table private.producer_payment_kyc_profiles enable row level security;
revoke all on table private.producer_payment_kyc_profiles from public,anon,authenticated;

create or replace function private.is_valid_turkish_identity_v1(p_value text)
returns boolean
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v text:=btrim(coalesce(p_value,''));
  d int[];
  odd_sum int;
  even_sum int;
begin
  if v !~ '^[1-9][0-9]{10}$' then return false; end if;
  d:=array(select substr(v,i,1)::int from generate_series(1,11) i);
  odd_sum:=d[1]+d[3]+d[5]+d[7]+d[9];
  even_sum:=d[2]+d[4]+d[6]+d[8];
  return ((odd_sum*7-even_sum)%10+10)%10=d[10]
    and (select sum(x) from unnest(d[1:10]) x)%10=d[11];
end;
$function$;

create or replace function private.is_valid_tr_iban_v1(p_value text)
returns boolean
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v text:=upper(regexp_replace(coalesce(p_value,''),'[^A-Za-z0-9]','','g'));
  rearranged text;
  expanded text;
  i int;
  c text;
  remainder int:=0;
begin
  if v !~ '^TR[0-9]{24}$' then return false; end if;
  rearranged:=substr(v,5)||substr(v,1,4);
  expanded:='';
  for i in 1..char_length(rearranged) loop
    c:=substr(rearranged,i,1);
    if c ~ '^[A-Z]$' then expanded:=expanded||(ascii(c)-55)::text; else expanded:=expanded||c; end if;
  end loop;
  for i in 1..char_length(expanded) loop
    remainder:=(remainder*10+substr(expanded,i,1)::int)%97;
  end loop;
  return remainder=1;
end;
$function$;

create or replace function private.normalize_tr_phone_v1(p_value text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare digits text:=regexp_replace(coalesce(p_value,''),'[^0-9]','','g');
begin
  if digits ~ '^0[0-9]{10}$' then digits:=substr(digits,2); end if;
  if digits ~ '^90[0-9]{10}$' then return '+'||digits; end if;
  if digits ~ '^[0-9]{10}$' then return '+90'||digits; end if;
  return null;
end;
$function$;

create or replace function private.producer_payment_address_text_v1(p_address jsonb)
returns text
language sql
immutable
set search_path to ''
as $function$
  select nullif(btrim(concat_ws(' ',
    nullif(btrim(coalesce(p_address->>'address_line',p_address->>'addressLine',p_address->>'address_line1','')),''),
    nullif(btrim(coalesce(p_address->>'neighborhood','')),''),
    nullif(btrim(coalesce(p_address->>'district','')),''),
    nullif(btrim(coalesce(p_address->>'province','')),''),
    nullif(btrim(coalesce(p_address->>'postal_code',p_address->>'postalCode','')),''),
    nullif(btrim(coalesce(p_address->>'country_code',p_address->>'countryCode','TR')),'')
  )), '');
$function$;

create or replace function private.get_my_producer_payment_onboarding_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  p public.producers%rowtype;
  account private.producer_payment_accounts%rowtype;
  app public.producer_applications%rowtype;
  app_kyc private.producer_application_kyc%rowtype;
  legacy private.producer_payment_kyc_profiles%rowtype;
  source text:='missing';
  legal_name_present boolean:=false;
  national_id_present boolean:=false;
  tax_number_present boolean:=false;
  tax_office_present boolean:=false;
  iban_present boolean:=false;
  holder_present boolean:=false;
  phone_present boolean:=false;
  email_present boolean:=false;
  address_present boolean:=false;
  consent_present boolean:=false;
  source_updated_at timestamptz;
  type_ready boolean:=false;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where owner_user_id=uid and deleted_at is null order by created_at limit 1;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not p.is_verified or p.status not in ('active','suspended') then raise exception 'verified_producer_required' using errcode='42501'; end if;

  select * into account from private.producer_payment_accounts where producer_id=p.id;

  if p.application_id is not null then
    select * into app from public.producer_applications where id=p.application_id and applicant_user_id=uid and status='approved';
    if app.id is not null then
      select * into app_kyc from private.producer_application_kyc where application_id=app.id;
      if app_kyc.application_id is not null then
        source:='approved_application';
        legal_name_present:=nullif(btrim(coalesce(app_kyc.legal_name,'')),'') is not null;
        national_id_present:=nullif(btrim(coalesce(app_kyc.national_id_ciphertext,'')),'') is not null;
        tax_number_present:=nullif(btrim(coalesce(app_kyc.tax_number_ciphertext,'')),'') is not null;
        tax_office_present:=nullif(btrim(coalesce(app_kyc.tax_office,'')),'') is not null;
        iban_present:=nullif(btrim(coalesce(app_kyc.iban_ciphertext,'')),'') is not null;
        holder_present:=nullif(btrim(coalesce(app_kyc.bank_account_holder,'')),'') is not null;
        phone_present:=private.normalize_tr_phone_v1(app_kyc.phone) is not null;
        email_present:=coalesce(app_kyc.contact_email,'') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
        address_present:=char_length(coalesce(private.producer_payment_address_text_v1(app_kyc.address),''))>=10;
        consent_present:=nullif(btrim(coalesce(app_kyc.consent_version,'')),'') is not null and app_kyc.consented_at is not null;
        source_updated_at:=app_kyc.updated_at;
      end if;
    end if;
  end if;

  if source='missing' then
    select * into legacy from private.producer_payment_kyc_profiles where producer_id=p.id;
    if legacy.producer_id is not null then
      source:='legacy_payment_profile';
      legal_name_present:=nullif(btrim(coalesce(legacy.legal_name,'')),'') is not null;
      national_id_present:=nullif(btrim(coalesce(legacy.national_id_ciphertext,'')),'') is not null;
      tax_number_present:=nullif(btrim(coalesce(legacy.tax_number_ciphertext,'')),'') is not null;
      tax_office_present:=nullif(btrim(coalesce(legacy.tax_office,'')),'') is not null;
      iban_present:=nullif(btrim(coalesce(legacy.iban_ciphertext,'')),'') is not null;
      holder_present:=nullif(btrim(coalesce(legacy.bank_account_holder,'')),'') is not null;
      phone_present:=private.normalize_tr_phone_v1(legacy.phone) is not null;
      email_present:=coalesce(legacy.contact_email,'') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
      address_present:=char_length(coalesce(private.producer_payment_address_text_v1(legacy.address),''))>=10;
      consent_present:=legacy.consent_version='producer-payment-kyc-v1' and legacy.consented_at is not null;
      source_updated_at:=legacy.updated_at;
    end if;
  end if;

  type_ready:=case account.provider_submerchant_type
    when 'PERSONAL' then legal_name_present and national_id_present and iban_present and holder_present and phone_present and email_present and address_present and consent_present
    when 'PRIVATE_COMPANY' then legal_name_present and national_id_present and tax_office_present and iban_present and holder_present and phone_present and email_present and address_present and consent_present
    when 'LIMITED_OR_JOINT_STOCK_COMPANY' then legal_name_present and tax_number_present and tax_office_present and iban_present and holder_present and phone_present and email_present and address_present and consent_present
    else false
  end;

  return jsonb_build_object(
    'producerId',p.id,
    'producerName',p.display_name,
    'producerStatus',p.status,
    'producerVerified',p.is_verified,
    'applicationLinked',p.application_id is not null,
    'kycSource',source,
    'legacyKycEditable',p.application_id is null and coalesce(account.status,'pending_configuration')<>'ready' and p.status='active',
    'kyc',jsonb_build_object(
      'legalNamePresent',legal_name_present,
      'nationalIdPresent',national_id_present,
      'taxNumberPresent',tax_number_present,
      'taxOfficePresent',tax_office_present,
      'ibanPresent',iban_present,
      'bankAccountHolderPresent',holder_present,
      'phonePresent',phone_present,
      'contactEmailPresent',email_present,
      'addressPresent',address_present,
      'consentPresent',consent_present,
      'updatedAt',source_updated_at
    ),
    'paymentAccount',jsonb_build_object(
      'provider','iyzico',
      'providerSubmerchantType',account.provider_submerchant_type,
      'status',coalesce(account.status,'pending_configuration'),
      'typeConfigured',account.provider_submerchant_type is not null,
      'ready',account.status='ready' and account.submerchant_key is not null,
      'kycCompleteForConfiguredType',type_ready
    )
  );
end;
$function$;

create or replace function private.save_my_producer_payment_kyc_v1(
  p_legal_name text,
  p_national_id text,
  p_tax_number text,
  p_tax_office text,
  p_iban text,
  p_bank_account_holder text,
  p_phone text,
  p_contact_email text,
  p_address_line text,
  p_district text,
  p_province text,
  p_postal_code text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  p public.producers%rowtype;
  account private.producer_payment_accounts%rowtype;
  legal_name_value text:=btrim(coalesce(p_legal_name,''));
  national_id_value text:=regexp_replace(coalesce(p_national_id,''),'[^0-9]','','g');
  tax_number_value text:=regexp_replace(coalesce(p_tax_number,''),'[^0-9]','','g');
  tax_office_value text:=btrim(coalesce(p_tax_office,''));
  iban_value text:=upper(regexp_replace(coalesce(p_iban,''),'[^A-Za-z0-9]','','g'));
  holder_value text:=btrim(coalesce(p_bank_account_holder,''));
  phone_value text:=private.normalize_tr_phone_v1(p_phone);
  email_value text:=lower(btrim(coalesce(p_contact_email,'')));
  address_line_value text:=btrim(coalesce(p_address_line,''));
  district_value text:=btrim(coalesce(p_district,''));
  province_value text:=btrim(coalesce(p_province,''));
  postal_value text:=btrim(coalesce(p_postal_code,''));
  address_value jsonb;
  saved private.producer_payment_kyc_profiles%rowtype;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where owner_user_id=uid and deleted_at is null order by created_at limit 1 for update;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if p.status<>'active' or not p.is_verified then raise exception 'active_verified_producer_required' using errcode='42501'; end if;
  if p.application_id is not null then raise exception 'approved_application_kyc_is_canonical' using errcode='55000'; end if;
  select * into account from private.producer_payment_accounts where producer_id=p.id;
  if account.status='ready' then raise exception 'producer_payment_account_already_ready' using errcode='55000'; end if;

  if char_length(legal_name_value) not between 2 and 240 then raise exception 'invalid_legal_name' using errcode='22023'; end if;
  if national_id_value<>'' and not private.is_valid_turkish_identity_v1(national_id_value) then raise exception 'invalid_turkish_identity' using errcode='22023'; end if;
  if tax_number_value<>'' and tax_number_value !~ '^[0-9]{10}$' then raise exception 'invalid_tax_number' using errcode='22023'; end if;
  if national_id_value='' and tax_number_value='' then raise exception 'identity_or_tax_number_required' using errcode='22023'; end if;
  if tax_office_value<>'' and char_length(tax_office_value) not between 2 and 120 then raise exception 'invalid_tax_office' using errcode='22023'; end if;
  if not private.is_valid_tr_iban_v1(iban_value) then raise exception 'invalid_tr_iban' using errcode='22023'; end if;
  if char_length(holder_value) not between 2 and 240 then raise exception 'invalid_bank_account_holder' using errcode='22023'; end if;
  if phone_value is null then raise exception 'invalid_tr_phone' using errcode='22023'; end if;
  if char_length(email_value) not between 5 and 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_contact_email' using errcode='22023'; end if;
  if char_length(address_line_value) not between 10 and 700 then raise exception 'invalid_payment_address' using errcode='22023'; end if;
  if char_length(district_value) not between 2 and 120 or char_length(province_value) not between 2 and 120 then raise exception 'invalid_payment_location' using errcode='22023'; end if;
  if char_length(postal_value)>20 then raise exception 'invalid_postal_code' using errcode='22023'; end if;
  if p_consent_version<>'producer-payment-kyc-v1' then raise exception 'payment_kyc_consent_required' using errcode='22023'; end if;

  address_value:=jsonb_build_object('address_line',address_line_value,'district',district_value,'province',province_value,'postal_code',nullif(postal_value,''),'country_code','TR');

  insert into private.producer_payment_kyc_profiles(
    producer_id,legal_name,national_id_ciphertext,tax_office,tax_number_ciphertext,iban_ciphertext,
    bank_account_holder,phone,contact_email,address,consent_version,consented_at,updated_at
  ) values(
    p.id,legal_name_value,
    case when national_id_value='' then null else private.encrypt_producer_kyc(national_id_value) end,
    nullif(tax_office_value,''),
    case when tax_number_value='' then null else private.encrypt_producer_kyc(tax_number_value) end,
    private.encrypt_producer_kyc(iban_value),holder_value,phone_value,email_value,address_value,
    p_consent_version,timezone('utc',now()),timezone('utc',now())
  )
  on conflict(producer_id) do update set
    legal_name=excluded.legal_name,
    national_id_ciphertext=excluded.national_id_ciphertext,
    tax_office=excluded.tax_office,
    tax_number_ciphertext=excluded.tax_number_ciphertext,
    iban_ciphertext=excluded.iban_ciphertext,
    bank_account_holder=excluded.bank_account_holder,
    phone=excluded.phone,
    contact_email=excluded.contact_email,
    address=excluded.address,
    consent_version=excluded.consent_version,
    consented_at=timezone('utc',now()),
    updated_at=timezone('utc',now())
  returning * into saved;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(uid,'producer.payment_kyc_completed','producer',p.id,jsonb_build_object(
    'source','legacy_payment_profile','nationalIdProvided',national_id_value<>'','taxNumberProvided',tax_number_value<>'','taxOfficeProvided',tax_office_value<>'','consentVersion',p_consent_version
  ));

  return private.get_my_producer_payment_onboarding_v1();
end;
$function$;

create or replace function private.prepare_producer_submerchant_for_service_v1(p_producer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  p public.producers%rowtype;
  a private.producer_payment_accounts%rowtype;
  app public.producer_applications%rowtype;
  kyc private.producer_application_kyc%rowtype;
  legacy private.producer_payment_kyc_profiles%rowtype;
  source text;
  legal_name_value text;
  national_id_value text;
  tax_number_value text;
  tax_office_value text;
  iban_value text;
  holder_value text;
  phone_value text;
  email_value text;
  address_value jsonb;
  address_text text;
  name_parts text[];
  contact_name text;
  contact_surname text;
begin
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if p.status<>'active' or not p.is_verified then raise exception 'active_verified_producer_required' using errcode='55000'; end if;
  select * into a from private.producer_payment_accounts where producer_id=p.id;
  if a.producer_id is null then raise exception 'producer_payment_account_not_configured' using errcode='55000'; end if;
  if a.provider<>'iyzico' then raise exception 'unsupported_payment_provider' using errcode='55000'; end if;
  if a.status='ready' and a.submerchant_key is not null then return jsonb_build_object('ok',true,'action','ready','producerId',p.id,'provider','iyzico','providerSubmerchantType',a.provider_submerchant_type,'externalId',a.submerchant_external_id); end if;
  if a.status='suspended' then raise exception 'producer_payment_account_suspended' using errcode='55000'; end if;
  if a.provider_submerchant_type not in ('PERSONAL','PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then raise exception 'provider_submerchant_type_required' using errcode='55000'; end if;

  if p.application_id is not null then
    select * into app from public.producer_applications where id=p.application_id and status='approved';
    if app.id is null then raise exception 'producer_application_not_approved' using errcode='55000'; end if;
    select * into kyc from private.producer_application_kyc where application_id=app.id;
    if kyc.application_id is null then raise exception 'producer_kyc_missing' using errcode='55000'; end if;
    source:='approved_application';
    legal_name_value:=btrim(coalesce(kyc.legal_name,''));
    national_id_value:=case when kyc.national_id_ciphertext is null then '' else private.decrypt_producer_kyc(kyc.national_id_ciphertext) end;
    tax_number_value:=case when kyc.tax_number_ciphertext is null then '' else private.decrypt_producer_kyc(kyc.tax_number_ciphertext) end;
    tax_office_value:=btrim(coalesce(kyc.tax_office,''));
    iban_value:=case when kyc.iban_ciphertext is null then '' else private.decrypt_producer_kyc(kyc.iban_ciphertext) end;
    holder_value:=btrim(coalesce(kyc.bank_account_holder,''));
    phone_value:=private.normalize_tr_phone_v1(kyc.phone);
    email_value:=lower(btrim(coalesce(kyc.contact_email,'')));
    address_value:=kyc.address;
  else
    select * into legacy from private.producer_payment_kyc_profiles where producer_id=p.id;
    if legacy.producer_id is null then raise exception 'producer_payment_kyc_missing' using errcode='55000'; end if;
    source:='legacy_payment_profile';
    legal_name_value:=btrim(coalesce(legacy.legal_name,''));
    national_id_value:=case when legacy.national_id_ciphertext is null then '' else private.decrypt_producer_kyc(legacy.national_id_ciphertext) end;
    tax_number_value:=case when legacy.tax_number_ciphertext is null then '' else private.decrypt_producer_kyc(legacy.tax_number_ciphertext) end;
    tax_office_value:=btrim(coalesce(legacy.tax_office,''));
    iban_value:=private.decrypt_producer_kyc(legacy.iban_ciphertext);
    holder_value:=btrim(coalesce(legacy.bank_account_holder,''));
    phone_value:=private.normalize_tr_phone_v1(legacy.phone);
    email_value:=lower(btrim(coalesce(legacy.contact_email,'')));
    address_value:=legacy.address;
    if legacy.consent_version<>'producer-payment-kyc-v1' then raise exception 'payment_kyc_consent_required' using errcode='55000'; end if;
  end if;

  address_text:=private.producer_payment_address_text_v1(address_value);
  if char_length(legal_name_value)<2 or not private.is_valid_tr_iban_v1(iban_value) or phone_value is null or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(coalesce(address_text,''))<10 then raise exception 'producer_payment_kyc_incomplete' using errcode='55000'; end if;
  if char_length(holder_value)<2 then holder_value:=legal_name_value; end if;
  name_parts:=regexp_split_to_array(holder_value,'[[:space:]]+');
  if cardinality(name_parts)>=2 then contact_name:=array_to_string(name_parts[1:cardinality(name_parts)-1],' '); contact_surname:=name_parts[cardinality(name_parts)]; else contact_name:=holder_value; contact_surname:=''; end if;

  if a.provider_submerchant_type='PERSONAL' then
    if not private.is_valid_turkish_identity_v1(national_id_value) or contact_surname='' then raise exception 'personal_submerchant_kyc_incomplete' using errcode='55000'; end if;
  elsif a.provider_submerchant_type='PRIVATE_COMPANY' then
    if not private.is_valid_turkish_identity_v1(national_id_value) or char_length(tax_office_value)<2 or char_length(legal_name_value)<2 or contact_surname='' then raise exception 'private_company_submerchant_kyc_incomplete' using errcode='55000'; end if;
  elsif a.provider_submerchant_type='LIMITED_OR_JOINT_STOCK_COMPANY' then
    if tax_number_value !~ '^[0-9]{10}$' or char_length(tax_office_value)<2 or char_length(legal_name_value)<2 then raise exception 'corporate_submerchant_kyc_incomplete' using errcode='55000'; end if;
  end if;

  update private.producer_payment_accounts set status='onboarding',onboarding_requested_at=coalesce(onboarding_requested_at,timezone('utc',now())),last_error=null,updated_at=timezone('utc',now()) where producer_id=p.id;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok',true,'action','create','producerId',p.id,'producerName',p.display_name,'provider','iyzico','providerSubmerchantType',a.provider_submerchant_type,'externalId',a.submerchant_external_id,
    'kycSource',source,'name',p.display_name,'email',email_value,'gsmNumber',phone_value,'address',address_text,'iban',iban_value,'currency','TRY',
    'contactName',case when a.provider_submerchant_type in ('PERSONAL','PRIVATE_COMPANY') then contact_name else null end,
    'contactSurname',case when a.provider_submerchant_type in ('PERSONAL','PRIVATE_COMPANY') then contact_surname else null end,
    'identityNumber',case when a.provider_submerchant_type in ('PERSONAL','PRIVATE_COMPANY') then national_id_value else null end,
    'taxNumber',case when a.provider_submerchant_type='LIMITED_OR_JOINT_STOCK_COMPANY' then tax_number_value else null end,
    'taxOffice',case when a.provider_submerchant_type in ('PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then tax_office_value else null end,
    'legalCompanyTitle',case when a.provider_submerchant_type in ('PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then legal_name_value else null end
  ));
end;
$function$;

revoke all on function private.get_my_producer_payment_onboarding_v1() from public,anon;
revoke all on function private.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function private.get_my_producer_payment_onboarding_v1() to authenticated;
grant execute on function private.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.get_my_producer_payment_onboarding_v1()
returns jsonb language sql stable security invoker set search_path to '' as $function$
  select private.get_my_producer_payment_onboarding_v1();
$function$;
create or replace function public.save_my_producer_payment_kyc_v1(p_legal_name text,p_national_id text,p_tax_number text,p_tax_office text,p_iban text,p_bank_account_holder text,p_phone text,p_contact_email text,p_address_line text,p_district text,p_province text,p_postal_code text,p_consent_version text)
returns jsonb language sql security invoker set search_path to '' as $function$
  select private.save_my_producer_payment_kyc_v1(p_legal_name,p_national_id,p_tax_number,p_tax_office,p_iban,p_bank_account_holder,p_phone,p_contact_email,p_address_line,p_district,p_province,p_postal_code,p_consent_version);
$function$;
revoke all on function public.get_my_producer_payment_onboarding_v1() from public,anon;
revoke all on function public.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.get_my_producer_payment_onboarding_v1() to authenticated;
grant execute on function public.save_my_producer_payment_kyc_v1(text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

comment on table private.producer_payment_kyc_profiles is 'Encrypted payment-onboarding KYC fallback only for verified legacy producers without canonical approved producer applications.';
