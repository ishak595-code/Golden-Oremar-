create or replace function private.runtime_dependency_integrity_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  missing_private_count integer:=0;
  missing_public_count integer:=0;
  super_admin_helper_present boolean:=false;
  admin_audit_ledger_present boolean:=false;
  readiness_wrapper_present boolean:=false;
begin
  super_admin_helper_present:=to_regprocedure('private.is_super_admin()') is not null;
  admin_audit_ledger_present:=to_regclass('private.admin_audit_logs') is not null;
  readiness_wrapper_present:=to_regprocedure('public.super_admin_get_production_readiness_snapshot_v1()') is not null;

  with src as (
    select n.nspname,p.proname,p.oid,p.prosrc
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','public')
  ), refs as (
    select src.oid as caller_oid,lower(m[1]) as referenced_name
    from src
    cross join lateral regexp_matches(src.prosrc,'private\.([a-zA-Z_][a-zA-Z0-9_]*)','g') m
  )
  select count(*)::integer into missing_private_count
  from (
    select distinct caller_oid,referenced_name
    from refs r
    where not exists (
      select 1 from pg_proc p2 join pg_namespace n2 on n2.oid=p2.pronamespace
      where n2.nspname='private' and lower(p2.proname)=r.referenced_name
    )
    and not exists (
      select 1 from pg_class c join pg_namespace n3 on n3.oid=c.relnamespace
      where n3.nspname='private' and lower(c.relname)=r.referenced_name
    )
    and not exists (
      select 1 from pg_type t join pg_namespace n4 on n4.oid=t.typnamespace
      where n4.nspname='private' and lower(t.typname)=r.referenced_name
    )
  ) missing;

  with src as (
    select n.nspname,p.proname,p.oid,p.prosrc
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','public')
  ), refs as (
    select src.oid as caller_oid,lower(m[1]) as referenced_name
    from src
    cross join lateral regexp_matches(src.prosrc,'public\.([a-zA-Z_][a-zA-Z0-9_]*)','g') m
  )
  select count(*)::integer into missing_public_count
  from (
    select distinct caller_oid,referenced_name
    from refs r
    where not exists (
      select 1 from pg_proc p2 join pg_namespace n2 on n2.oid=p2.pronamespace
      where n2.nspname='public' and lower(p2.proname)=r.referenced_name
    )
    and not exists (
      select 1 from pg_class c join pg_namespace n3 on n3.oid=c.relnamespace
      where n3.nspname='public' and lower(c.relname)=r.referenced_name
    )
    and not exists (
      select 1 from pg_type t join pg_namespace n4 on n4.oid=t.typnamespace
      where n4.nspname='public' and lower(t.typname)=r.referenced_name
    )
  ) missing;

  return jsonb_build_object(
    'superAdminHelperPresent',super_admin_helper_present,
    'adminAuditLedgerPresent',admin_audit_ledger_present,
    'readinessWrapperPresent',readiness_wrapper_present,
    'missingPrivateReferenceCount',missing_private_count,
    'missingPublicReferenceCount',missing_public_count,
    'ready',super_admin_helper_present
      and admin_audit_ledger_present
      and readiness_wrapper_present
      and missing_private_count=0
      and missing_public_count=0
  );
end;
$$;

revoke all on function private.runtime_dependency_integrity_v1() from public,anon,authenticated;
grant execute on function private.runtime_dependency_integrity_v1() to service_role;

