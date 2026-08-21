create or replace function private.list_my_followed_producers_v1()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare caller_id uuid:=auth.uid(); result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'slug',p.slug,'displayName',p.display_name,'description',p.description,'logoPath',p.logo_path,'coverPath',p.cover_path,
   'ratingAverage',p.rating_average,'ratingCount',p.rating_count,
   'verified',private.is_producer_trust_badge_active_v1(p.id),
   'originVerified',p.origin_verified and private.is_producer_trust_badge_active_v1(p.id),
   'storeKind',p.store_kind,
   'storefrontTier',p.storefront_tier,
   'badgeTone',case when p.store_kind='official' then 'ruby' else 'blue' end,
   'storeBadgeLabel',case when p.store_kind='official' then 'Golden Oremar Resmi Mağazası' else 'Golden Oremar Doğrulanmış Üretici' end,
   'locationLabel',p.production_location,'location',jsonb_build_object('countryCode',p.production_country_code,'province',p.production_province,'district',p.production_district,'village',p.production_village),
   'productCount',(select count(*) from public.products product where product.producer_id=p.id and product.status='published' and product.is_active=true and product.deleted_at is null),
   'followedAt',f.created_at
 ) order by f.created_at desc),'[]'::jsonb) into result
 from private.producer_follows f join public.producers p on p.id=f.producer_id
 where f.user_id=caller_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
 return result;
end;
$$;
revoke all on function private.list_my_followed_producers_v1() from public,anon;
grant execute on function private.list_my_followed_producers_v1() to authenticated;

create or replace function public.list_my_followed_producers_v1()
returns jsonb
language sql
stable
set search_path=''
as $$select private.list_my_followed_producers_v1();$$;
revoke all on function public.list_my_followed_producers_v1() from public,anon;
grant execute on function public.list_my_followed_producers_v1() to authenticated;
