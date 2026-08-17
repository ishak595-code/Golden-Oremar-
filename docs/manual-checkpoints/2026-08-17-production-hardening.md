# Golden Oremar manual production hardening checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47
Product form factor: Android and iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

## Latest functional frontend head

`67a776d107613cd28d19eac6bacdf2ca2ac5f063`

The newest functional frontend head now includes the native app-shell work, live notification/cart counters, native keyboard coordination, seller onboarding API boundary hardening, nested dialog accessibility, notification read-count synchronization, canonical search URL repair and share-feedback ownership cleanup. State/report-only commits may be newer than this SHA; use this value to identify the latest substantive frontend code checkpoint.

## Latest functional backend head

`8f302a727861099c44cda52b6ce174b84f8318fd`

## Live Supabase reconciliation

Project: `rmfcziawxjgcnxexbrvw`

- Live migration count: 128.
- Latest tracked live migration: `20260817105414_add_server_authoritative_push_badge_count_v3`.
- All 22 migration versions currently present on this feature branch are represented in live Supabase migration history.
- The push claim v3 contract returns the server-authoritative unread, non-expired notification count for provider delivery.
- `push-dispatch` is ACTIVE v3 and constructs APNs badge plus supported Android notification-count payloads from that server count.
- Supabase Security Advisor remains at zero security lints after the latest migration reconciliation.
- Performance Advisor has no blocking lints; unused-index observations remain informational and must not be removed blindly.

## Completed and do not repeat

- Canonical reloadable product, producer and search routes.
- Product sharing with Web Share plus clipboard fallback and a Capacitor-safe public HTTPS origin contract.
- Live configurable home hero and live product/producer/origin trust metrics without fabricated counts.
- Home category filters use slugs; home search covers product, category, producer, origin/village and tags.
- Search category suggestions route by exact slug without mixing the localized category label into the query.
- Browser and Android native back navigation use real route history with StrictMode-safe route-depth tracking.
- Explicit Home navigation clears stale search query/category/producer state.
- Search-results URL now stays canonical when the header query changes or is cleared while the results screen is already open.
- The app shell has no desktop top navigation or hamburger menu. The repository search design is preserved and phone/tablet navigation remains the bottom app bar.
- Header notification badge uses the real Supabase unread count and becomes high-contrast red only when unread notifications exist.
- Header and bottom cart badges use the real server total item count, not the number of distinct cart rows.
- Checkout quantity changes, removals and clear-cart operations propagate the latest cart snapshot back to the app shell counter.
- Foreground native push receipt refreshes the unread count without forcing navigation.
- A first authenticated cold-start hydration reporting zero unread notifications now clears stale delivered native notifications, as does a later transition to zero.
- Single-read and mark-all-read notification actions recheck the server-authoritative unread count before updating the app-level badge.
- Native keyboard visibility hides the bottom navigation while text input owns the lower screen; Android/iOS keyboard resize/backdrop settings are configured.
- APNs/FCM launcher count payload construction is server-authoritative. Real provider credentials remain external and are not fabricated.
- Coarse-pointer Android/iOS controls receive a 44px minimum touch target floor for primary buttons/selects and icon-only controls.
- Accessible dialogs support a topmost-dialog stack, nested focus containment, Escape handling and focus restoration.
- Mobile admin sidebar uses accessible dialog focus management.
- Seller product entry validates price, compare-at price, stock, shipping weight and image MIME/size/count before mutation; destructive archive uses an accessible confirmation dialog.
- Producer onboarding RPC boundaries validate UUIDs, enums, country/coordinate/text limits, planned-product quantities, fulfillment/source models and document storage paths before Supabase mutations.
- Account profile validates name, phone, locale and avatar boundaries. Account security validates password boundaries and uses accessible confirmations for destructive multi-device actions.
- `CatalogProductCard` no longer shows a second local share-success message when the parent share handler already owns truthful success/failure feedback.
- No fake payment provider, OAuth provider, push credential, store-signing credential or shipping weight was introduced.

## Remaining code review targets

1. Surface producer-onboarding document MIME/size validation immediately at file selection so the UI matches the already-hardened upload API before submit.
2. Perform only a final targeted account/seller/admin screen-reader and resilience scan for newly introduced regressions. Do not rebuild already completed modules.
3. Re-run the mobile quality gate once GitHub can actually allocate runners. Do not consume repeated Actions runs while billing/minute allocation remains blocked.

## External blockers

Do not fabricate or bypass these:

- GitHub Actions runner allocation is blocked by the account billing/spending-limit condition.
- Production business/support legal identity.
- Production payment provider and merchant credentials.
- Production Google/Facebook OAuth configuration.
- Production FCM/APNs credentials.
- Android/iOS store signing and release credentials.
- Real public HTTPS origin for `VITE_PUBLIC_APP_ORIGIN`.
- Fourteen perishable active variants still require real verified shipping weights; do not invent them.

The latest frontend head must not be described as CI-green until the mobile quality workflow actually allocates runners and executes on the latest functional code.
