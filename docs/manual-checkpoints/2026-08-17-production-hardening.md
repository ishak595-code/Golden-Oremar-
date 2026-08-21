# Golden Oremar manual production hardening checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47
Product form factor: Android and iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

## Latest functional frontend head

`c8bef1cf6019185fcf6ee33ab6fb72bbf6703663`

This is the latest substantive frontend hardening checkpoint. It includes the native app-shell rules, live notification/cart counters, push badge behavior, seller/account truthfulness work and the targeted admin screen-reader/resilience pass across vendor review, review moderation, notifications, orders, returns, products, events, categories and content. State/report-only commits may be newer than this SHA.

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
- Public tables with RLS disabled: 0.
- Public or anon executable SECURITY DEFINER functions found by the targeted security recheck: 0.
- Public/storage policies using legacy `auth.role()`: 0.
- Performance Advisor has no blocking lints; unused-index observations remain informational and must not be removed blindly.

## Completed and do not repeat

- Canonical reloadable product, producer and search routes.
- Product sharing with Web Share plus clipboard fallback and a Capacitor-safe public HTTPS origin contract.
- Live configurable home hero and live product/producer/origin trust metrics without fabricated counts.
- Home category filters use slugs; home search covers product, category, producer, origin/village and tags.
- Search category suggestions route by exact slug without mixing the localized category label into the query.
- Search-results URL stays canonical when the header query changes or is cleared while results are open.
- Browser and Android native back navigation use real route history with StrictMode-safe route-depth tracking.
- Explicit Home navigation clears stale search query/category/producer state.
- The app shell has no desktop top navigation or hamburger menu. The repository search design is preserved and phone/tablet navigation remains the bottom app bar.
- The release audit fails if a desktop top menu or hamburger main-app navigation returns, if the persistent bottom app navigation disappears, or if live notification/cart badge bindings are broken.
- Header notification badge uses the real Supabase unread count and becomes high-contrast red only when unread notifications exist.
- Header and bottom cart badges use the real server total item count, not the number of distinct cart rows.
- Checkout quantity changes, removals and clear-cart operations propagate the latest cart snapshot back to the app shell counter.
- Foreground native push receipt refreshes the unread count without forcing navigation.
- A first authenticated cold-start hydration reporting zero unread notifications clears stale delivered native notifications, as does a later transition to zero.
- Signed-out sessions clear delivered notifications belonging to the prior customer.
- Single-read and mark-all-read notification actions recheck the server-authoritative unread count before updating the app-level badge.
- Native push listener initialization is single-flight and pending push actions are preserved in a bounded queue.
- Native keyboard visibility hides the bottom navigation while text input owns the lower screen; Android/iOS keyboard resize/backdrop settings are configured.
- APNs/FCM launcher count payload construction is server-authoritative. Real provider credentials remain external and are not fabricated.
- Coarse-pointer Android/iOS controls receive a 44px minimum touch target floor for primary buttons/selects and icon-only controls.
- Accessible dialogs support a topmost-dialog stack, nested focus containment, Escape handling and focus restoration.
- Mobile admin sidebar uses accessible dialog focus management.
- Seller product entry validates price, compare-at price, stock, shipping weight and image MIME/size/count before mutation; destructive archive uses an accessible confirmation dialog.
- Producer onboarding RPC boundaries validate UUIDs, enums, country/coordinate/text limits, planned-product quantities, fulfillment/source models and document storage paths before Supabase mutations.
- Producer onboarding document selection immediately rejects unsupported MIME types, empty files, files over 20 MB and more than six selected documents before upload.
- Producer document storage extension is derived from the validated MIME type instead of trusting a filename extension.
- Producer finance payout history has resilient 20-row pagination, duplicate-safe merge, retry behavior and screen-reader loading/error status.
- Seller dashboard finance summary does not invent TRY or zero values when backend money/currency data is invalid.
- Account overview cannot erase a valid live red unread badge with malformed summary data; invalid summary counts render as unverified instead of fake zeroes.
- Account profile validates name, phone, locale and avatar boundaries. Account security validates password boundaries and uses accessible confirmations for destructive multi-device actions.
- `CatalogProductCard` does not show a second local share-success message when the parent share handler already owns truthful success/failure feedback.
- Admin vendor review, review moderation, notification audience, order, return and product dialogs use topmost focus containment, Escape handling, focus restoration and active-dialog error delivery.
- Admin event editor and destructive event/reservation confirmations now use accessible dialog containment. Invalid event dates and malformed guest/count metrics are not silently rendered as plausible values.
- Admin category editor and archive confirmation now use accessible dialog containment, bounded search, assertive errors and defensive category/count rendering.
- Admin content editor and archive confirmation now use accessible dialog containment, bounded search, assertive errors and defensive locale/date/count rendering.
- Admin notification audience count rejects malformed/negative/non-integer server counts and broadcast IDs. Audience-count errors are isolated from general send/load errors so stale alerts cannot silently poison the form.
- Admin notification specific-user search keeps the already-selected target visible while filtering, and send is disabled whenever audience count cannot be verified.
- Checkout does not invent payment, shipping or total values before the server preview is verified.
- Shared money rendering does not turn invalid minor units/currency into a fake zero amount.
- No fake payment provider, OAuth provider, push credential, store-signing credential or shipping weight was introduced.

## Remaining code and release targets

1. Do not rebuild modules listed above. Continue only if a new concrete regression is found in the latest branch state.
2. Re-run the Android/iOS mobile quality gate once GitHub can actually allocate runners. Do not consume repeated Actions attempts while billing/minute allocation remains blocked.
3. After the first real runner allocation, require release architecture audit, TypeScript check, production build, Capacitor sync reproducibility, Android release bundle and iOS simulator compilation on the latest functional head before merge.

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
