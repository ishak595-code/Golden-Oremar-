create or replace function private.get_public_producer_follow_metrics_v1(p_producer_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare caller_id uuid:=auth.uid(); requested_count integer:=coalesce(cardinality(p_producer_ids),0); ids uuid[]:=array[]::uuid[]; result jsonb;
begin
  if requested_count=0 then return '[]'::jsonb; end if;
  if requested_count>100 then raise exception 'too_many_producer_ids' using errcode='22023'; end if;
  select coalesce(array_agg(distinct value),array[]::uuid[]) into ids from unnest(p_producer_ids) value where value is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'producerId',p.id,
    'followerCount',coalesce(follow_stats.follower_count,0),
    'following',case when caller_id is null then false else exists(select 1 from private.producer_follows mine where mine.user_id=caller_id and mine.producer_id=p.id) end,
    'verified',case when p.store_kind='official' then true else private.is_producer_trust_badge_active_v1(p.id) end,
    'originVerified',p.origin_verified and (p.store_kind='official' or private.is_producer_trust_badge_active_v1(p.id)),
    'storeKind',p.store_kind,
    'badgeTone',case when p.store_kind='official' then 'emerald' else 'blue' end,
    'storefrontTier',p.storefront_tier
  ) order by case when p.store_kind='official' then 0 else 1 end,p.display_name,p.id),'[]'::jsonb) into result
  from public.producers p
  left join lateral(select count(*)::bigint follower_count from private.producer_follows all_follows where all_follows.producer_id=p.id) follow_stats on true
  where p.id=any(ids) and p.status='active' and p.is_verified=true and p.deleted_at is null;
  return result;
end;
$$;
