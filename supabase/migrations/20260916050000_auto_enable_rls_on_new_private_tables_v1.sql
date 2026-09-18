-- Forward-looking guard: automatically enable row level security on any table
-- created in the private schema from now on.
--
-- The preceding migration enabled RLS on the 41 private tables that were
-- missing it. That fixed the tables which exist today, but it does nothing for
-- tables added tomorrow. Without this, the next feature that creates a private
-- table inherits the same gap, and the gap is invisible until someone audits
-- for it - which is exactly how the original 41 accumulated.
--
-- An event trigger closes the loop. It fires after any CREATE TABLE and, for
-- tables landing in the private schema, turns RLS on immediately. A developer
-- or agent adding a table no longer has to remember; forgetting now fails
-- safe.
--
-- Scope and deliberate limits:
--   * private schema only. Tables in public are API-reachable and need
--     considered policies rather than a blanket default, so silently enabling
--     RLS there could break reads in a way that looks like a bug rather than a
--     security decision.
--   * ENABLE, never FORCE, matching the convention established in the previous
--     migration. FORCE would subject the postgres owner to RLS and break the
--     SECURITY DEFINER function layer.
--   * partitions are skipped; they inherit from their parent table.
--   * the trigger only ever adds protection. It cannot disable RLS, drop
--     policies, or alter data.
--
-- Note for whoever reads the linter afterwards: newly created private tables
-- will appear under rls_enabled_no_policy at INFO level. That is the intended
-- state for tables reached only through SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION private.auto_enable_rls_on_new_tables_v1()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  created record;
begin
  for created in
    select objid, schema_name, object_identity
    from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE'
      and schema_name = 'private'
  loop
    -- skip partitions; they follow the parent table's setting
    if exists (
      select 1 from pg_class c
      where c.oid = created.objid and c.relispartition
    ) then
      continue;
    end if;

    if exists (
      select 1 from pg_class c
      where c.oid = created.objid
        and c.relkind = 'r'
        and c.relrowsecurity = false
    ) then
      execute format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', created.object_identity);
      raise notice 'auto-enabled row level security on %', created.object_identity;
    end if;
  end loop;
end;
$function$;

DROP EVENT TRIGGER IF EXISTS auto_enable_rls_on_new_private_tables;
CREATE EVENT TRIGGER auto_enable_rls_on_new_private_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION private.auto_enable_rls_on_new_tables_v1();
