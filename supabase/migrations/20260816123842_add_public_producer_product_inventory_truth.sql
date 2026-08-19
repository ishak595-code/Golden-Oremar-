create or replace function private.get_public_producer_profile_v1(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  ref text:=btrim(coalesce(p_reference,''));
  producer public.producers%rowtype;
  result jsonb;
begin
  if char_length(ref) not between 1 and 160 then raise exception 'invalid_producer_reference' using errcode='22023'; end if;
  select * into producer from public.producers p where p.status='active' and p.is_verified=true and p.deleted_at is null and (p.id::text=ref or p.slug=lower(ref)) limit 1;
  if producer.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  select jsonb_build_object(
    'id',producer.id,'slug',producer.slug,'display_name',producer.display_name,'description',producer.description,'story',producer.story,
    'logo_path',producer.logo_path,'cover_path',producer.cover_path,'rating_average',producer.rating_average,'rating_count',producer.rating_count,
    'location_label',producer.production_location,
    'location',jsonb_build_object('country_code',producer.production_country_code,'province',producer.production_province,'district',producer.production_district,'village',producer.production_village),
    'badges',jsonb_build_array(
      jsonb_build_object('key','verified_producer','label','Üretici doğrulandı','active',true),
      jsonb_build_object('key','verified_origin','label','Menşe/üretim yeri doğrulandı','active',producer.origin_verified)
    ),
    'product_count',(select count(*) from public.products p where p.producer_id=producer.id and p.status='published' and p.is_active=true and p.deleted_at is null),
    'products',coalesce((select jsonb_agg(jsonb_build_object(
      'id',q.id,'slug',q.slug,'name',q.name,'short_description',q.short_description,'origin',q.origin,'unit_label',q.unit_label,'currency',q.currency,
      'featured',q.is_featured,'variant_id',q.variant_id,'variant_name',q.variant_name,'price_minor',q.price_minor,'compare_at_price_minor',q.compare_at_price_minor,
      'weight_grams',q.weight_grams,'image_path',q.image_path,'stock_mode',q.stock_mode,'available_quantity',q.available_quantity,'available',q.available
    ) order by q.is_featured desc,q.published_at desc nulls last,q.name)
      from (
        select p.id,p.slug,p.name,p.short_description,p.origin,p.unit_label,p.currency,p.is_featured,p.stock_mode,p.published_at,
          v.id variant_id,v.name variant_name,v.price_minor,v.compare_at_price_minor,v.weight_grams,
          case when p.stock_mode in ('tracked','seasonal') then greatest(0,coalesce(inv.available_quantity,0)-coalesce(inv.reserved_quantity,0)) else null end available_quantity,
          case when p.stock_mode in ('tracked','seasonal') then inv.variant_id is not null and greatest(0,inv.available_quantity-inv.reserved_quantity)>0 else true end available,
          (select i.storage_path from public.product_images i where i.product_id=p.id order by i.is_primary desc,i.sort_order asc,i.created_at asc limit 1) image_path
        from public.products p
        join lateral(select pv.* from public.product_variants pv where pv.product_id=p.id and pv.is_active=true order by pv.is_default desc,pv.created_at asc limit 1) v on true
        left join public.product_inventory inv on inv.variant_id=v.id
        where p.producer_id=producer.id and p.status='published' and p.is_active=true and p.deleted_at is null
        order by p.is_featured desc,p.published_at desc nulls last,p.name limit 12
      ) q),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$;
revoke all on function private.get_public_producer_profile_v1(text) from public;
revoke all on function private.get_public_producer_profile_v1(text) from anon;
revoke all on function private.get_public_producer_profile_v1(text) from authenticated;
grant execute on function public.get_public_producer_profile_v1(text) to anon,authenticated;
