create or replace function private.product_recommendations_core_v1(p_reference text,p_limit integer default 12,p_include_nonpublic boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$declare ref text:=btrim(coalesce(p_reference,'')); target public.products%rowtype; target_category public.categories%rowtype; target_price bigint; result jsonb; begin
  if char_length(ref) not between 1 and 200 then raise exception 'invalid_product_reference' using errcode='22023'; end if;
  if p_limit not between 1 and 24 then raise exception 'invalid_recommendation_limit' using errcode='22023'; end if;
  select p.* into target from public.products p join public.producers pr on pr.id=p.producer_id and pr.status='active' and pr.is_verified=true and pr.deleted_at is null
  where (p.id::text=ref or p.legacy_id=ref or p.slug=lower(ref)) and p.deleted_at is null and ((not p_include_nonpublic and p.status='published' and p.is_active=true) or (p_include_nonpublic and pr.store_kind='official' and p.status in ('draft','review','published'))) limit 1;
  if target.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select * into target_category from public.categories c where c.id=target.category_id and c.is_active=true;
  select v.price_minor into target_price from public.product_variants v where v.product_id=target.id and v.is_active=true and v.price_minor>0 order by v.is_default desc,v.created_at asc limit 1;
  if target_category.id is null or target_price is null then raise exception 'product_recommendation_target_not_ready' using errcode='55000'; end if;
  with candidates as (
    select p.id,p.legacy_id,p.slug,p.name,p.short_description,p.origin,p.unit_label,p.currency,p.stock_mode,p.is_featured,p.published_at,p.status,p.is_active,c.id category_id,c.slug category_slug,c.name category_name,c.parent_id category_parent_id,pr.id producer_id,pr.display_name producer_name,pr.store_kind,pr.storefront_tier,v.id variant_id,v.name variant_name,v.sku,v.price_minor,v.compare_at_price_minor,
      case when p.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0)) else null end available_quantity,
      private.verified_public_storage_path_v1('catalog-public',img.storage_path) image_path,coalesce(rv.average_rating,0)::numeric average_rating,coalesce(rv.review_count,0)::bigint review_count,coalesce(fav.favorite_count,0)::bigint favorite_count,coalesce(sale.sales_30d,0)::bigint sales_30d,coalesce(sale.sales_all,0)::bigint sales_all,
      (p.category_id=target.category_id) same_category,(target_category.parent_id is not null and (c.parent_id=target_category.parent_id or c.id=target_category.parent_id or c.parent_id=target_category.id)) related_category,(v.price_minor<target_price) cheaper,abs(v.price_minor-target_price) price_difference_minor
    from public.products p join public.producers pr on pr.id=p.producer_id and pr.status='active' and pr.is_verified=true and pr.deleted_at is null join public.categories c on c.id=p.category_id and c.is_active=true
    join lateral(select pv.* from public.product_variants pv where pv.product_id=p.id and pv.is_active=true and pv.price_minor>0 order by pv.is_default desc,pv.created_at asc limit 1) v on true
    left join public.product_inventory inv on inv.variant_id=v.id
    left join lateral(select pi.storage_path from public.product_images pi where pi.product_id=p.id order by pi.is_primary desc,pi.sort_order,pi.created_at limit 1) img on true
    left join lateral(select round(avg(r.rating)::numeric,2) average_rating,count(*)::bigint review_count from public.reviews r where r.product_id=p.id and r.status='published') rv on true
    left join lateral(select count(*)::bigint favorite_count from public.favorites f where f.product_id=p.id) fav on true
    left join lateral(select coalesce(sum(oi.quantity) filter(where coalesce(o.placed_at,o.created_at)>=timezone('utc',now())-interval '30 days'),0)::bigint sales_30d,coalesce(sum(oi.quantity),0)::bigint sales_all from public.order_items oi join public.orders o on o.id=oi.order_id where oi.product_id=p.id and o.payment_status='paid' and o.status not in ('draft','cancelled')) sale on true
    where p.id<>target.id and p.deleted_at is null and private.product_media_integrity_ok_v1(p.id) and ((not p_include_nonpublic and p.status='published' and p.is_active=true) or (p_include_nonpublic and pr.store_kind='official' and p.status in ('draft','review','published')))
  ), scored as (
    select *, (case when same_category then 60 when related_category then 28 else 0 end + case when target_price>0 then greatest(0,18-(price_difference_minor::numeric/target_price::numeric*18)) else 0 end + case when cheaper then 8 else 0 end + least(25,ln(1+sales_30d::numeric)*10) + least(12,ln(1+sales_all::numeric)*4) + least(9,ln(1+favorite_count::numeric)*3) + least(10,average_rating*1.5+least(review_count,10)*0.25) + case when is_featured then 2 else 0 end + case when stock_mode in ('tracked','seasonal') and coalesce(available_quantity,0)<=0 then -40 else 0 end)::numeric score,
    case when same_category and cheaper then 'same_category_better_value' when same_category then 'same_category' when sales_30d>0 then 'recently_purchased' when cheaper then 'better_value' when related_category then 'related_category' else 'discovery' end reason from candidates
  ), page as (select * from scored order by score desc,sales_30d desc,sales_all desc,favorite_count desc,average_rating desc,name,id limit p_limit)
  select jsonb_build_object('productId',target.id,'generatedAt',timezone('utc',now()),'items',coalesce(jsonb_agg(jsonb_build_object('id',id,'legacyId',legacy_id,'slug',slug,'name',name,'shortDescription',short_description,'origin',origin,'unitLabel',unit_label,'category',jsonb_build_object('id',category_id,'slug',category_slug,'name',category_name),'producer',jsonb_build_object('id',producer_id,'name',producer_name,'storeKind',store_kind,'storefrontTier',storefront_tier),'variant',jsonb_build_object('id',variant_id,'name',variant_name,'sku',sku,'priceMinor',price_minor,'compareAtPriceMinor',compare_at_price_minor),'currency',currency,'stockMode',stock_mode,'availableQuantity',available_quantity,'featured',is_featured,'imagePath',image_path,'averageRating',average_rating,'reviewCount',review_count,'reason',reason,'score',round(score,4),'signals',jsonb_build_object('sameCategory',same_category,'relatedCategory',related_category,'cheaper',cheaper,'priceDifferenceMinor',price_difference_minor,'sales30d',sales_30d,'salesAll',sales_all,'favoriteCount',favorite_count,'reviewCount',review_count,'averageRating',average_rating)) order by score desc,sales_30d desc,sales_all desc,favorite_count desc,average_rating desc,name,id),'[]'::jsonb)) into result from page;
  return coalesce(result,jsonb_build_object('productId',target.id,'generatedAt',timezone('utc',now()),'items','[]'::jsonb));
