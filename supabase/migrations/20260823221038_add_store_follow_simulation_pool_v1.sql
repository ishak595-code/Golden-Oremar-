create table if not exists private.store_follow_simulation_allocations (
  producer_id uuid primary key references public.producers(id) on delete cascade,
  simulated_followers integer not null default 0 check (simulated_followers between 0 and 10000),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc',now())
);

comment on table private.store_follow_simulation_allocations is 'Internal QA/load-test follower simulation only. Never included in public producer follower counts or customer-facing social proof.';
revoke all on table private.store_follow_simulation_allocations from public, anon, authenticated;

create or replace function private.get_store_follow_simulation_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  allocated integer := 0;
  stores jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not private.has_role('super_admin') then
    raise exception 'super_admin_required' using errcode='42501';
  end if;

  select coalesce(sum(a.simulated_followers),0)::integer
    into allocated
  from private.store_follow_simulation_allocations a;

  select coalesce(jsonb_agg(jsonb_build_object(
    'producerId',p.id,
    'name',p.display_name,
    'storeKind',p.store_kind,
    'verified',p.is_verified,
    'realFollowerCount',coalesce(real_stats.follower_count,0),
    'simulatedFollowers',coalesce(a.simulated_followers,0),
    'updatedAt',a.updated_at
  ) order by case when p.store_kind='official' then 0 else 1 end,p.display_name,p.id),'[]'::jsonb)
    into stores
  from public.producers p
  left join private.store_follow_simulation_allocations a on a.producer_id=p.id
  left join lateral (
    select count(*)::bigint as follower_count
    from private.producer_follows f
    where f.producer_id=p.id
  ) real_stats on true
  where p.status='active' and p.is_verified=true and p.deleted_at is null;

  return jsonb_build_object(
    'poolCapacity',10000,
    'allocated',allocated,
    'available',greatest(0,10000-allocated),
    'publicMetricsIsolation',true,
    'stores',stores
  );
end;
$$;

revoke all on function private.get_store_follow_simulation_v1() from public;

create or replace function private.admin_set_store_follow_simulation_v1(p_producer_id uuid,p_simulated_followers integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  allocated_other integer := 0;
begin
  if auth.uid() is null or not private.has_role('super_admin') then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  if p_producer_id is null or p_simulated_followers is null or p_simulated_followers not between 0 and 10000 then
    raise exception 'invalid_simulation_allocation' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.producers p
    where p.id=p_producer_id and p.status='active' and p.is_verified=true and p.deleted_at is null
  ) then
    raise exception 'producer_not_available' using errcode='P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('golden_oremar_store_follow_simulation_v1'));

  select coalesce(sum(a.simulated_followers),0)::integer
    into allocated_other
  from private.store_follow_simulation_allocations a
  where a.producer_id<>p_producer_id;

  if allocated_other+p_simulated_followers>10000 then
    raise exception 'simulation_pool_capacity_exceeded' using errcode='22023';
  end if;

  if p_simulated_followers=0 then
    delete from private.store_follow_simulation_allocations where producer_id=p_producer_id;
  else
    insert into private.store_follow_simulation_allocations(producer_id,simulated_followers,updated_by,updated_at)
    values(p_producer_id,p_simulated_followers,auth.uid(),timezone('utc',now()))
    on conflict(producer_id) do update set
      simulated_followers=excluded.simulated_followers,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;
  end if;

  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details,created_at)
  values(auth.uid(),'store_follow_simulation_set','producer',p_producer_id::text,jsonb_build_object(
    'simulatedFollowers',p_simulated_followers,
    'publicMetricsIsolation',true,
    'poolCapacity',10000
  ),timezone('utc',now()));

  return private.get_store_follow_simulation_v1();
end;
$$;

revoke all on function private.admin_set_store_follow_simulation_v1(uuid,integer) from public;

create or replace function public.get_store_follow_simulation_v1()
returns jsonb
language sql
stable
set search_path to ''
as $$ select private.get_store_follow_simulation_v1(); $$;

create or replace function public.admin_set_store_follow_simulation_v1(p_producer_id uuid,p_simulated_followers integer)
returns jsonb
language sql
set search_path to ''
as $$ select private.admin_set_store_follow_simulation_v1(p_producer_id,p_simulated_followers); $$;

revoke all on function public.get_store_follow_simulation_v1() from public;
revoke all on function public.admin_set_store_follow_simulation_v1(uuid,integer) from public;
grant execute on function public.get_store_follow_simulation_v1() to authenticated;
grant execute on function public.admin_set_store_follow_simulation_v1(uuid,integer) to authenticated;
