create or replace function private.get_public_producer_profile_v4(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  base jsonb:=private.get_public_producer_profile_v3(p_reference);
  v_producer_id uuid;
  producer_row public.producers%rowtype;
  badge_active boolean;
  badges jsonb;
  categories jsonb;
  real_followers bigint:=0;
begin
  begin v_producer_id:=(base->>'id')::uuid; exception when others then raise exception 'producer_profile_invalid' using errcode='55000'; end;
  select * into producer_row from public.producers p where p.id=v_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
  if producer_row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  badge_active:=private.is_producer_trust_badge_active_v1(v_producer_id);
  select count(*)::bigint into real_followers from private.producer_follows f where f.producer_id=v_producer_id;

  if producer_row.store_kind='official' then
    badges:=jsonb_build_array(
      jsonb_build_object('key','official_store','label','Golden Oremar Resmi Mağazası','active',true,'tone','emerald'),
      jsonb_build_object('key','verified_origin','label','Menşe doğrulandı','active',producer_row.origin_verified,'tone','emerald')
    );
  else
    badges:=jsonb_build_array(
      jsonb_build_object('key','verified_producer','label','Golden Oremar Doğrulanmış Üretici','active',badge_active,'tone','blue'),
      jsonb_build_object('key','verified_origin','label','Menşe ve üretim yeri doğrulandı','active',producer_row.origin_verified and badge_active,'tone','blue')
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('slug',x.slug,'name',x.name,'productCount',x.product_count) order by x.product_count desc,x.name),'[]'::jsonb)
  into categories
  from (
    select c.slug,c.name,count(*)::bigint product_count
    from public.products p join public.categories c on c.id=p.category_id
    where p.producer_id=v_producer_id and p.status='published' and p.is_active=true and p.deleted_at is null and c.is_active=true
    group by c.slug,c.name
    order by count(*) desc,c.name
    limit 16
  ) x;

  return (base-'badges') || jsonb_build_object(
    'store_kind',producer_row.store_kind,
    'storefront_tier',producer_row.storefront_tier,
    'storefront_theme',producer_row.storefront_theme,
    'storefront_headline',producer_row.storefront_headline,
    'storefront_subheadline',producer_row.storefront_subheadline,
    'badges',badges,
    'categories',categories,
    'follower_count',real_followers,
    'social_proof',jsonb_build_object(
      'realFollowerCount',real_followers,
      'launchAudience',jsonb_build_object('count',producer_row.launch_audience_count,'label',producer_row.launch_audience_label,'kind','promotional_audience')
    )
  );
end;
$$;
