alter table public.producers
  add column if not exists storefront_status text not null default 'draft',
  add column if not exists storefront_published_at timestamptz,
  add column if not exists storefront_published_by uuid,
  add column if not exists storefront_contact_email text,
  add column if not exists storefront_contact_phone text,
  add column if not exists storefront_website_url text,
  add column if not exists storefront_address_line1 text,
  add column if not exists storefront_address_line2 text,
  add column if not exists storefront_postal_code text,
  add column if not exists storefront_city text,
  add column if not exists storefront_region text,
  add column if not exists storefront_country_code text,
  add column if not exists storefront_address_visibility text not null default 'city_region',
  add column if not exists storefront_business_name text,
  add column if not exists storefront_business_identity_type text,
  add column if not exists storefront_business_reference text,
  add column if not exists storefront_business_verified_at timestamptz,
  add column if not exists storefront_setup_version smallint not null default 1;

do $$ begin
  alter table public.producers add constraint producers_storefront_status_check check (storefront_status in ('draft','published'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.producers add constraint producers_storefront_address_visibility_check check (storefront_address_visibility in ('hidden','city_region','full'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.producers add constraint producers_storefront_country_code_check check (storefront_country_code is null or storefront_country_code ~ '^[A-Z]{2}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.producers add constraint producers_storefront_setup_version_check check (storefront_setup_version between 1 and 100);
exception when duplicate_object then null; end $$;

create index if not exists producers_public_storefront_idx on public.producers(storefront_status,store_kind,status,is_verified) where deleted_at is null;
create index if not exists producers_storefront_published_at_idx on public.producers(storefront_published_at desc) where storefront_status='published' and deleted_at is null;

create or replace function private.storefront_editor_authorized_v1(p_producer_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1 from public.producers p
    where p.id=p_producer_id and p.deleted_at is null
      and ((p.store_kind<>'official' and p.owner_user_id=(select auth.uid())) or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false)))
  );
$$;
revoke all on function private.storefront_editor_authorized_v1(uuid) from public,anon,authenticated;
grant execute on function private.storefront_editor_authorized_v1(uuid) to service_role;

create or replace function private.storefront_business_options_v1(p_producer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  p public.producers%rowtype; application public.producer_applications%rowtype; kyc private.producer_application_kyc%rowtype;
  settings public.brand_settings%rowtype; identity jsonb:='{}'::jsonb; options jsonb:='[]'::jsonb; value text; legal_name text;
begin
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then return '[]'::jsonb; end if;
  if p.store_kind='official' then
    select * into settings from public.brand_settings where slug='golden-oremar';
    identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
    if lower(btrim(coalesce(identity->>'verificationStatus',''))) <> 'verified' then return '[]'::jsonb; end if;
    legal_name:=nullif(btrim(coalesce(identity->>'registeredLegalName',settings.legal_name,'')),'');
    value:=nullif(btrim(coalesce(identity->>'mersisNumber','')),'');
    if value is not null then options:=options||jsonb_build_array(jsonb_build_object('type','mersis','label','MERSİS numarası','reference',value,'legalName',legal_name,'publicName',legal_name,'verified',true)); end if;
    value:=nullif(btrim(coalesce(identity->>'tradeRegistryNumber','')),'');
    if value is not null then options:=options||jsonb_build_array(jsonb_build_object('type','trade_registry','label','Ticaret sicil numarası','reference',value,'legalName',legal_name,'publicName',legal_name,'verified',true)); end if;
    if jsonb_array_length(options)=0 then options:=jsonb_build_array(jsonb_build_object('type','platform_registered','label','Doğrulanmış işletme','reference',null,'legalName',legal_name,'publicName',legal_name,'verified',true)); end if;
    return options;
  end if;
  if p.application_id is null then return '[]'::jsonb; end if;
  select * into application from public.producer_applications where id=p.application_id and status='approved';
  select * into kyc from private.producer_application_kyc where application_id=p.application_id;
  if application.id is null or kyc.application_id is null then return '[]'::jsonb; end if;
  legal_name:=nullif(btrim(coalesce(kyc.legal_name,'')),'');
  if kyc.mersis_number_ciphertext is not null then
    value:=nullif(btrim(private.decrypt_producer_kyc(kyc.mersis_number_ciphertext)),'');
    if value is not null then options:=options||jsonb_build_array(jsonb_build_object('type','mersis','label','MERSİS numarası','reference',value,'legalName',legal_name,'publicName',legal_name,'verified',true)); end if;
  end if;
  if kyc.food_registration_number_ciphertext is not null and exists(select 1 from private.producer_documents d where d.application_id=p.application_id and d.document_type in ('food_business_registration','food_business_approval') and d.verification_status='verified') then
    value:=nullif(btrim(private.decrypt_producer_kyc(kyc.food_registration_number_ciphertext)),'');
    if value is not null then options:=options||jsonb_build_array(jsonb_build_object('type','food_registration','label','Gıda işletmesi kayıt/onay numarası','reference',value,'legalName',legal_name,'publicName',coalesce(legal_name,p.display_name),'verified',true)); end if;
  end if;
  if kyc.tax_exemption_number_ciphertext is not null and exists(select 1 from private.producer_documents d where d.application_id=p.application_id and d.document_type='tax_exemption_certificate' and d.verification_status='verified') then
    value:=nullif(btrim(private.decrypt_producer_kyc(kyc.tax_exemption_number_ciphertext)),'');
    if value is not null then options:=options||jsonb_build_array(jsonb_build_object('type','tax_exemption','label','Esnaf vergi muafiyeti belgesi','reference',value,'legalName',legal_name,'publicName',p.display_name,'verified',true)); end if;
  end if;
  if jsonb_array_length(options)=0 then
    if application.applicant_type='individual' then options:=jsonb_build_array(jsonb_build_object('type','verified_individual','label','Kimliği doğrulanmış bireysel üretici','reference',null,'legalName',legal_name,'publicName',p.display_name,'verified',true));
    else options:=jsonb_build_array(jsonb_build_object('type','verified_business','label','Belgesi doğrulanmış işletme','reference',null,'legalName',legal_name,'publicName',coalesce(legal_name,p.display_name),'verified',true)); end if;
  end if;
  return options;
end;
$$;
revoke all on function private.storefront_business_options_v1(uuid) from public,anon,authenticated;
grant execute on function private.storefront_business_options_v1(uuid) to service_role;

create or replace function private.storefront_business_selection_v1(p_producer_id uuid,p_type text)
returns jsonb language sql stable security definer set search_path=''
as $$
  select item from jsonb_array_elements(private.storefront_business_options_v1(p_producer_id)) item
  where item->>'type'=lower(btrim(coalesce(p_type,''))) and coalesce((item->>'verified')::boolean,false)=true limit 1;
$$;
revoke all on function private.storefront_business_selection_v1(uuid,text) from public,anon,authenticated;
grant execute on function private.storefront_business_selection_v1(uuid,text) to service_role;

create or replace function private.storefront_brand_asset_ready_v1(p_producer_id uuid,p_kind text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare p public.producers%rowtype; kind text:=lower(btrim(coalesce(p_kind,''))); path text;
begin
  if kind not in ('logo','cover') then return false; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then return false; end if;
  path:=case when kind='logo' then p.logo_path else p.cover_path end;
  if private.store_branding_verified_path_v1(p.id,kind,path) is not null then return true; end if;
  if p.store_kind='official' and private.verified_public_storage_path_v1('catalog-public',path) is not null then return true; end if;
  return false;
end;
$$;
revoke all on function private.storefront_brand_asset_ready_v1(uuid,text) from public,anon,authenticated;
grant execute on function private.storefront_brand_asset_ready_v1(uuid,text) to service_role;

create or replace function private.storefront_readiness_v1(p_producer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  p public.producers%rowtype; business jsonb; identity_ready boolean:=false; name_ready boolean:=false; about_ready boolean:=false;
  logo_ready boolean:=false; cover_ready boolean:=false; email_ready boolean:=false; phone_ready boolean:=false; address_ready boolean:=false; business_ready boolean:=false; ready boolean:=false; digits text;
begin
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then return jsonb_build_object('ready',false,'missing',jsonb_build_array('producer_not_found'),'steps','[]'::jsonb); end if;
  identity_ready:=p.status='active' and p.is_verified=true;
  name_ready:=char_length(btrim(coalesce(p.display_name,''))) between 2 and 120;
  about_ready:=char_length(btrim(coalesce(p.description,''))) between 40 and 1200;
  logo_ready:=private.storefront_brand_asset_ready_v1(p.id,'logo'); cover_ready:=private.storefront_brand_asset_ready_v1(p.id,'cover');
  email_ready:=char_length(btrim(coalesce(p.storefront_contact_email,''))) between 5 and 254 and btrim(p.storefront_contact_email) ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
  digits:=regexp_replace(coalesce(p.storefront_contact_phone,''),'[^0-9]','','g'); phone_ready:=char_length(digits) between 7 and 15;
  address_ready:=coalesce(p.storefront_country_code,'')~'^[A-Z]{2}$' and char_length(btrim(coalesce(p.storefront_city,''))) between 2 and 120 and char_length(btrim(coalesce(p.storefront_region,''))) between 2 and 120 and (p.storefront_address_visibility<>'full' or char_length(btrim(coalesce(p.storefront_address_line1,''))) between 5 and 240);
  business:=private.storefront_business_selection_v1(p.id,p.storefront_business_identity_type);
  business_ready:=business is not null and coalesce(p.storefront_business_name,'')=coalesce(business->>'publicName','') and coalesce(p.storefront_business_reference,'')=coalesce(business->>'reference','') and p.storefront_business_verified_at is not null;
  ready:=identity_ready and name_ready and about_ready and logo_ready and cover_ready and email_ready and phone_ready and address_ready and business_ready;
  return jsonb_build_object('ready',ready,'steps',jsonb_build_array(
    jsonb_build_object('code','identity','label','Satıcı doğrulaması','ready',identity_ready),jsonb_build_object('code','store_identity','label','Mağaza adı ve hakkında','ready',name_ready and about_ready),jsonb_build_object('code','logo','label','Profil / logo','ready',logo_ready),jsonb_build_object('code','cover','label','Kapak görseli','ready',cover_ready),jsonb_build_object('code','contact','label','İletişim bilgileri','ready',email_ready and phone_ready),jsonb_build_object('code','address','label','Adres ve konum','ready',address_ready),jsonb_build_object('code','business','label','İşletme doğrulaması','ready',business_ready)
  ),'missing',coalesce((select jsonb_agg(code order by ord) from (values (10,'producer_verification',not identity_ready),(20,'store_name',not name_ready),(30,'about',not about_ready),(40,'logo',not logo_ready),(50,'cover',not cover_ready),(60,'contact_email',not email_ready),(70,'contact_phone',not phone_ready),(80,'address',not address_ready),(90,'business_identity',not business_ready)) m(ord,code,missing) where missing),'[]'::jsonb));
end;
$$;
revoke all on function private.storefront_readiness_v1(uuid) from public,anon,authenticated;
grant execute on function private.storefront_readiness_v1(uuid) to service_role;

create or replace function private.get_storefront_setup_editor_v1(p_producer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  p public.producers%rowtype; kyc private.producer_application_kyc%rowtype; settings public.brand_settings%rowtype; identity jsonb:='{}'::jsonb; options jsonb:='[]'::jsonb;
  fallback_email text; fallback_phone text; fallback_line1 text; fallback_line2 text; fallback_postal text; fallback_city text; fallback_region text; fallback_country text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not private.storefront_editor_authorized_v1(p.id) then raise exception 'storefront_editor_access_required' using errcode='42501'; end if;
  if p.store_kind='official' then
    select * into settings from public.brand_settings where slug='golden-oremar'; identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
    fallback_email:=settings.support_email; fallback_phone:=settings.support_phone; fallback_line1:=identity->>'registeredAddress'; fallback_city:=p.production_district; fallback_region:=p.production_province; fallback_country:=coalesce(nullif(upper(identity->>'countryCode'),''),p.production_country_code);
  elsif p.application_id is not null then
    select * into kyc from private.producer_application_kyc where application_id=p.application_id;
    fallback_email:=kyc.contact_email; fallback_phone:=kyc.phone;
    fallback_line1:=coalesce(nullif(kyc.address->>'line1',''),nullif(kyc.address->>'addressLine1',''),nullif(kyc.address->>'street',''),nullif(kyc.address->>'fullAddress',''));
    fallback_line2:=coalesce(nullif(kyc.address->>'line2',''),nullif(kyc.address->>'addressLine2','')); fallback_postal:=coalesce(nullif(kyc.address->>'postalCode',''),nullif(kyc.address->>'postal_code',''));
    fallback_city:=coalesce(nullif(kyc.address->>'city',''),nullif(kyc.address->>'district',''),p.production_district); fallback_region:=coalesce(nullif(kyc.address->>'region',''),nullif(kyc.address->>'province',''),p.production_province); fallback_country:=upper(coalesce(nullif(kyc.address->>'countryCode',''),nullif(kyc.address->>'country_code',''),p.production_country_code));
  end if;
  options:=private.storefront_business_options_v1(p.id);
  return jsonb_build_object('producerId',p.id,'storeKind',p.store_kind,'storefrontStatus',p.storefront_status,'publishedAt',p.storefront_published_at,'displayName',p.display_name,'description',p.description,'story',p.story,'headline',p.storefront_headline,'subheadline',p.storefront_subheadline,'logoPath',p.logo_path,'coverPath',p.cover_path,
    'contact',jsonb_build_object('email',coalesce(nullif(p.storefront_contact_email,''),fallback_email),'phone',coalesce(nullif(p.storefront_contact_phone,''),fallback_phone),'websiteUrl',p.storefront_website_url),
    'address',jsonb_build_object('line1',coalesce(nullif(p.storefront_address_line1,''),fallback_line1),'line2',coalesce(nullif(p.storefront_address_line2,''),fallback_line2),'postalCode',coalesce(nullif(p.storefront_postal_code,''),fallback_postal),'city',coalesce(nullif(p.storefront_city,''),fallback_city),'region',coalesce(nullif(p.storefront_region,''),fallback_region),'countryCode',coalesce(nullif(p.storefront_country_code,''),fallback_country),'visibility',p.storefront_address_visibility),
    'businessIdentity',jsonb_build_object('type',p.storefront_business_identity_type,'name',p.storefront_business_name,'reference',p.storefront_business_reference,'verifiedAt',p.storefront_business_verified_at),'businessOptions',options,'readiness',private.storefront_readiness_v1(p.id),
    'operations',jsonb_build_object('productsEnabled',p.storefront_status='published','ordersEnabled',p.storefront_status='published','returnsEnabled',p.storefront_status='published','paymentsEnabled',p.storefront_status='published'));
end;
$$;
revoke all on function private.get_storefront_setup_editor_v1(uuid) from public,anon;
grant execute on function private.get_storefront_setup_editor_v1(uuid) to authenticated,service_role;
create or replace function public.get_storefront_setup_editor_v1(p_producer_id uuid) returns jsonb language sql stable set search_path='' as $$ select private.get_storefront_setup_editor_v1(p_producer_id); $$;
revoke all on function public.get_storefront_setup_editor_v1(uuid) from public,anon; grant execute on function public.get_storefront_setup_editor_v1(uuid) to authenticated;

create or replace function private.save_storefront_setup_v1(p_producer_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  p public.producers%rowtype; old_status text; unexpected text; display_name text; description text; story text; headline text; subheadline text; email text; phone text; website text;
  line1 text; line2 text; postal text; city text; region text; country text; visibility text; business_type text; business jsonb; options jsonb; readiness jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_storefront_payload' using errcode='22023'; end if;
  select key into unexpected from jsonb_object_keys(p_payload) key where key not in ('displayName','description','story','headline','subheadline','contact','address','businessIdentityType') limit 1;
  if unexpected is not null then raise exception 'storefront_field_not_allowed:%',unexpected using errcode='22023'; end if;
  if p_payload ? 'contact' and jsonb_typeof(p_payload->'contact')<>'object' then raise exception 'invalid_storefront_contact' using errcode='22023'; end if;
  if p_payload ? 'address' and jsonb_typeof(p_payload->'address')<>'object' then raise exception 'invalid_storefront_address' using errcode='22023'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null for update;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not private.storefront_editor_authorized_v1(p.id) then raise exception 'storefront_editor_access_required' using errcode='42501'; end if;
  old_status:=p.storefront_status;
  display_name:=btrim(coalesce(p_payload->>'displayName','')); description:=btrim(coalesce(p_payload->>'description','')); story:=btrim(coalesce(p_payload->>'story','')); headline:=nullif(btrim(coalesce(p_payload->>'headline','')),''); subheadline:=nullif(btrim(coalesce(p_payload->>'subheadline','')),'');
  email:=lower(nullif(btrim(coalesce(p_payload->'contact'->>'email','')),'')); phone:=nullif(btrim(coalesce(p_payload->'contact'->>'phone','')),''); website:=nullif(btrim(coalesce(p_payload->'contact'->>'websiteUrl','')),'');
  line1:=nullif(btrim(coalesce(p_payload->'address'->>'line1','')),''); line2:=nullif(btrim(coalesce(p_payload->'address'->>'line2','')),''); postal:=nullif(btrim(coalesce(p_payload->'address'->>'postalCode','')),''); city:=nullif(btrim(coalesce(p_payload->'address'->>'city','')),''); region:=nullif(btrim(coalesce(p_payload->'address'->>'region','')),''); country:=upper(nullif(btrim(coalesce(p_payload->'address'->>'countryCode','')),'')); visibility:=lower(coalesce(nullif(btrim(p_payload->'address'->>'visibility'),''),'city_region')); business_type:=lower(nullif(btrim(coalesce(p_payload->>'businessIdentityType','')),''));
  if char_length(display_name) not between 2 and 120 then raise exception 'invalid_storefront_display_name' using errcode='22023'; end if;
  if char_length(description)>1200 or char_length(story)>5000 then raise exception 'storefront_about_too_long' using errcode='22023'; end if;
  if headline is not null and char_length(headline)>140 then raise exception 'storefront_headline_too_long' using errcode='22023'; end if;
  if subheadline is not null and char_length(subheadline)>280 then raise exception 'storefront_subheadline_too_long' using errcode='22023'; end if;
  if email is not null and (char_length(email)>254 or email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'invalid_storefront_email' using errcode='22023'; end if;
  if phone is not null and (char_length(phone)>32 or char_length(regexp_replace(phone,'[^0-9]','','g')) not between 7 and 15) then raise exception 'invalid_storefront_phone' using errcode='22023'; end if;
  if website is not null and (char_length(website)>300 or website !~* '^https://[^[:space:]]+$') then raise exception 'invalid_storefront_website' using errcode='22023'; end if;
  if line1 is not null and char_length(line1)>240 or line2 is not null and char_length(line2)>240 or postal is not null and char_length(postal)>24 or city is not null and char_length(city)>120 or region is not null and char_length(region)>120 then raise exception 'storefront_address_too_long' using errcode='22023'; end if;
  if country is not null and country !~ '^[A-Z]{2}$' then raise exception 'invalid_storefront_country_code' using errcode='22023'; end if;
  if visibility not in ('hidden','city_region','full') then raise exception 'invalid_storefront_address_visibility' using errcode='22023'; end if;
  options:=private.storefront_business_options_v1(p.id); if business_type is null and jsonb_array_length(options)>0 then business_type:=options->0->>'type'; end if; business:=private.storefront_business_selection_v1(p.id,business_type);
  update public.producers set display_name=display_name,description=description,story=story,storefront_headline=headline,storefront_subheadline=subheadline,storefront_contact_email=email,storefront_contact_phone=phone,storefront_website_url=website,
    storefront_address_line1=line1,storefront_address_line2=line2,storefront_postal_code=postal,storefront_city=city,storefront_region=region,storefront_country_code=country,storefront_address_visibility=visibility,
    storefront_business_identity_type=case when business is null then null else business->>'type' end,storefront_business_name=case when business is null then null else business->>'publicName' end,storefront_business_reference=case when business is null then null else nullif(business->>'reference','') end,
    storefront_business_verified_at=case when business is null then null else coalesce(storefront_business_verified_at,timezone('utc',now())) end,storefront_setup_version=1,updated_at=timezone('utc',now()) where id=p.id;
  readiness:=private.storefront_readiness_v1(p.id); if old_status='published' and coalesce((readiness->>'ready')::boolean,false)=false then raise exception 'published_storefront_must_remain_ready' using errcode='55000'; end if;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('storefront',p.id,'storefront.updated',jsonb_build_object('producerId',p.id,'actorUserId',auth.uid(),'storefrontStatus',old_status,'ready',coalesce((readiness->>'ready')::boolean,false)));
  return private.get_storefront_setup_editor_v1(p.id);
end;
$$;
revoke all on function private.save_storefront_setup_v1(uuid,jsonb) from public,anon; grant execute on function private.save_storefront_setup_v1(uuid,jsonb) to authenticated,service_role;
create or replace function public.save_storefront_setup_v1(p_producer_id uuid,p_payload jsonb) returns jsonb language sql set search_path='' as $$ select private.save_storefront_setup_v1(p_producer_id,p_payload); $$;
revoke all on function public.save_storefront_setup_v1(uuid,jsonb) from public,anon; grant execute on function public.save_storefront_setup_v1(uuid,jsonb) to authenticated;

create or replace function private.publish_storefront_v1(p_producer_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.producers%rowtype; readiness jsonb; caller_id uuid:=auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null for update;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not private.storefront_editor_authorized_v1(p.id) then raise exception 'storefront_publish_access_required' using errcode='42501'; end if;
  if p.status<>'active' or p.is_verified<>true then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  readiness:=private.storefront_readiness_v1(p.id); if coalesce((readiness->>'ready')::boolean,false)=false then raise exception 'storefront_not_ready:%',coalesce((readiness->'missing')::text,'[]') using errcode='55000'; end if;
  update public.producers set storefront_status='published',storefront_published_at=timezone('utc',now()),storefront_published_by=caller_id,updated_at=timezone('utc',now()) where id=p.id;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('storefront',p.id,'storefront.published',jsonb_build_object('producerId',p.id,'actorUserId',caller_id,'storeKind',p.store_kind));
  return private.get_storefront_setup_editor_v1(p.id);
end;
$$;
revoke all on function private.publish_storefront_v1(uuid) from public,anon; grant execute on function private.publish_storefront_v1(uuid) to authenticated,service_role;
create or replace function public.publish_storefront_v1(p_producer_id uuid) returns jsonb language sql set search_path='' as $$ select private.publish_storefront_v1(p_producer_id); $$;
revoke all on function public.publish_storefront_v1(uuid) from public,anon; grant execute on function public.publish_storefront_v1(uuid) to authenticated;

update public.producers p set storefront_status='published',storefront_published_at=coalesce(p.storefront_published_at,timezone('utc',now())),storefront_contact_email=coalesce(p.storefront_contact_email,b.support_email),storefront_contact_phone=coalesce(p.storefront_contact_phone,b.support_phone),
  storefront_address_line1=coalesce(p.storefront_address_line1,nullif(b.public_config->'businessIdentity'->>'registeredAddress','')),storefront_city=coalesce(p.storefront_city,p.production_district),storefront_region=coalesce(p.storefront_region,p.production_province),storefront_country_code=coalesce(p.storefront_country_code,nullif(upper(b.public_config->'businessIdentity'->>'countryCode'),''),p.production_country_code),storefront_address_visibility='full',
  storefront_business_identity_type=case when nullif(b.public_config->'businessIdentity'->>'mersisNumber','') is not null then 'mersis' when nullif(b.public_config->'businessIdentity'->>'tradeRegistryNumber','') is not null then 'trade_registry' else 'platform_registered' end,
  storefront_business_name=coalesce(nullif(b.public_config->'businessIdentity'->>'registeredLegalName',''),b.legal_name,p.display_name),storefront_business_reference=coalesce(nullif(b.public_config->'businessIdentity'->>'mersisNumber',''),nullif(b.public_config->'businessIdentity'->>'tradeRegistryNumber','')),
  storefront_business_verified_at=case when lower(coalesce(b.public_config->'businessIdentity'->>'verificationStatus',''))='verified' then coalesce(p.storefront_business_verified_at,timezone('utc',now())) else p.storefront_business_verified_at end,storefront_setup_version=1,updated_at=timezone('utc',now())
from public.brand_settings b where p.store_kind='official' and p.slug='golden-oremar' and p.deleted_at is null and b.slug='golden-oremar';