create or replace function private.get_public_product_handling_profiles_v1(p_product_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare safe_ids uuid[]; result jsonb;
begin
  safe_ids:=coalesce((select array_agg(distinct id) from unnest(coalesce(p_product_ids,'{}'::uuid[])) id),'{}'::uuid[]);
  if cardinality(safe_ids)>100 then raise exception 'too_many_product_ids' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'productId',p.id,
    'profile',private.product_handling_profile_v1(p.id)
  ) order by p.id),'[]'::jsonb)
  into result
  from public.products p
  join public.producers producer on producer.id=p.producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
  where p.id=any(safe_ids) and p.status='published' and p.is_active=true and p.deleted_at is null;
  return result;
end;
$$;
revoke all on function private.get_public_product_handling_profiles_v1(uuid[]) from public;
grant execute on function private.get_public_product_handling_profiles_v1(uuid[]) to postgres,anon,authenticated,service_role;

create or replace function public.get_public_product_handling_profiles_v1(p_product_ids uuid[])
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_public_product_handling_profiles_v1(p_product_ids); $$;
revoke all on function public.get_public_product_handling_profiles_v1(uuid[]) from public;
grant execute on function public.get_public_product_handling_profiles_v1(uuid[]) to anon,authenticated,service_role;
