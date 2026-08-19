create or replace function private.get_my_producer_profile_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); producer public.producers%rowtype; badge_active boolean;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into producer from public.producers where owner_user_id=caller_id and deleted_at is null order by created_at desc limit 1;
  if not found then raise exception 'producer_profile_not_found' using errcode='P0002'; end if;
  badge_active:=private.is_producer_trust_badge_active_v1(producer.id);
  return jsonb_build_object(
    'id',producer.id,'display_name',producer.display_name,'description',producer.description,'story',producer.story,
    'production_location',producer.production_location,'production_country_code',producer.production_country_code,
    'production_province',producer.production_province,'production_district',producer.production_district,
    'production_village',producer.production_village,'production_village_is_custom',producer.production_village_is_custom,
    'logo_path',producer.logo_path,'cover_path',producer.cover_path,'status',producer.status,'is_verified',producer.is_verified,
    'origin_verified',producer.origin_verified,'activity_types',producer.activity_types,
    'approved_category_slugs',producer.approved_category_slugs,
    'approved_categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name) order by c.sort_order,c.name) from public.categories c where c.is_active=true and c.slug=any(producer.approved_category_slugs)),'[]'::jsonb),
    'verified_at',producer.verified_at,'verification_due_at',producer.verification_due_at,
    'trust_badge_status',producer.trust_badge_status,'trust_badge_active',badge_active,
    'trust_badge_granted_at',producer.trust_badge_granted_at,'trust_badge_review_due_at',producer.trust_badge_review_due_at,
    'trust_badge_revoked_at',producer.trust_badge_revoked_at,'trust_badge_reason',producer.trust_badge_reason,
    'rating_average',producer.rating_average,'rating_count',producer.rating_count,'commission_basis_points',producer.commission_basis_points,
    'product_count',(select count(*) from public.products product where product.producer_id=producer.id and product.deleted_at is null),
    'published_product_count',(select count(*) from public.products product where product.producer_id=producer.id and product.status='published' and product.is_active=true and product.deleted_at is null),
    'order_count',(select count(distinct item.order_id) from public.order_items item where item.producer_id=producer.id),
    'customer_count',(select count(distinct customer_order.user_id) from public.order_items item join public.orders customer_order on customer_order.id=item.order_id where item.producer_id=producer.id and customer_order.status not in ('draft','cancelled'))
  );
end;
$$;
