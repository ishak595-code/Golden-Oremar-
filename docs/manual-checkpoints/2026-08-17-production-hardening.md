# Golden Oremar manual production hardening checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47

## Latest functional frontend head

`7b6a5858dd5974f05468186d45b9fc7a4c09d8d7`

This head includes explicit Home navigation search-state reset on top of the canonical deep-link, browser/native history, live home catalog, search overlay, sharing, seller/admin/account accessibility and input-hardening work recorded earlier in `PROJECT_STATE.json` and `TEST_REPORT.json`.

## Live Supabase reconciliation

Project: `rmfcziawxjgcnxexbrvw`

- Live migration count: 127.
- Latest tracked live migration: `20260817101553_add_public_checkout_payment_readiness_v1`.
- The prior checkout-readiness migration had already produced its schema/data effects but was missing from Supabase migration history. It was applied idempotently through Supabase migration tooling, then the repository migration filename was aligned to the tracked live version.
- All 21 migration versions currently present on this feature branch were compared against `supabase_migrations.schema_migrations` and are represented live.
- Supabase Security Advisor was re-run after reconciliation and returned zero security lints.
- Performance Advisor has no blocking lints; remaining unused-index observations are informational and must not be removed blindly.

## Completed in this manual hardening pass

- Canonical reloadable product, producer and search routes.
- Product sharing with Web Share plus clipboard fallback.
- Capacitor-safe navigation URLs and an explicit `VITE_PUBLIC_APP_ORIGIN` requirement so native shares never expose `capacitor://localhost`.
- Live configurable home hero and live product/producer/origin trust metrics without fabricated counts.
- Home category filters compare category slugs rather than localized names.
- Home search includes product, category, producer, origin/village and live catalog tags.
- Search category suggestions route by exact slug without adding the localized category label as a free-text filter.
- Browser and Android native back navigation use real route history with StrictMode-safe route-depth tracking.
- Explicit Home navigation clears stale search query/category/producer route state.
- Mobile admin sidebar uses accessible dialog focus management and focus restore.
- Seller product entry validates price, compare-at price, stock, shipping weight and image MIME/size/count before mutation; destructive archive uses an accessible confirmation dialog.
- Account profile validates name, phone, locale and avatar file boundaries.
- Account security validates password boundaries and uses accessible confirmations for destructive multi-device session actions.
- No fake payment provider, OAuth provider, push credential, store signing credential or shipping weight was introduced.

## Do not repeat

Do not rebuild the above blocks from scratch. Start from this checkpoint plus the newest commit history. Inspect `PROJECT_STATE.json`, `TEST_REPORT.json`, this checkpoint and PR #47 before changing code.

## Remaining code review targets

1. Keep header-search URL state canonical when clearing a query while already on the search-results route.
2. Remove any contradictory local success feedback in `CatalogProductCard` when a parent share handler already owns success/failure messaging.
3. Perform the final producer-onboarding input/file-selection UX hardening only where the existing API validation is not already surfaced client-side.
4. Perform a small final account/seller/admin accessibility and resilience scan for newly introduced regressions only.

## External blockers

Do not fabricate or bypass these:

- GitHub Actions runner allocation is blocked by the account billing/spending-limit condition. Do not repeatedly rerun workflows while this remains blocked.
- Production business/support legal identity.
- Production payment provider and merchant credentials.
- Production Google/Facebook OAuth configuration.
- Production FCM/APNs credentials.
- Android/iOS store signing and release credentials.
- Real public HTTPS origin for `VITE_PUBLIC_APP_ORIGIN`.

The latest frontend head must not be described as CI-green until the mobile quality workflow can actually allocate runners and execute on the latest head.
