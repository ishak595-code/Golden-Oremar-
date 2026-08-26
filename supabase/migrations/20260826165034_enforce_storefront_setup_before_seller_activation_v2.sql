create or replace function private.store_branding_can_edit_v1(p_producer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.producers p
    where p.id=p_producer_id
      and p.deleted_at is null
      and p.is_verified=true
      and (
        (p.store_kind<>'official' and p.owner_user_id=(select auth.uid()) and p.status in ('pending','active'))
        or (p.store_kind='official' and p.status='active' and coalesce(private.has_permission('product.publish'),false))
      )
  );
$$;
revoke all on function private.store_branding_can_edit_v1(uuid) from public,anon,authenticated;
grant execute on function private.store_branding_can_edit_v1(uuid) to service_role;

create or replace function private.get_store_branding_editor_v1(p_producer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); p public.producers%rowtype; can_edit boolean:=false;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not (
    (p.store_kind<>'official' and p.owner_user_id=caller_id and p.status in ('pending','active','suspended'))
    or (p.store_kind='official' and coalesce(private.has_permission('product.publish'),false))
  ) then raise exception 'store_branding_access_required' using errcode='42501'; end if;
  can_edit:=private.store_branding_can_edit_v1(p.id);
  return jsonb_build_object(
    'producerId',p.id,'displayName',p.display_name,'storeKind',p.store_kind,'status',p.status,'verified',p.is_verified,
    'logoPath',p.logo_path,'coverPath',p.cover_path,'canEdit',can_edit,
    'logoBinaryVerified',private.catalog_media_binary_verified_path_v2(p.logo_path) is not null,
    'coverBinaryVerified',private.catalog_media_binary_verified_path_v2(p.cover_path) is not null
  );
end;
$$;

alter policy storage_catalog_brand_insert_owner_or_official_v1 on storage.objects
with check (
  bucket_id='catalog-public'
  and (storage.foldername(name))[2]='profile'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/profile/(logo|cover)-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
  and exists(
    select 1 from public.producers p
    where p.id::text=(storage.foldername(name))[1]
      and p.deleted_at is null
      and p.is_verified=true
      and (
        (p.store_kind<>'official' and p.owner_user_id=(select auth.uid()) and p.status in ('pending','active'))
        or (p.store_kind='official' and p.status='active' and coalesce(private.has_permission('product.publish'),false))
      )
  )
);

