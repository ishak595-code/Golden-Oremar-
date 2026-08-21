create or replace function private.catalog_producer_card_identity_v1(p_producer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  producer_row public.producers%rowtype;
  badge_active boolean;
  follower_count bigint;
begin
  select * into producer_row
  from public.producers p
  where p.id=p_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null;
  if producer_row.id is null then return null; end if;

  badge_active:=coalesce(private.is_producer_trust_badge_active_v1(producer_row.id),false);
  select count(*) into follower_count from private.producer_follows f where f.producer_id=producer_row.id;

  return jsonb_build_object(
    'verified',badge_active,
    'originVerified',coalesce(producer_row.origin_verified,false) and badge_active,
    'storeKind',producer_row.store_kind,
    'storefrontTier',producer_row.storefront_tier,
    'badgeTone',case when producer_row.store_kind='official' then 'ruby' else 'blue' end,
    'storeBadgeLabel',case when producer_row.store_kind='official' then 'Golden Oremar Resmi Mağazası' else 'Golden Oremar Doğrulanmış Üretici' end,
    'followerCount',follower_count
  );
end;
$$;
revoke all on function private.catalog_producer_card_identity_v1(uuid) from public,anon,authenticated;
grant execute on function private.catalog_producer_card_identity_v1(uuid) to postgres,service_role;

create or replace function private.decorate_catalog_handling_v1(p_base jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare items jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(
      item || jsonb_build_object(
        'handlingProfile',coalesce(private.product_handling_profile_v1((item->>'id')::uuid),'null'::jsonb)
      ),
      '{producer}',
      coalesce(item->'producer','{}'::jsonb) || coalesce(private.catalog_producer_card_identity_v1((item#>>'{producer,id}')::uuid),'{}'::jsonb),
      true
    )
  ),'[]'::jsonb)
  into items
  from jsonb_array_elements(coalesce(p_base->'items','[]'::jsonb)) item;
  return jsonb_set(p_base,'{items}',items,true);
end;
$$;
revoke all on function private.decorate_catalog_handling_v1(jsonb) from public,anon,authenticated;
grant execute on function private.decorate_catalog_handling_v1(jsonb) to postgres,service_role;
