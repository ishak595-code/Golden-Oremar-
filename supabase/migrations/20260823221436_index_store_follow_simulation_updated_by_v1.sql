create index if not exists store_follow_simulation_allocations_updated_by_idx
  on private.store_follow_simulation_allocations(updated_by)
  where updated_by is not null;
