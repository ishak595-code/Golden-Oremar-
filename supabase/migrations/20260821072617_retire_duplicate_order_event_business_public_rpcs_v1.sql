-- Keep the currently consumed stable public APIs while retiring duplicate or
-- superseded public aliases. Preserve private implementation chains still in use.

-- management_orders_snapshot_v2 is the client-facing stable endpoint and already
-- delegates to private.management_orders_snapshot_v4().
drop function if exists public.management_orders_snapshot_v1();
drop function if exists public.management_orders_snapshot_v3();
drop function if exists public.management_orders_snapshot_v4();
drop function if exists private.management_orders_snapshot_v1();

-- Event v2 is independent from v1 and is the current client contract.
drop function if exists public.management_upsert_event_v1(text, jsonb);
drop function if exists private.management_upsert_event_v1(text, jsonb);

-- Registered-business v2 contracts fully supersede the legacy brand-only v1 APIs.
drop function if exists public.super_admin_get_business_identity_v1();
drop function if exists private.super_admin_get_business_identity_v1();
drop function if exists public.super_admin_update_business_identity_v1(text, text, text);
drop function if exists private.super_admin_update_business_identity_v1(text, text, text);
