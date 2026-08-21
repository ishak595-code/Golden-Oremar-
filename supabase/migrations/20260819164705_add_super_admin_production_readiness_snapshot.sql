create or replace function private.super_admin_get_production_readiness_snapshot_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then
    raise exception 'super_admin_required' using errcode='42501';
  end if;

  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;

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
    'businessIdentity',jsonb_build_object(
      'legalNameConfigured',nullif(btrim(coalesce(settings.legal_name,'')),'') is not null,
      'supportEmailConfigured',nullif(btrim(coalesce(settings.support_email,'')),'') is not null,
      'supportPhoneConfigured',nullif(btrim(coalesce(settings.support_phone,'')),'') is not null,
      'ready',nullif(btrim(coalesce(settings.legal_name,'')),'') is not null
        and nullif(btrim(coalesce(settings.support_email,'')),'') is not null
        and nullif(btrim(coalesce(settings.support_phone,'')),'') is not null
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
$function$;

revoke all on function private.super_admin_get_production_readiness_snapshot_v1() from public,anon;
grant execute on function private.super_admin_get_production_readiness_snapshot_v1() to authenticated;

create or replace function public.super_admin_get_production_readiness_snapshot_v1()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $function$
  select private.super_admin_get_production_readiness_snapshot_v1();
$function$;

revoke all on function public.super_admin_get_production_readiness_snapshot_v1() from public,anon;
grant execute on function public.super_admin_get_production_readiness_snapshot_v1() to authenticated;
