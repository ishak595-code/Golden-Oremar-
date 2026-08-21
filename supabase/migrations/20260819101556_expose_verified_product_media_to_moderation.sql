create or replace function private.admin_list_products_v3()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb; result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  base:=private.admin_list_products_v2();
  select coalesce(jsonb_agg(item||jsonb_build_object(
    'producer_badge_active',private.is_producer_trust_badge_active_v1(product.producer_id),
    'producer_badge_status',producer.trust_badge_status,
    'category_scope_ready',category.slug=any(producer.approved_category_slugs),
    'origin_matches_producer',lower(btrim(coalesce(product.origin,'')))=lower(btrim(coalesce(producer.production_location,''))),
    'primary_image_path',(select private.verified_public_storage_path_v1('catalog-public',i.storage_path) from public.product_images i where i.product_id=product.id and i.is_primary=true order by i.created_at limit 1),
    'duplicate_name_count',(select count(*) from public.products p2 where p2.id<>product.id and p2.deleted_at is null and lower(btrim(p2.name))=lower(btrim(product.name))),
    'duplicate_primary_image_count',(select count(*) from public.product_images i2 join public.product_images i1 on i1.product_id=product.id and i1.is_primary=true where i2.product_id<>product.id and i2.is_primary=true and i2.storage_path=i1.storage_path),
    'pending_change_count',(select count(*) from public.product_change_requests cr where cr.product_id=product.id and cr.status='pending'),
    'moderation_risk_count',(case when not private.is_producer_trust_badge_active_v1(product.producer_id) then 1 else 0 end)+(case when not (category.slug=any(producer.approved_category_slugs)) then 1 else 0 end)+(case when lower(btrim(coalesce(product.origin,'')))<>lower(btrim(coalesce(producer.production_location,''))) then 1 else 0 end)+(case when exists(select 1 from public.product_images i2 join public.product_images i1 on i1.product_id=product.id and i1.is_primary=true where i2.product_id<>product.id and i2.is_primary=true and i2.storage_path=i1.storage_path) then 1 else 0 end)+(case when coalesce((item->>'catalog_issue_count')::integer,0)>0 then 1 else 0 end)
  ) order by ordinality),'[]'::jsonb) into result
  from jsonb_array_elements(base) with ordinality rows(item,ordinality)
  join public.products product on product.id=(item->>'id')::uuid
  join public.producers producer on producer.id=product.producer_id
  join public.categories category on category.id=product.category_id;
  return result;
end;
$$;