create or replace function private.storefront_readiness_v1(p_producer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  p public.producers%rowtype; business jsonb; identity_ready boolean:=false; name_ready boolean:=false; about_ready boolean:=false;
  logo_ready boolean:=false; cover_ready boolean:=false; email_ready boolean:=false; phone_ready boolean:=false;
  address_ready boolean:=false; business_ready boolean:=false; ready boolean:=false; digits text;
begin
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then return jsonb_build_object('ready',false,'missing',jsonb_build_array('producer_not_found'),'steps','[]'::jsonb); end if;
  identity_ready:=p.status in ('pending','active') and p.is_verified=true;
  name_ready:=char_length(btrim(coalesce(p.display_name,''))) between 2 and 120;
  about_ready:=char_length(btrim(coalesce(p.description,''))) between 40 and 1200;
  logo_ready:=private.storefront_brand_asset_ready_v1(p.id,'logo');
  cover_ready:=private.storefront_brand_asset_ready_v1(p.id,'cover');
  email_ready:=char_length(btrim(coalesce(p.storefront_contact_email,''))) between 5 and 254 and btrim(p.storefront_contact_email) ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
  digits:=regexp_replace(coalesce(p.storefront_contact_phone,''),'[^0-9]','','g');
  phone_ready:=char_length(digits) between 7 and 15;
  address_ready:=coalesce(p.storefront_country_code,'')~'^[A-Z]{2}$' and char_length(btrim(coalesce(p.storefront_city,''))) between 2 and 120 and char_length(btrim(coalesce(p.storefront_region,''))) between 2 and 120 and (p.storefront_address_visibility<>'full' or char_length(btrim(coalesce(p.storefront_address_line1,''))) between 5 and 240);
  business:=private.storefront_business_selection_v1(p.id,p.storefront_business_identity_type);
  business_ready:=business is not null and coalesce(p.storefront_business_name,'')=coalesce(business->>'publicName','') and coalesce(p.storefront_business_reference,'')=coalesce(business->>'reference','') and p.storefront_business_verified_at is not null;
  ready:=identity_ready and name_ready and about_ready and logo_ready and cover_ready and email_ready and phone_ready and address_ready and business_ready;
  return jsonb_build_object(
    'ready',ready,
    'steps',jsonb_build_array(
      jsonb_build_object('code','identity','label','Satıcı doğrulaması','ready',identity_ready),
      jsonb_build_object('code','store_identity','label','Mağaza adı ve hakkında','ready',name_ready and about_ready),
      jsonb_build_object('code','logo','label','Profil / logo','ready',logo_ready),
      jsonb_build_object('code','cover','label','Kapak görseli','ready',cover_ready),
      jsonb_build_object('code','contact','label','İletişim bilgileri','ready',email_ready and phone_ready),
      jsonb_build_object('code','address','label','Adres ve konum','ready',address_ready),
      jsonb_build_object('code','business','label','İşletme doğrulaması','ready',business_ready)
    ),
    'missing',coalesce((select jsonb_agg(code order by ord) from (values
      (10,'producer_verification',not identity_ready),(20,'store_name',not name_ready),(30,'about',not about_ready),(40,'logo',not logo_ready),(50,'cover',not cover_ready),(60,'contact_email',not email_ready),(70,'contact_phone',not phone_ready),(80,'address',not address_ready),(90,'business_identity',not business_ready)
    ) m(ord,code,missing) where missing),'[]'::jsonb)
  );
end;
$$;
revoke all on function private.storefront_readiness_v1(uuid) from public,anon,authenticated;
grant execute on function private.storefront_readiness_v1(uuid) to service_role;

create or replace function private.publish_storefront_v1(p_producer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare p public.producers%rowtype; readiness jsonb; caller_id uuid:=auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.producers where id=p_producer_id and deleted_at is null for update;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if not private.storefront_editor_authorized_v1(p.id) then raise exception 'storefront_publish_access_required' using errcode='42501'; end if;
  if p.status not in ('pending','active') or p.is_verified<>true then raise exception 'verified_producer_required' using errcode='42501'; end if;
  readiness:=private.storefront_readiness_v1(p.id);
  if coalesce((readiness->>'ready')::boolean,false)=false then raise exception 'storefront_not_ready:%',coalesce((readiness->'missing')::text,'[]') using errcode='55000'; end if;
  update public.producers set status='active',storefront_status='published',storefront_published_at=timezone('utc',now()),storefront_published_by=caller_id,updated_at=timezone('utc',now()) where id=p.id;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('storefront',p.id,'storefront.published',jsonb_build_object('producerId',p.id,'actorUserId',caller_id,'storeKind',p.store_kind));
  return private.get_storefront_setup_editor_v1(p.id);
end;
$$;

create or replace function private.admin_review_producer_application_v3(p_application_id uuid,p_status text,p_reason text,p_commission_basis_points integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); application public.producer_applications%rowtype; result jsonb; producer_id uuid; product_item jsonb; review_due timestamptz;
begin
  if caller_id is null or not coalesce(private.has_permission('seller.review'),false) then raise exception 'permission_required:seller.review' using errcode='42501'; end if;
  if p_status='approved' and not private.has_permission('seller.approve') then raise exception 'permission_required:seller.approve' using errcode='42501'; elsif p_status='rejected' and not private.has_permission('seller.reject') then raise exception 'permission_required:seller.reject' using errcode='42501'; elsif p_status='needs_information' and not private.has_permission('seller.request_information') then raise exception 'permission_required:seller.request_information' using errcode='42501'; end if;
  select * into application from public.producer_applications where id=p_application_id;
  if application.id is null then raise exception 'producer_application_not_found' using errcode='P0002'; end if;
  if p_status='approved' then
    if cardinality(application.activity_types)=0 then raise exception 'producer_activity_required' using errcode='55000'; end if;
    if cardinality(application.product_categories)=0 then raise exception 'producer_category_scope_required' using errcode='55000'; end if;
    if cardinality(application.sourcing_models)=0 or not (application.sourcing_models <@ array['own_production','family_production','cooperative_production']::text[]) then raise exception 'producer_intermediary_source_not_allowed' using errcode='55000'; end if;
    if exists(select 1 from unnest(application.product_categories) slug where not exists(select 1 from public.categories c where c.slug=slug and c.is_active=true)) then raise exception 'invalid_producer_category_scope' using errcode='55000'; end if;
    for product_item in select value from jsonb_array_elements(application.planned_products) loop
      if not (coalesce(product_item->>'category','')=any(application.product_categories)) then raise exception 'planned_product_outside_category_scope' using errcode='55000'; end if;
    end loop;
  end if;
  if p_status='approved' and application.organic_claim_status='certified' then
    if application.organic_certificate_expires_on is null or application.organic_certificate_expires_on<current_date then raise exception 'organic_certificate_expired' using errcode='55000'; end if;
    if not exists(select 1 from private.producer_documents d where d.application_id=p_application_id and d.document_type='organic_certificate' and d.verification_status='verified') then raise exception 'organic_certificate_document_not_verified' using errcode='55000'; end if;
  end if;
  result:=public.admin_review_producer_application_v2(p_application_id,p_status,p_reason,p_commission_basis_points);
  if p_status='approved' then
    producer_id:=(result->>'producer_id')::uuid;
    if producer_id is not null then
      update public.producers producer set
        status='pending',storefront_status='draft',storefront_published_at=null,storefront_published_by=null,
        production_country_code=application.production_country_code,production_province=application.production_province,
        production_district=application.production_district,production_village=application.production_village,production_village_is_custom=application.production_village_is_custom,
        production_latitude=application.production_latitude,production_longitude=application.production_longitude,origin_verified=true,origin_verified_at=timezone('utc',now()),
        origin_verification_basis='application_review',activity_types=application.activity_types,approved_category_slugs=application.product_categories,
        trust_badge_status='active',trust_badge_granted_at=timezone('utc',now()),trust_badge_review_due_at=coalesce(producer.verification_due_at,timezone('utc',now())+interval '365 days'),
        trust_badge_revoked_at=null,trust_badge_reason='KYC, üretim menşei, faaliyet alanı ve kategori kapsamı yönetim tarafından onaylandı.',updated_at=timezone('utc',now())
      where producer.id=producer_id returning trust_badge_review_due_at into review_due;
      insert into private.producer_trust_badge_events(producer_id,actor_user_id,action,reason,review_due_at)
      values(producer_id,caller_id,'granted','KYC, üretim menşei, faaliyet alanı ve kategori kapsamı yönetim tarafından onaylandı.',review_due);
      update public.notifications n set title='Satıcı başvurunuz onaylandı',message='Doğrulamanız tamamlandı. Mağaza adınızı, profil ve kapak görsellerinizi, iletişim, adres ve işletme bilgilerinizi tamamlayıp mağazanızı yayınladıktan sonra ürün ekleyebilirsiniz.',action_url='/?tab=account'
      where n.id=(select n2.id from public.notifications n2 where n2.user_id=application.applicant_user_id and n2.metadata->>'application_id'=application.id::text and n2.metadata->>'status'='approved' order by n2.created_at desc limit 1);
      insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
      values('storefront',producer_id,'storefront.setup_required',jsonb_build_object('producerId',producer_id,'applicationId',application.id,'ownerUserId',application.applicant_user_id));
    end if;
  end if;
  return result;
end;
$$;
