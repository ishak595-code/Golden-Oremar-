# Golden Oremar Implementation Status

Last updated: 2026-08-19

This document records the current production state only. Detailed persistence rules live in `PERSISTENCE_AND_CHANGE_LEDGER.md`; applied schema history is tracked canonically by live `supabase_migrations.schema_migrations` and repository `supabase/migrations/`.

## Current phase

Android/iOS production hardening with customer, seller and admin runtime consolidation. Completed customer and seller features are not being rebuilt. Current work is eliminating duplicate runtime paths, tightening live Supabase contracts, removing invented client fallbacks, reconciling migrations and locking regressions into release audits.

## Canonical runtime architecture

- App target: Android/iOS Capacitor application.
- Customer data/auth/storage/RPC backend: live Supabase project `rmfcziawxjgcnxexbrvw`.
- Seller path: `AccountCenter -> SellerPanel -> producer feature modules`.
- Admin path: server-verified admin gate -> `AdminPage` -> `AdminLayout` -> admin modules.
- Dialog engine: `src/features/accessibility/useAccessibleDialog.ts`.
- Voice search: existing header SpeechRecognition UX -> `src/native.ts` adapter -> native Android/iOS speech implementation.
- Customer checkout: `create_customer_order_v5` only. Older authenticated order entrypoints are retired.
- Release audit: `npm run audit:release` runs both the general release audit and the admin data-contract audit.

## Completed mobile shell and accessibility hardening

- Desktop top navigation and main hamburger shell are removed from the mobile application runtime.
- Phone/tablet bottom navigation is persistent and safe-area aware, and hides while the native keyboard is open.
- Header unread notification count and cart quantity are server-backed, not local guesses.
- Native speech bridge exists on Android and iOS without a duplicate external speech runtime.
- Shared interactive controls preserve accessible names, visible focus and mobile touch targets.
- Canonical accessible dialogs are reused across account, seller and admin flows instead of maintaining duplicate focus-trap systems.
- Light/dark theme state uses semantic foreground tokens so green/gold accent surfaces do not create low-contrast text combinations.

## Completed customer trust and commerce hardening

- Catalog price, currency, stock, rating and origin data fail closed at client boundaries.
- Category/search/home customer surfaces reuse the canonical product card.
- Live stock reductions clamp selected product quantity instead of allowing stale over-selection.
- Home merchandising uses validated Supabase storefront copy and real catalog state. Missing server copy is not replaced with silent hardcoded slogans.
- Featured merchandise is not fabricated by promoting an arbitrary sellable product.
- Missing verified Storage objects produce an explicit no-image state instead of broken public URLs.
- Real primary catalog Storage object is required before admin product publication.
- Cart, checkout preview, saved-address, gift and saved-payment-method flows retain server-authoritative totals and safe masked payment metadata.
- Delivery country is explicit rather than defaulted to TR.
- Theme and notification-sound preferences persist to the user account with local fast-start state only.

## Completed seller architecture hardening

- Duplicate seller navigation/runtime paths were removed from admin.
- `SellerPanel` uses the canonical accessible dialog hook.
- Producer product, order, finance and profile modules remain under the seller path instead of being duplicated inside admin.
- Producer catalog Storage policies require verified active ownership and prevent overwrite of existing catalog objects.
- Seller product gallery APIs return only real Storage objects.
- Producer origin verification is separate from identity verification.
- Producer lifecycle is preserved as `pending`, `active`, `suspended`, `rejected`, `closed`. Pending/rejected/closed are never silently presented as active.

## Completed admin contract hardening

- `LegacyAdminEntry.tsx` is removed. App loads canonical `AdminPage` directly.
- Admin dashboard is admin-only and no longer role-switches into a second producer dashboard.
- Category administration validates UUID, name, slug, sort order, active state and product counts without `0` or invented-name masking.
- Event administration validates event and reservation identifiers, lifecycle states, dates, reservation codes and guest counts without invented guest/event defaults.
- Return administration validates currency, minor-unit amounts, return/refund states, requested quantities, evidence paths and mutation results without fake TRY, zero or placeholder product/customer values.
- Inventory administration validates price, currency, stock arithmetic, producer lifecycle, SKU and update version.
- Live `admin_list_inventory_v1` was repaired because it referenced nonexistent `product_variants.deleted_at`.
- Producer administration now preserves the full live lifecycle instead of collapsing all non-suspended states into active.
- Producer application administration validates KYC, document, sourcing, fulfillment, organic-claim and commitment contracts.
- Admin producer-application snapshot now carries structured country, province, district and village provenance.
- Expired producer documents remain `expired`; they are not shown as pending.
- Private producer-document and return-evidence signed URLs are validated as HTTPS before exposure to the admin UI.
- Admin content, finance, user and notification boundaries previously received the same fail-closed treatment.

## Live Supabase state

Verified 2026-08-19:

- Applied migrations: **154**
- Latest migration: `20260819055617_extend_admin_producer_application_location_snapshot`
- Latest Security Advisor check after current DDL changes: **0 security lints**
- Current hardening migration files are mirrored under `supabase/migrations/`.
- `catalog-public` and `content-public` had no real public objects at the last asset checkpoint, so customer surfaces intentionally fail closed rather than rendering broken paths.

## Release validation state

The newest branch head is **not** claimed CI-green.

GitHub Actions runner allocation remains blocked by the account billing/minute/spending-limit condition recorded on this PR, so no new Actions run is being triggered during this work. Previous Android release bundle and iOS Simulator build results are older baselines, not proof for the current head.

When runner allocation is restored, one current-head mobile quality gate must cover:

- release audits
- TypeScript `tsc --noEmit`
- production Vite build and bundle budget
- Capacitor Android/iOS sync reproducibility
- Android release bundle
- iOS Simulator compile on an available Apple toolchain

PR #47 must not be merged until reachable current-head gates are green and the user explicitly authorizes merge.

## External production blockers

The codebase does not fabricate any of these missing production inputs:

- real catalog/content public assets
- final business/support identity
- final applicable legal copy
- production payment merchant/provider credentials
- Google/Facebook production OAuth configuration
- FCM/APNs provider credentials
- Play Store/App Store signing and release configuration
- real public HTTPS share origin
- real shipping weights for active perishable variants

## Next active block

Continue the current branch by checking remaining admin UI layers against the now-strict API contracts, then scan remaining customer/account runtime boundaries for obsolete duplicate paths or fake fallback data. Do not repeat completed seller/admin/storefront architecture work and do not trigger GitHub Actions while runner allocation remains blocked.