end;$$;
revoke all on function private.product_recommendations_core_v1(text,integer,boolean) from public,anon,authenticated;
create or replace function api_public_bridge.public_product_recommendations_v1(p_reference text,p_limit integer default 12) returns jsonb language sql stable security definer set search_path='' as $$select private.product_recommendations_core_v1(p_reference,p_limit,false);$$;
revoke all on function api_public_bridge.public_product_recommendations_v1(text,integer) from public;
grant execute on function api_public_bridge.public_product_recommendations_v1(text,integer) to anon,authenticated;
create or replace function public.public_product_recommendations_v1(p_reference text,p_limit integer default 12) returns jsonb language sql stable security invoker set search_path='' as $$select api_public_bridge.public_product_recommendations_v1(p_reference,p_limit);$$;
revoke all on function public.public_product_recommendations_v1(text,integer) from public;
grant execute on function public.public_product_recommendations_v1(text,integer) to anon,authenticated;
create or replace function private.super_admin_product_recommendations_preview_v1(p_reference text,p_limit integer default 12) returns jsonb language plpgsql stable security definer set search_path='' as $$begin if auth.uid() is null or not coalesce(private.has_permission('product.read'),false) then raise exception 'permission_required:product.read' using errcode='42501'; end if; return private.product_recommendations_core_v1(p_reference,p_limit,true); end;$$;
revoke all on function private.super_admin_product_recommendations_preview_v1(text,integer) from public,anon;
grant execute on function private.super_admin_product_recommendations_preview_v1(text,integer) to authenticated,service_role;
create or replace function public.super_admin_product_recommendations_preview_v1(p_reference text,p_limit integer default 12) returns jsonb language sql stable security invoker set search_path='' as $$select private.super_admin_product_recommendations_preview_v1(p_reference,p_limit);$$;
revoke all on function public.super_admin_product_recommendations_preview_v1(text,integer) from public,anon;
grant execute on function public.super_admin_product_recommendations_preview_v1(text,integer) to authenticated,service_role;