create or replace function private.super_admin_get_production_readiness_snapshot_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  settings public.brand_settings%rowtype;
  catalog_objects integer:=0;
  content_objects integer:=0;
  event_objects integer:=0;
  published_products integer:=0;
  products_with_real_primary integer:=0;
  active_variants integer:=0;
  missing_weights integer:=0;
  active_producers integer:=0;
  ready_producer_accounts integer:=0;
  published_legal_slugs text[]:='{}'::text[];
  required_legal_slugs constant text[]:=array['about','returns','privacy','terms'];
  missing_legal_slugs text[];
  payment_cfg jsonb;
  legal_readiness jsonb;
  runtime_integrity jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then
    raise exception 'super_admin_required' using errcode='42501';
  end if;

  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;

  legal_readiness:=private.commercial_checkout_legal_readiness_v1();
  runtime_integrity:=private.runtime_dependency_integrity_v1();

  select count(*) into catalog_objects from storage.objects where bucket_id='catalog-public';
  select count(*) into content_objects from storage.objects where bucket_id='content-public';
  select count(*) into event_objects from storage.objects where bucket_id='event-public';

  select count(*) into published_products
  from public.products p
  where p.status='published' and p.is_active=true and p.deleted_at is null;

  select count(*) into products_with_real_primary
  from public.products p
  where p.status='published' and p.is_active=true and p.deleted_at is null
    and exists(
      select 1
      from public.product_images pi
      join storage.objects so on so.bucket_id='catalog-public' and so.name=pi.storage_path
      where pi.product_id=p.id and pi.is_primary=true
    );

  select count(*),count(*) filter(where pv.weight_grams is null or pv.weight_grams<=0)
  into active_variants,missing_weights
  from public.product_variants pv
  join public.products p on p.id=pv.product_id
  where pv.is_active=true and p.status='published' and p.is_active=true and p.deleted_at is null;

  select count(*) into active_producers
  from public.producers p
  where p.status='active' and p.is_verified=true and p.deleted_at is null;

  select count(*) into ready_producer_accounts
  from private.producer_payment_accounts pa
  join public.producers p on p.id=pa.producer_id
  where p.status='active' and p.is_verified=true and p.deleted_at is null
    and pa.provider='iyzico' and pa.status='ready' and nullif(btrim(pa.submerchant_key),'') is not null;

  select coalesce(array_agg(distinct ce.slug order by ce.slug),'{}'::text[])
  into published_legal_slugs
  from public.content_entries ce
  where ce.deleted_at is null and ce.status='published' and ce.locale='tr'
    and ce.slug=any(required_legal_slugs)
    and (char_length(btrim(coalesce(ce.body_markdown,'')))>=100 or char_length(btrim(coalesce(ce.body_html_sanitized,'')))>=100);

  select coalesce(array_agg(slug order by slug),'{}'::text[])
  into missing_legal_slugs
  from unnest(required_legal_slugs) slug
  where not (slug=any(published_legal_slugs));

  payment_cfg:=private.default_payment_control_v1() || coalesce(settings.public_config->'payments','{}'::jsonb);

  return jsonb_build_object(
    'ok',true,
    'generatedAt',timezone('utc',now()),
    'integrity',runtime_integrity,
    'businessIdentity',jsonb_build_object(
      'legalNameConfigured',nullif(btrim(coalesce(settings.legal_name,'')),'') is not null,
      'supportEmailConfigured',nullif(btrim(coalesce(settings.support_email,'')),'') is not null,
      'supportPhoneConfigured',nullif(btrim(coalesce(settings.support_phone,'')),'') is not null,
      'registeredLegalNameConfigured',legal_readiness->>'registeredLegalName' is not null,
      'registeredAddressConfigured',legal_readiness->>'registeredAddress' is not null,
      'registeredCountryCodeConfigured',legal_readiness->>'countryCode' is not null,
      'legalDocumentsFinalized',coalesce((legal_readiness->>'legalDocumentsFinalized')::boolean,false),
      'missing',coalesce(legal_readiness->'missing','[]'::jsonb),
      'ready',coalesce((legal_readiness->>'ready')::boolean,false)
    ),
    'assets',jsonb_build_object(
      'catalogObjectCount',catalog_objects,
      'contentObjectCount',content_objects,
      'eventObjectCount',event_objects,
      'publishedProductCount',published_products,
      'publishedProductsWithRealPrimaryImage',products_with_real_primary,
      'publishedProductsMissingRealPrimaryImage',greatest(published_products-products_with_real_primary,0),
      'catalogReady',published_products>0 and products_with_real_primary=published_products
    ),
    'legalContent',jsonb_build_object(
      'requiredSlugs',to_jsonb(required_legal_slugs),
      'publishedSlugs',to_jsonb(published_legal_slugs),
      'missingSlugs',to_jsonb(missing_legal_slugs),
      'ready',cardinality(missing_legal_slugs)=0
    ),
    'shipping',jsonb_build_object(
      'activePublishedVariantCount',active_variants,
      'missingWeightVariantCount',missing_weights,
      'ready',active_variants>0 and missing_weights=0
    ),
    'producerPayments',jsonb_build_object(
      'activeVerifiedProducerCount',active_producers,
      'readyProducerPaymentAccountCount',ready_producer_accounts,
      'missingProducerPaymentAccountCount',greatest(active_producers-ready_producer_accounts,0),
      'ready',active_producers>0 and ready_producer_accounts=active_producers
    ),
    'paymentControl',jsonb_build_object(
      'provider',payment_cfg->>'provider',
      'checkoutFormEnabled',coalesce((payment_cfg->>'checkout_form_enabled')::boolean,false),
      'savedCardPaymentsEnabled',coalesce((payment_cfg->>'live_card_payments_enabled')::boolean,false),
      'cardEnrollmentEnabled',coalesce((payment_cfg->>'card_enrollment_enabled')::boolean,false),
      'atLeastOneCheckoutFlowEnabled',coalesce((payment_cfg->>'checkout_form_enabled')::boolean,false) or coalesce((payment_cfg->>'live_card_payments_enabled')::boolean,false)
    )
  );
end;
$$;
