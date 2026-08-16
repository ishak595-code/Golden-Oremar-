create or replace function private.get_public_producer_profile_v2(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  caller_id uuid := auth.uid();
  base jsonb;
  target_producer_id uuid;
  follower_count bigint := 0;
  is_following boolean := false;
  enriched_products jsonb := '[]'::jsonb;
begin
  base := private.get_public_producer_profile_v1(p_reference);
  target_producer_id := (base->>'id')::uuid;

  select count(*)::bigint
    into follower_count
  from private.producer_follows f
  where f.producer_id=target_producer_id;

  if caller_id is not null then
    select exists(
      select 1 from private.producer_follows f
      where f.user_id=caller_id and f.producer_id=target_producer_id
    ) into is_following;
  end if;

  select coalesce(jsonb_agg(
    product_item || jsonb_build_object(
      'average_rating', coalesce(review_stats.average_rating, 0),
      'review_count', coalesce(review_stats.review_count, 0)
    ) order by ordinality
  ), '[]'::jsonb)
  into enriched_products
  from jsonb_array_elements(coalesce(base->'products','[]'::jsonb)) with ordinality as products(product_item, ordinality)
  left join lateral (
    select
      coalesce(round(avg(r.rating)::numeric,2),0) as average_rating,
      count(*)::bigint as review_count
    from public.reviews r
    where r.product_id=(product_item->>'id')::uuid
      and r.status='published'
  ) review_stats on true;

  return (base - 'products') || jsonb_build_object(
    'follower_count', follower_count,
    'following', is_following,
    'products', enriched_products
  );
end;
$$;

revoke all on function private.get_public_producer_profile_v2(text) from public;
