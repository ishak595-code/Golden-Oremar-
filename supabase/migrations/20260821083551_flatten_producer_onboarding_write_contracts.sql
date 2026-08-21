create or replace function private.save_producer_application_draft_v5(
  p_application_id uuid,
  p_seller_classification text,
  p_activity_types text[],
  p_brand_name text,
  p_public_name text,
  p_description text,
  p_production_country_code text,
  p_production_province text,
  p_production_district text,
  p_production_village text,
  p_production_village_is_custom boolean,
  p_production_latitude numeric,
  p_production_longitude numeric,
  p_product_categories text[],
  p_legal_name text,
  p_identifier text,
  p_tax_office text,
  p_mersis_number text,
  p_tax_exemption_number text,
  p_iban text,
  p_phone text,
  p_contact_email text,
  p_address jsonb,
  p_food_compliance_status text,
  p_food_registration_number text,
  p_fulfillment_methods text[],
  p_average_dispatch_days integer,
  p_cold_chain_capable boolean,
  p_planned_products jsonb,
  p_sourcing_models text[],
  p_organic_claim_status text,
  p_organic_certifier_name text,
  p_organic_certificate_number text,
  p_organic_certificate_expires_on date,
  p_village_product_commitment boolean,
  p_traceability_commitment boolean,
  p_product_truth_commitment boolean,
  p_production_practice_notes text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid := auth.uid();
  allowed_activities constant text[] := array['beekeeping','livestock','dairy','poultry','field_farming','fruit_growing','vegetable_growing','wild_harvest','fishing','food_processing','beverage_production','natural_materials'];
  allowed_sources constant text[] := array['own_production','family_production','cooperative_production'];
  allowed_seller_classes constant text[] := array['individual_non_merchant','tax_exempt_artisan','artisan','sole_proprietor','company','cooperative'];
  derived_applicant_type text;
  normalized_activities text[];
  normalized_categories text[];
  normalized_sources text[];
  normalized_fulfillment text[];
  normalized_identifier text := regexp_replace(coalesce(p_identifier,''),'[^0-9]','','g');
  normalized_iban text := upper(regexp_replace(coalesce(p_iban,''),'[^A-Za-z0-9]','','g'));
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g');
  normalized_mersis text := regexp_replace(coalesce(p_mersis_number,''),'[^0-9]','','g');
  normalized_tax_exemption text := btrim(coalesce(p_tax_exemption_number,''));
  normalized_food_registration text := btrim(coalesce(p_food_registration_number,''));
  normalized_organic_number text := btrim(coalesce(p_organic_certificate_number,''));
  normalized_brand text := btrim(coalesce(p_brand_name,''));
  normalized_public_name text := btrim(coalesce(p_public_name,''));
  normalized_legal_name text := btrim(coalesce(p_legal_name,''));
  country_code text := upper(btrim(coalesce(p_production_country_code,'')));
  province text := btrim(coalesce(p_production_province,''));
  district text := btrim(coalesce(p_production_district,''));
  village text := btrim(coalesce(p_production_village,''));
  formatted_location text;
  account_email text;
  account_email_confirmed_at timestamptz;
  application_id uuid;
  previous_phone text;
  previous_phone_verified_at timestamptz;
  previous_phone_verified_by uuid;
  product_item jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=caller_id and p.status='active' and p.deleted_at is null) then
    raise exception 'active_profile_required' using errcode='42501';
  end if;
  if p_consent_version <> 'producer-onboarding-v2-2026-08-19' then
    raise exception 'producer_consent_required' using errcode='22023';
  end if;
  if not (p_seller_classification=any(allowed_seller_classes)) then
    raise exception 'invalid_seller_classification' using errcode='22023';
  end if;
  derived_applicant_type := case when p_seller_classification in ('individual_non_merchant','tax_exempt_artisan') then 'individual' else 'business' end;

  if char_length(normalized_public_name) not between 2 and 160
     or char_length(normalized_legal_name) not between 2 and 240 then
    raise exception 'invalid_producer_name' using errcode='22023';
  end if;
  if normalized_brand='' then normalized_brand:=normalized_public_name; end if;
  if char_length(normalized_brand) not between 2 and 160 then raise exception 'invalid_producer_brand' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_description,''))) not between 40 and 4000 then raise exception 'invalid_producer_description' using errcode='22023'; end if;

  if country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_production_country_code' using errcode='22023'; end if;
  if char_length(province) not between 2 and 100 then raise exception 'invalid_production_province' using errcode='22023'; end if;
  if char_length(district) not between 2 and 100 then raise exception 'invalid_production_district' using errcode='22023'; end if;
  if char_length(village) not between 2 and 160 then raise exception 'invalid_production_village' using errcode='22023'; end if;
  if (p_production_latitude is null)<>(p_production_longitude is null) then raise exception 'production_coordinates_must_be_paired' using errcode='22023'; end if;
  if p_production_latitude is not null and p_production_latitude not between -90 and 90 then raise exception 'invalid_production_latitude' using errcode='22023'; end if;
  if p_production_longitude is not null and p_production_longitude not between -180 and 180 then raise exception 'invalid_production_longitude' using errcode='22023'; end if;
  formatted_location:=village||', '||district||', '||province||', '||country_code;

  select coalesce(array_agg(distinct value order by value),'{}'::text[])
  into normalized_activities
  from unnest(coalesce(p_activity_types,'{}'::text[])) value
  where value=any(allowed_activities);
  if cardinality(normalized_activities) not between 1 and 12
     or cardinality(normalized_activities)<>cardinality(coalesce(p_activity_types,'{}'::text[])) then
    raise exception 'invalid_producer_activity_types' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct c.slug order by c.slug),'{}'::text[])
  into normalized_categories
  from public.categories c
  where c.is_active=true and c.slug=any(coalesce(p_product_categories,'{}'::text[]));
  if cardinality(normalized_categories) not between 1 and 30
     or cardinality(normalized_categories)<>cardinality(coalesce(p_product_categories,'{}'::text[])) then
    raise exception 'invalid_producer_category_scope' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct value order by value),'{}'::text[])
  into normalized_sources
  from unnest(coalesce(p_sourcing_models,'{}'::text[])) value
  where value=any(allowed_sources);
  if cardinality(normalized_sources) not between 1 and 3
     or cardinality(normalized_sources)<>cardinality(coalesce(p_sourcing_models,'{}'::text[])) then
    raise exception 'producer_intermediary_source_not_allowed' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct value order by value),'{}'::text[])
  into normalized_fulfillment
  from unnest(coalesce(p_fulfillment_methods,'{}'::text[])) value
  where value in ('cargo','local_delivery','pickup');
  if cardinality(normalized_fulfillment) not between 1 and 3
     or cardinality(normalized_fulfillment)<>cardinality(coalesce(p_fulfillment_methods,'{}'::text[])) then
    raise exception 'invalid_fulfillment_methods' using errcode='22023';
  end if;
  if p_average_dispatch_days is null or p_average_dispatch_days not between 1 and 30 then raise exception 'invalid_dispatch_days' using errcode='22023'; end if;
  if p_cold_chain_capable is null then raise exception 'cold_chain_declaration_required' using errcode='22023'; end if;

  if p_planned_products is null or jsonb_typeof(p_planned_products)<>'array' or jsonb_array_length(p_planned_products) not between 1 and 30 then
    raise exception 'invalid_planned_products' using errcode='22023';
  end if;
  for product_item in select value from jsonb_array_elements(p_planned_products)
  loop
    if jsonb_typeof(product_item)<>'object'
       or char_length(btrim(coalesce(product_item->>'name',''))) not between 2 and 120
       or not (coalesce(product_item->>'category','')=any(normalized_categories))
       or not (coalesce(product_item->>'source_model','')=any(allowed_sources))
       or char_length(btrim(coalesce(product_item->>'unit',''))) not between 1 and 30
       or coalesce(product_item->>'estimated_quantity','') !~ '^[0-9]+([.][0-9]{1,2})?$'
       or (product_item->>'estimated_quantity')::numeric<=0
       or (product_item->>'estimated_quantity')::numeric>1000000 then
      raise exception 'invalid_planned_product_item' using errcode='22023';
    end if;
  end loop;

  if derived_applicant_type='individual' and not private.is_valid_tckn(normalized_identifier) then raise exception 'invalid_national_id' using errcode='22023'; end if;
  if derived_applicant_type='business' and normalized_identifier !~ '^[0-9]{10}$' then raise exception 'invalid_tax_number' using errcode='22023'; end if;
  if derived_applicant_type='business' and char_length(btrim(coalesce(p_tax_office,''))) not between 2 and 160 then raise exception 'tax_office_required' using errcode='22023'; end if;
  if p_seller_classification in ('company','cooperative') and normalized_mersis !~ '^[0-9]{16}$' then raise exception 'invalid_mersis_number' using errcode='22023'; end if;
  if p_seller_classification='tax_exempt_artisan' and char_length(normalized_tax_exemption) not between 4 and 80 then raise exception 'tax_exemption_number_required' using errcode='22023'; end if;
  if normalized_iban<>'' and normalized_iban !~ '^TR[0-9]{24}$' then raise exception 'invalid_iban' using errcode='22023'; end if;
  if normalized_phone !~ '^\+?[0-9]{10,15}$' then raise exception 'invalid_phone' using errcode='22023'; end if;

  select u.email,u.email_confirmed_at into account_email,account_email_confirmed_at from auth.users u where u.id=caller_id;
  if account_email_confirmed_at is null or lower(btrim(coalesce(p_contact_email,'')))<>lower(coalesce(account_email,'')) then
    raise exception 'contact_email_must_match_verified_account' using errcode='22023';
  end if;

  if p_address is null or jsonb_typeof(p_address)<>'object'
     or coalesce(p_address->>'country_code','') !~ '^[A-Za-z]{2}$'
     or char_length(btrim(coalesce(p_address->>'province',''))) not between 2 and 100
     or char_length(btrim(coalesce(p_address->>'district',''))) not between 2 and 100
     or coalesce(p_address->>'settlement_type','') not in ('village','neighborhood','hamlet','other')
     or char_length(btrim(coalesce(p_address->>'settlement_name',''))) not between 2 and 160
     or char_length(btrim(coalesce(p_address->>'address_line',''))) not between 5 and 500
     or (coalesce(p_address->>'postal_code','')<>'' and (char_length(p_address->>'postal_code')>24 or (p_address->>'postal_code') !~ '^[A-Za-z0-9 -]+$')) then
    raise exception 'invalid_detailed_address' using errcode='22023';
  end if;

  if p_food_compliance_status not in ('registered','approved_facility','primary_production_review','pending') then raise exception 'invalid_food_compliance_status' using errcode='22023'; end if;
  if p_food_compliance_status in ('registered','approved_facility') and char_length(normalized_food_registration) not between 4 and 120 then raise exception 'food_registration_number_required' using errcode='22023'; end if;
  if p_organic_claim_status not in ('certified','certification_in_progress','not_certified_no_claim') then raise exception 'invalid_organic_claim_status' using errcode='22023'; end if;
  if p_organic_claim_status='certified' and (
     char_length(btrim(coalesce(p_organic_certifier_name,''))) not between 2 and 160
     or char_length(normalized_organic_number) not between 4 and 100
     or p_organic_certificate_expires_on is null
     or p_organic_certificate_expires_on<current_date) then
    raise exception 'invalid_organic_certificate_details' using errcode='22023';
  end if;
  if char_length(btrim(coalesce(p_production_practice_notes,''))) not between 30 and 2000 then raise exception 'invalid_production_practice_notes' using errcode='22023'; end if;

  if p_application_id is not null then
    select a.id into application_id
    from public.producer_applications a
    where a.id=p_application_id and a.applicant_user_id=caller_id and a.status in ('draft','needs_information')
    for update;
    if application_id is null then raise exception 'producer_application_not_editable' using errcode='55000'; end if;
  else
    select a.id into application_id
    from public.producer_applications a
    where a.applicant_user_id=caller_id and a.status in ('draft','needs_information')
    order by a.updated_at desc limit 1 for update;
  end if;

  if application_id is not null then
    select k.phone,k.phone_verified_at,k.phone_verified_by
    into previous_phone,previous_phone_verified_at,previous_phone_verified_by
    from private.producer_application_kyc k where k.application_id=application_id;
  end if;

  if application_id is null then
    insert into public.producer_applications(
      applicant_user_id,applicant_type,seller_classification,activity_types,brand_name,public_name,description,
      production_location,production_country_code,production_province,production_district,production_village,
      production_village_is_custom,production_latitude,production_longitude,product_categories,status,
      food_compliance_status,fulfillment_methods,average_dispatch_days,cold_chain_capable,planned_products,
      sourcing_models,organic_claim_status,organic_certifier_name,organic_certificate_expires_on,
      village_product_commitment,traceability_commitment,product_truth_commitment,production_practice_notes
    ) values (
      caller_id,derived_applicant_type,p_seller_classification,normalized_activities,normalized_brand,normalized_public_name,btrim(p_description),
      formatted_location,country_code,province,district,village,coalesce(p_production_village_is_custom,false),p_production_latitude,p_production_longitude,
      normalized_categories,'draft',p_food_compliance_status,normalized_fulfillment,p_average_dispatch_days,p_cold_chain_capable,p_planned_products,
      normalized_sources,p_organic_claim_status,nullif(btrim(coalesce(p_organic_certifier_name,'')),''),
      case when p_organic_claim_status='certified' then p_organic_certificate_expires_on else null end,
      coalesce(p_village_product_commitment,false),coalesce(p_traceability_commitment,false),coalesce(p_product_truth_commitment,false),btrim(p_production_practice_notes)
    ) returning id into application_id;
  else
    update public.producer_applications a set
      applicant_type=derived_applicant_type,seller_classification=p_seller_classification,activity_types=normalized_activities,
      brand_name=normalized_brand,public_name=normalized_public_name,description=btrim(p_description),production_location=formatted_location,
      production_country_code=country_code,production_province=province,production_district=district,production_village=village,
      production_village_is_custom=coalesce(p_production_village_is_custom,false),production_latitude=p_production_latitude,
      production_longitude=p_production_longitude,product_categories=normalized_categories,status='draft',submitted_at=null,
      reviewed_at=null,reviewed_by=null,rejection_reason=null,food_compliance_status=p_food_compliance_status,
      fulfillment_methods=normalized_fulfillment,average_dispatch_days=p_average_dispatch_days,cold_chain_capable=p_cold_chain_capable,
      planned_products=p_planned_products,sourcing_models=normalized_sources,organic_claim_status=p_organic_claim_status,
      organic_certifier_name=nullif(btrim(coalesce(p_organic_certifier_name,'')),''),
      organic_certificate_expires_on=case when p_organic_claim_status='certified' then p_organic_certificate_expires_on else null end,
      village_product_commitment=coalesce(p_village_product_commitment,false),traceability_commitment=coalesce(p_traceability_commitment,false),
      product_truth_commitment=coalesce(p_product_truth_commitment,false),production_practice_notes=btrim(p_production_practice_notes),
      updated_at=timezone('utc',now())
    where a.id=application_id;
  end if;

  insert into private.producer_application_kyc(
    application_id,legal_name,national_id_ciphertext,tax_office,tax_number_ciphertext,iban_ciphertext,bank_account_holder,
    phone,contact_email,address,consent_version,consented_at,mersis_number_ciphertext,tax_exemption_number_ciphertext,
    food_registration_number_ciphertext,organic_certificate_number_ciphertext,contact_email_verified_at,phone_verified_at,phone_verified_by,updated_at
  ) values (
    application_id,normalized_legal_name,
    case when derived_applicant_type='individual' then private.encrypt_producer_kyc(normalized_identifier) end,
    case when derived_applicant_type='business' then btrim(p_tax_office) end,
    case when derived_applicant_type='business' then private.encrypt_producer_kyc(normalized_identifier) end,
    private.encrypt_producer_kyc(nullif(normalized_iban,'')),normalized_legal_name,normalized_phone,lower(btrim(p_contact_email)),
    p_address||jsonb_build_object('country_code',upper(p_address->>'country_code')),
    p_consent_version,timezone('utc',now()),private.encrypt_producer_kyc(nullif(normalized_mersis,'')),
    private.encrypt_producer_kyc(nullif(normalized_tax_exemption,'')),private.encrypt_producer_kyc(nullif(normalized_food_registration,'')),
    private.encrypt_producer_kyc(case when p_organic_claim_status='certified' then nullif(normalized_organic_number,'') else null end),
    account_email_confirmed_at,
    case when previous_phone=normalized_phone then previous_phone_verified_at else null end,
    case when previous_phone=normalized_phone then previous_phone_verified_by else null end,
    timezone('utc',now())
  ) on conflict(application_id) do update set
    legal_name=excluded.legal_name,national_id_ciphertext=excluded.national_id_ciphertext,tax_office=excluded.tax_office,
    tax_number_ciphertext=excluded.tax_number_ciphertext,iban_ciphertext=excluded.iban_ciphertext,bank_account_holder=excluded.bank_account_holder,
    phone=excluded.phone,contact_email=excluded.contact_email,address=excluded.address,consent_version=excluded.consent_version,
    consented_at=excluded.consented_at,mersis_number_ciphertext=excluded.mersis_number_ciphertext,
    tax_exemption_number_ciphertext=excluded.tax_exemption_number_ciphertext,food_registration_number_ciphertext=excluded.food_registration_number_ciphertext,
    organic_certificate_number_ciphertext=excluded.organic_certificate_number_ciphertext,contact_email_verified_at=excluded.contact_email_verified_at,
    phone_verified_at=excluded.phone_verified_at,phone_verified_by=excluded.phone_verified_by,updated_at=excluded.updated_at;

  return jsonb_build_object(
    'application_id',application_id,'status','draft','seller_classification',p_seller_classification,
    'activity_types',normalized_activities,'product_categories',normalized_categories,'sourcing_models',normalized_sources,
    'organic_claim_status',p_organic_claim_status,
    'production_location',jsonb_build_object('country_code',country_code,'province',province,'district',district,'village',village,
      'village_is_custom',coalesce(p_production_village_is_custom,false),'latitude',p_production_latitude,'longitude',p_production_longitude)
  );
