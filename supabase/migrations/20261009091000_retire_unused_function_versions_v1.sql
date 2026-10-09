-- Retire old function versions nothing uses any more, so the database holds
-- one current version of each and nobody edits or calls a stale one by
-- mistake.
--
-- Chosen on 9 October 2026 from the live catalogue of functions:
--   * a newer version of the same function exists;
--   * no other function in public, private or api_public_bridge calls it;
--   * no trigger and no cron job uses it;
--   * neither the app (src/), the edge functions (supabase/functions/) nor
--     the scripts call it.
-- Versions still called by other functions (the chained private readers,
-- the bridge wrappers) and every public RPC that an installed older app may
-- still call are kept. complete_order_payment_for_service_v1 is kept: the
-- commerce-payment edge function calls it.
--
-- Safe to apply at any time: each drop first checks again, at apply time,
-- that no function body names it, and skips it (with a notice) otherwise.

do $retire$
declare
  target record;
begin
  for target in
    select * from (values
      ('private', 'admin_operations_overview_v1', ''),
      ('private', 'admin_review_product_v1', 'uuid, boolean, text'),
      ('private', 'prepare_order_payment_for_service_v1', 'uuid, uuid, text'),
      ('private', 'register_verified_payment_method_v1', 'uuid, text, text, text, text, smallint, smallint, text, boolean'),
      ('private', 'request_customer_return_v1', 'uuid, text'),
      ('private', 'search_catalog_v2', 'text, text, uuid, text, text, text, bigint, bigint, boolean, boolean, text, integer, integer'),
      ('private', 'should_queue_push_v1', 'uuid, text'),
      ('public', 'claim_push_deliveries_v1', 'integer, text'),
      ('public', 'claim_push_deliveries_v2', 'integer, text, text[]')
    ) as t(schema_name, function_name, arg_types)
  loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private', 'api_public_bridge')
        and not (n.nspname = target.schema_name and p.proname = target.function_name)
        and p.prosrc ~ ('\m' || target.function_name || '\M')
    ) then
      raise notice 'kept %.%: still named by another function', target.schema_name, target.function_name;
    else
      execute format('drop function if exists %I.%I(%s)', target.schema_name, target.function_name, target.arg_types);
    end if;
  end loop;
end
$retire$;
