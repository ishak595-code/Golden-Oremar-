create index if not exists producer_follows_producer_id_idx
  on private.producer_follows(producer_id);

create or replace function private.get_public_producer_follow_metrics_v1(p_producer_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  caller_id uuid := auth.uid();
  requested_count integer := coalesce(cardinality(p_producer_ids), 0);
  ids uuid[] := array[]::uuid[];
  result jsonb;
begin
  if requested_count = 0 then
    return '[]'::jsonb;
  end if;
  if requested_count > 100 then
    raise exception 'too_many_producer_ids' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct value), array[]::uuid[])
    into ids
  from unnest(p_producer_ids) as value
  where value is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'producerId', p.id,
    'followerCount', coalesce(follow_stats.follower_count, 0),
    'following', case when caller_id is null then false else exists(
      select 1
      from private.producer_follows mine
      where mine.user_id=caller_id and mine.producer_id=p.id
    ) end,
    'verified', p.is_verified,
    'originVerified', p.origin_verified
  ) order by p.display_name, p.id), '[]'::jsonb)
  into result
  from public.producers p
  left join lateral (
    select count(*)::bigint as follower_count
    from private.producer_follows all_follows
    where all_follows.producer_id=p.id
  ) follow_stats on true
  where p.id=any(ids)
    and p.status='active'
    and p.is_verified=true
    and p.deleted_at is null;

  return result;
end;
$$;

revoke all on function private.get_public_producer_follow_metrics_v1(uuid[]) from public;

create or replace function public.get_public_producer_follow_metrics_v1(p_producer_ids uuid[])
returns jsonb
language sql
stable
set search_path to ''
as $$
  select private.get_public_producer_follow_metrics_v1(p_producer_ids);
$$;

revoke all on function public.get_public_producer_follow_metrics_v1(uuid[]) from public;
grant execute on function public.get_public_producer_follow_metrics_v1(uuid[]) to anon, authenticated;

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
  producer_id uuid;
  follower_count bigint := 0;
  is_following boolean := false;
  enriched_products jsonb := '[]'::jsonb;
begin
  base := private.get_public_producer_profile_v1(p_reference);
  producer_id := (base->>'id')::uuid;

  select count(*)::bigint
    into follower_count
  from private.producer_follows f
  where f.producer_id=producer_id;

  if caller_id is not null then
    select exists(
      select 1 from private.producer_follows f
      where f.user_id=caller_id and f.producer_id=producer_id
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

create or replace function public.get_public_producer_profile_v2(p_reference text)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select private.get_public_producer_profile_v2(p_reference);
$$;

revoke all on function public.get_public_producer_profile_v2(text) from public;
grant execute on function public.get_public_producer_profile_v2(text) to anon, authenticated;
