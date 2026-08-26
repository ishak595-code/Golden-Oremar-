create or replace function private.super_admin_store_detail_v1(p_store_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  ref text:=btrim(coalesce(p_store_reference,''));
  p public.producers%rowtype;
  readiness jsonb;
  application jsonb:=null;
begin
  if auth.uid() is null or not coalesce(private.has_permission('storefront.lifecycle_manage'),false) then
    raise exception 'permission_required:storefront.lifecycle_manage' using errcode='42501';
  end if;
  if char_length(ref) not between 1 and 220 then raise exception 'invalid_store_reference' using errcode='22023'; end if;
  select * into p from public.producers x
  where lower(x.store_number)=lower(ref) or lower(x.slug)=lower(ref) or x.id::text=lower(ref)
  order by case when lower(x.store_number)=lower(ref) then 0 when x.id::text=lower(ref) then 1 else 2 end
  limit 1;
  if p.id is null then raise exception 'store_not_found' using errcode='P0002'; end if;
  readiness:=case when p.deleted_at is null then private.storefront_readiness_v1(p.id) else jsonb_build_object('ready',false,'missing',jsonb_build_array('store_archived'),'steps','[]'::jsonb) end;
  if p.application_id is not null then
    select jsonb_build_object('id',a.id,'status',a.status,'sellerClassification',a.seller_classification,'foodComplianceStatus',a.food_compliance_status,'submittedAt',a.submitted_at,'reviewedAt',a.reviewed_at)
      into application from public.producer_applications a where a.id=p.application_id;
  end if;
  return jsonb_build_object(
    'id',p.id,'storeNumber',p.store_number,'slug',p.slug,'name',p.display_name,'description',p.description,'story',p.story,
    'storeKind',p.store_kind,'producerStatus',p.status,'storefrontStatus',p.storefront_status,'publishedAt',p.storefront_published_at,
    'verified',p.is_verified,'originVerified',p.origin_verified,'trustBadgeActive',case when p.store_kind='official' then true else coalesce(private.is_producer_trust_badge_active_v1(p.id),false) end,
    'logoPath',private.verified_public_storage_path_v1('catalog-public',p.logo_path),'coverPath',private.verified_public_storage_path_v1('catalog-public',p.cover_path),
    'contact',jsonb_build_object('email',p.storefront_contact_email,'phone',p.storefront_contact_phone,'website',p.storefront_website_url),
    'address',jsonb_build_object('line1',p.storefront_address_line1,'line2',p.storefront_address_line2,'postalCode',p.storefront_postal_code,'city',p.storefront_city,'region',p.storefront_region,'countryCode',p.storefront_country_code,'visibility',p.storefront_address_visibility),
    'business',jsonb_build_object('type',p.storefront_business_identity_type,'name',p.storefront_business_name,'reference',p.storefront_business_reference,'verifiedAt',p.storefront_business_verified_at),
    'readiness',readiness,'application',application,
    'metrics',jsonb_build_object(
      'products',(select count(*)::bigint from public.products product where product.producer_id=p.id and product.deleted_at is null),
      'publishedProducts',(select count(*)::bigint from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null),
      'orders',(select count(distinct item.order_id)::bigint from public.order_items item where item.producer_id=p.id),
      'customers',(select count(distinct o.user_id)::bigint from public.order_items item join public.orders o on o.id=item.order_id where item.producer_id=p.id and o.status not in ('draft','cancelled')),
      'followers',(select count(*)::bigint from private.producer_follows f where f.producer_id=p.id)
    ),
    'createdAt',p.created_at,'updatedAt',p.updated_at,'archivedAt',p.deleted_at,
    'officialProtected',p.store_kind='official'
  );
end;
$$;
revoke all on function private.super_admin_store_detail_v1(text) from public, anon, authenticated;
