create or replace function private.get_public_producer_follow_metrics_v1(p_producer_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); requested_count integer:=coalesce(cardinality(p_producer_ids),0); ids uuid[]:=array[]::uuid[]; result jsonb;
begin
  if requested_count=0 then return '[]'::jsonb; end if;
  if requested_count>100 then raise exception 'too_many_producer_ids' using errcode='22023'; end if;
  select coalesce(array_agg(distinct value),array[]::uuid[]) into ids from unnest(p_producer_ids) value where value is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'producerId',p.id,
    'followerCount',coalesce(follow_stats.follower_count,0),
    'following',case when caller_id is null then false else exists(select 1 from private.producer_follows mine where mine.user_id=caller_id and mine.producer_id=p.id) end,
    'verified',private.is_producer_trust_badge_active_v1(p.id),
    'originVerified',p.origin_verified and private.is_producer_trust_badge_active_v1(p.id)
  ) order by p.display_name,p.id),'[]'::jsonb) into result
  from public.producers p
  left join lateral(select count(*)::bigint follower_count from private.producer_follows all_follows where all_follows.producer_id=p.id) follow_stats on true
  where p.id=any(ids) and p.status='active' and p.is_verified=true and p.deleted_at is null;
  return result;
end;
$$;

create or replace function private.list_my_followed_producers_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'slug',p.slug,'displayName',p.display_name,'description',p.description,'logoPath',p.logo_path,'coverPath',p.cover_path,
   'ratingAverage',p.rating_average,'ratingCount',p.rating_count,
   'verified',private.is_producer_trust_badge_active_v1(p.id),
   'originVerified',p.origin_verified and private.is_producer_trust_badge_active_v1(p.id),
   'locationLabel',p.production_location,'location',jsonb_build_object('countryCode',p.production_country_code,'province',p.production_province,'district',p.production_district,'village',p.production_village),
   'productCount',(select count(*) from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null),
   'followedAt',f.created_at
 ) order by f.created_at desc),'[]'::jsonb) into result
 from private.producer_follows f join public.producers p on p.id=f.producer_id
 where f.user_id=caller_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
 return result;
end;
$$;

create or replace function private.list_public_producers_v1(p_query text default null,p_province text default null,p_district text default null,p_village text default null,p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare q text:=lower(btrim(coalesce(p_query,''))); result jsonb;
begin
  if char_length(q)>100 or p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_producer_directory_request' using errcode='22023'; end if;
  with base as (
    select p.id,p.slug,p.display_name,p.description,p.logo_path,p.cover_path,p.rating_average,p.rating_count,p.production_location,
      p.production_country_code,p.production_province,p.production_district,p.production_village,p.origin_verified,p.created_at,
      private.is_producer_trust_badge_active_v1(p.id) badge_active,
      (select count(*) from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null) product_count
    from public.producers p where p.status='active' and p.is_verified=true and p.deleted_at is null
      and (q='' or lower(p.display_name) like '%'||q||'%' or lower(coalesce(p.production_location,'')) like '%'||q||'%' or lower(coalesce(p.production_village,'')) like '%'||q||'%' or lower(coalesce(p.production_district,'')) like '%'||q||'%' or lower(coalesce(p.production_province,'')) like '%'||q||'%')
      and (nullif(btrim(coalesce(p_province,'')),'') is null or lower(coalesce(p.production_province,''))=lower(btrim(p_province)))
      and (nullif(btrim(coalesce(p_district,'')),'') is null or lower(coalesce(p.production_district,''))=lower(btrim(p_district)))
      and (nullif(btrim(coalesce(p_village,'')),'') is null or lower(coalesce(p.production_village,''))=lower(btrim(p_village)))
  ), page as (select * from base order by rating_average desc,rating_count desc,display_name limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from base),'limit',p_limit,'offset',p_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'slug',slug,'display_name',display_name,'description',description,'logo_path',logo_path,'cover_path',cover_path,
      'rating_average',rating_average,'rating_count',rating_count,'product_count',product_count,'location_label',production_location,
      'location',jsonb_build_object('country_code',production_country_code,'province',production_province,'district',production_district,'village',production_village),
      'verified',badge_active,'origin_verified',origin_verified and badge_active
    ) order by rating_average desc,rating_count desc,display_name) from page),'[]'::jsonb)) into result;
  return result;
end;
$$;