end;
$$;

create or replace function private.submit_producer_application_v4(p_application_id uuid,p_documents jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid := auth.uid();
  application public.producer_applications%rowtype;
  document_item jsonb;
  document_type text;
  storage_path text;
  object_metadata jsonb;
  mime_type text;
  size_bytes bigint;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select a.* into application
  from public.producer_applications a
  where a.id=p_application_id and a.applicant_user_id=caller_id
  for update;
  if application.id is null then raise exception 'producer_application_not_found' using errcode='P0002'; end if;
  if application.status in ('submitted','under_review','approved') then
    return jsonb_build_object('application_id',p_application_id,'status',application.status);
  end if;
  if application.status not in ('draft','needs_information') then raise exception 'producer_application_not_submittable' using errcode='55000'; end if;
  if not exists(select 1 from private.producer_application_kyc k where k.application_id=p_application_id) then raise exception 'producer_kyc_required' using errcode='22023'; end if;
  if cardinality(application.activity_types)=0 then raise exception 'producer_activity_required' using errcode='22023'; end if;
  if cardinality(application.product_categories)=0 then raise exception 'producer_category_scope_required' using errcode='22023'; end if;
  if cardinality(application.sourcing_models)=0 or not (application.sourcing_models <@ array['own_production','family_production','cooperative_production']::text[]) then
    raise exception 'producer_intermediary_source_not_allowed' using errcode='22023';
  end if;
  if not application.village_product_commitment then raise exception 'village_product_commitment_required' using errcode='22023'; end if;
  if not application.traceability_commitment then raise exception 'traceability_commitment_required' using errcode='22023'; end if;
  if not application.product_truth_commitment then raise exception 'product_truth_commitment_required' using errcode='22023'; end if;

  if p_documents is null or jsonb_typeof(p_documents)<>'array' or jsonb_array_length(p_documents)>6 then raise exception 'invalid_producer_documents' using errcode='22023'; end if;
  for document_item in select value from jsonb_array_elements(p_documents)
  loop
    document_type:=document_item->>'document_type';
    storage_path:=document_item->>'storage_path';
    if document_type not in ('identity','cks','organic_certificate','business_registration','tax_certificate','bank_proof','food_business_registration','food_business_approval','tax_exemption_certificate','mersis_record','cooperative_registration','residence_proof','other') then
      raise exception 'invalid_producer_document_type' using errcode='22023';
    end if;
    if storage_path is null or storage_path not like caller_id::text||'/'||p_application_id::text||'/%' then raise exception 'invalid_producer_document_path' using errcode='22023'; end if;
    select o.metadata into object_metadata from storage.objects o where o.bucket_id='producer-documents' and o.name=storage_path;
    if object_metadata is null then raise exception 'producer_document_not_uploaded' using errcode='P0002'; end if;
    mime_type:=coalesce(object_metadata->>'mimetype','application/octet-stream');
    size_bytes:=case when coalesce(object_metadata->>'size','')~'^[0-9]+$' then (object_metadata->>'size')::bigint else 0 end;
    if mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') or size_bytes<=0 or size_bytes>20971520 then
      raise exception 'invalid_producer_document_metadata' using errcode='22023';
    end if;
    insert into private.producer_documents(application_id,document_type,storage_path,mime_type,size_bytes,checksum_sha256)
    values(p_application_id,document_type,storage_path,mime_type,size_bytes,null)
    on conflict(application_id,document_type,storage_path) do update set mime_type=excluded.mime_type,size_bytes=excluded.size_bytes;
  end loop;

  if application.applicant_type='individual' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='identity' and d.verification_status<>'rejected') then
    raise exception 'identity_document_required' using errcode='22023';
  end if;
  if application.applicant_type='business' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type in ('tax_certificate','business_registration') and d.verification_status<>'rejected') then
    raise exception 'business_document_required' using errcode='22023';
  end if;
  if application.seller_classification='tax_exempt_artisan' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='tax_exemption_certificate' and d.verification_status<>'rejected') then
    raise exception 'tax_exemption_document_required' using errcode='22023';
  end if;
  if application.food_compliance_status='registered' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='food_business_registration' and d.verification_status<>'rejected') then
    raise exception 'food_registration_document_required' using errcode='22023';
  end if;
  if application.food_compliance_status='approved_facility' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='food_business_approval' and d.verification_status<>'rejected') then
    raise exception 'food_approval_document_required' using errcode='22023';
  end if;
  if application.food_compliance_status='primary_production_review' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='cks' and d.verification_status<>'rejected') then
    raise exception 'primary_producer_document_required' using errcode='22023';
  end if;
  if application.organic_claim_status='certified' and not exists(
    select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='organic_certificate' and d.verification_status<>'rejected') then
    raise exception 'organic_certificate_document_required' using errcode='22023';
  end if;

  update public.producer_applications a set status='submitted',submitted_at=timezone('utc',now()),reviewed_at=null,reviewed_by=null,rejection_reason=null,updated_at=timezone('utc',now()) where a.id=p_application_id;

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  select r.user_id,'producer','Yeni üretici başvurusu','Yeni bir üretici başvurusu inceleme bekliyor.',
         '/?tab=admin&adminView=vendor-applications',jsonb_build_object('application_id',p_application_id)
  from private.user_roles r
  where r.role in ('admin','super_admin') and (r.expires_at is null or r.expires_at>timezone('utc',now()))
  on conflict do nothing;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('producer_application',p_application_id,'producer_application.submitted',jsonb_build_object('application_id',p_application_id,'applicant_user_id',caller_id));

  return jsonb_build_object('application_id',p_application_id,'status','submitted');
end;
$$;

drop function if exists public.save_producer_application_draft_legacy_v1(uuid,text,text,text,text,text,text[],text,text,text,text,text,text,jsonb,text);
drop function if exists public.save_producer_application_draft(uuid,text,text,text,text,text,text[],text,text,text,text,text,text,jsonb,text);
drop function if exists public.save_producer_application_draft_v2(uuid,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,jsonb,text,text,text[],integer,boolean,text);
drop function if exists private.save_producer_application_draft_v3(uuid,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,jsonb,text,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text);
drop function if exists private.save_producer_application_draft_v4(uuid,text,text,text,text,text,text,text,text,boolean,numeric,numeric,text[],text,text,text,text,text,text,text,text,jsonb,text,text,text[],integer,boolean,jsonb,text[],text,text,text,date,boolean,boolean,boolean,text,text);

drop function if exists public.submit_producer_application(uuid,jsonb);
drop function if exists public.submit_producer_application_v2(uuid,jsonb);
drop function if exists private.submit_producer_application_v3(uuid,jsonb);
