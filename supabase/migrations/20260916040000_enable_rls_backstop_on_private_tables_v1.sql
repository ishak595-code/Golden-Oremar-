-- Defense in depth: enable row level security on private-schema tables that
-- had it switched off.
--
-- Why this is not urgent, and why it is still worth doing:
--   Today these tables are already unreachable from the API. The anon role has
--   no USAGE on the private schema at all, and the authenticated role holds
--   exactly one table grant in private (user_roles, which is separately
--   protected by its own RLS policy restricting a caller to their own
--   unexpired roles). Everything else is reached only through SECURITY DEFINER
--   functions. So this closes no live vulnerability.
--   What it does close is the absence of a second lock. With RLS off, the only
--   thing standing between a future accidental GRANT and a full table read is
--   that nobody has made that mistake yet. With RLS on and no policy, the
--   default answer to any non-bypassing role becomes "deny", so such a mistake
--   fails safe instead of leaking.
--
-- Why this is safe to apply to a live system, verified before running:
--   - every private table and every SECURITY DEFINER function in private is
--     owned by postgres, and a table owner is exempt from RLS unless FORCE is
--     set, so the application's function layer is unaffected
--   - service_role, used by Edge Functions for payments, transactional email
--     and push delivery, carries rolbypassrls, so those paths are unaffected
--   - ENABLE is used deliberately, never FORCE. FORCE would subject the owner
--     to RLS as well and, with no policies present, would break every
--     SECURITY DEFINER function that touches these tables
--
-- Tables that already had RLS enabled are left alone, including the sixteen
-- that intentionally use FORCE together with explicit policies.
--
-- Expected advisor behaviour after this runs: Supabase's linter reports
-- rls_enabled_no_policy at INFO level for each table touched here. That is the
-- intended end state, not a regression - "no policy" is how a deny-by-default
-- table is expressed. These tables are meant to be reachable only through the
-- SECURITY DEFINER function layer.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      target.schema_name, target.table_name
    );
  END LOOP;
END
$$;
