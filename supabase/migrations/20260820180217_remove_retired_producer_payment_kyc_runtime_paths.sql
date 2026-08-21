create or replace function private.get_my_producer_payment_onboarding_v1()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  p public.producers%rowtype;
  account private.producer_payment_accounts%rowtype;
  app public.producer_applications%rowtype;
  app_kyc private.producer_application_kyc%rowtype;
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
  select * into p from public.producers where owner_user_id=uid and deleted_at is null order by created_at desc limit 1;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not p.is_verified or p.status not in('active','suspended') then raise exception 'verified_producer_required' using errcode='42501'; end if;
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

  type_ready:=case account.provider_submerchant_type
    when 'PERSONAL' then legal_name_present and national_id_present and iban_present and holder_present and phone_present and email_present and address_present and consent_present
    when 'PRIVATE_COMPANY' then legal_name_present and national_id_present and tax_office_present and iban_present and holder_present and phone_present and email_present and address_present and consent_present
    when 'LIMITED_OR_JOINT_STOCK_COMPANY' then legal_name_present and tax_number_present and tax_office_present and iban_present and holder_present and phone_present and email_present and address_present and consent_present
    else false
  end;

  return jsonb_build_object(
    'producerId',p.id,'producerName',p.display_name,'producerStatus',p.status,'producerVerified',p.is_verified,
    'applicationLinked',p.application_id is not null,'kycSource',source,'legacyKycEditable',false,
    'kyc',jsonb_build_object('legalNamePresent',legal_name_present,'nationalIdPresent',national_id_present,'taxNumberPresent',tax_number_present,'taxOfficePresent',tax_office_present,'ibanPresent',iban_present,'bankAccountHolderPresent',holder_present,'phonePresent',phone_present,'contactEmailPresent',email_present,'addressPresent',address_present,'consentPresent',consent_present,'updatedAt',source_updated_at),
    'paymentAccount',jsonb_build_object('provider','iyzico','providerSubmerchantType',account.provider_submerchant_type,'status',coalesce(account.status,'pending_configuration'),'typeConfigured',account.provider_submerchant_type is not null,'ready',account.status='ready' and account.submerchant_key is not null,'kycCompleteForConfiguredType',type_ready)
  );
end;
$$;

create or replace function private.prepare_producer_submerchant_for_service_v1(p_producer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.producers%rowtype;
  a private.producer_payment_accounts%rowtype;
  app public.producer_applications%rowtype;
  kyc private.producer_application_kyc%rowtype;
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
  if a.provider_submerchant_type not in('PERSONAL','PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then raise exception 'provider_submerchant_type_required' using errcode='55000'; end if;
  if p.application_id is null then raise exception 'producer_application_required' using errcode='55000'; end if;

  select * into app from public.producer_applications where id=p.application_id and status='approved';
  if app.id is null then raise exception 'producer_application_not_approved' using errcode='55000'; end if;
  select * into kyc from private.producer_application_kyc where application_id=app.id;
  if kyc.application_id is null then raise exception 'producer_kyc_missing' using errcode='55000'; end if;

  legal_name_value:=btrim(coalesce(kyc.legal_name,''));
  national_id_value:=case when kyc.national_id_ciphertext is null then '' else private.decrypt_producer_kyc(kyc.national_id_ciphertext) end;
  tax_number_value:=case when kyc.tax_number_ciphertext is null then '' else private.decrypt_producer_kyc(kyc.tax_number_ciphertext) end;
  tax_office_value:=btrim(coalesce(kyc.tax_office,''));
  iban_value:=case when kyc.iban_ciphertext is null then '' else private.decrypt_producer_kyc(kyc.iban_ciphertext) end;
  holder_value:=btrim(coalesce(kyc.bank_account_holder,''));
  phone_value:=private.normalize_tr_phone_v1(kyc.phone);
  email_value:=lower(btrim(coalesce(kyc.contact_email,'')));
  address_value:=kyc.address;
  address_text:=private.producer_payment_address_text_v1(address_value);

  if char_length(legal_name_value)<2 or not private.is_valid_tr_iban_v1(iban_value) or phone_value is null or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(coalesce(address_text,''))<10 then raise exception 'producer_payment_kyc_incomplete' using errcode='55000'; end if;
  if nullif(btrim(coalesce(kyc.consent_version,'')),'') is null or kyc.consented_at is null then raise exception 'payment_kyc_consent_required' using errcode='55000'; end if;
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

  update private.producer_payment_accounts set status='onboarding',last_error=null,updated_at=timezone('utc',now()) where producer_id=p.id;

  return jsonb_strip_nulls(jsonb_build_object('ok',true,'action','create','producerId',p.id,'producerName',p.display_name,'provider','iyzico','providerSubmerchantType',a.provider_submerchant_type,'externalId',a.submerchant_external_id,'kycSource','approved_application','name',p.display_name,'email',email_value,'gsmNumber',phone_value,'address',address_text,'iban',iban_value,'currency','TRY','contactName',case when a.provider_submerchant_type in('PERSONAL','PRIVATE_COMPANY') then contact_name else null end,'contactSurname',case when a.provider_submerchant_type in('PERSONAL','PRIVATE_COMPANY') then contact_surname else null end,'identityNumber',case when a.provider_submerchant_type in('PERSONAL','PRIVATE_COMPANY') then national_id_value else null end,'taxNumber',case when a.provider_submerchant_type='LIMITED_OR_JOINT_STOCK_COMPANY' then tax_number_value else null end,'taxOffice',case when a.provider_submerchant_type in('PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then tax_office_value else null end,'legalCompanyTitle',case when a.provider_submerchant_type in('PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then legal_name_value else null end));
end;
$$;

revoke all on function private.get_my_producer_payment_onboarding_v1() from public,anon;
grant execute on function private.get_my_producer_payment_onboarding_v1() to authenticated;
revoke all on function private.prepare_producer_submerchant_for_service_v1(uuid) from public,anon,authenticated;
grant execute on function private.prepare_producer_submerchant_for_service_v1(uuid) to service_role;
