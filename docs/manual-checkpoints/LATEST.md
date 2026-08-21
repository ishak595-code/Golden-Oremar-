# Golden Oremar latest checkpoint

Date: 2026-08-19
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json` and:

`docs/manual-checkpoints/2026-08-19-payment-storage-preferences-reconciliation.md`

Older detailed checkpoints remain valid in Git history and must not be repeated or restored over this checkpoint.

## Current source of truth

Latest functional application code checkpoint before the state-document commit:

`9c5c263f450da93dc4b761b267ef03b47163885b`

Current state-document checkpoint created immediately after that code:

`433d741e019665e137a3bbb37cc4a8e37629dc69`

The old `953da...`, `983d...`, 130-migration and v4 snapshots are historical only. Do not use them as the current implementation starting point.

## Canonical runtime architecture

The current branch intentionally has one runtime path for each major responsibility:

- customer account: `AccountCenter`
- seller operations: `AccountCenter -> SellerPanel -> producer feature modules`
- admin operations: `App` server-verified admin gate -> `AdminPage` -> `AdminLayout` and admin modules
- accessible modal/dialog behavior: `src/features/accessibility/useAccessibleDialog.ts`
- Android/iOS voice search: existing App header speech UX -> `src/native.ts` adapter -> platform speech implementation
- public storefront: validated Supabase storefront config + live catalog -> `HomeSection`
- checkout: strict cart boundary -> `create_customer_order_v5`

Do not create a second seller panel, admin role gate, speech implementation, account dialog hook, storefront fallback source or checkout entrypoint.

## 2026-08-19 canonical cleanup completed

### Storefront and home UI

- `HomeSection` now requires validated storefront interface content instead of silently substituting hard-coded hero copy.
- server `salesReadiness.message` is rendered directly when live sales are blocked.
- a normal non-featured product is no longer promoted into the featured slot merely because it is sellable.
- a missing producer/origin context is not replaced with the Golden Oremar brand.
- missing verified product images are distinguished from active loading. The UI no longer says images are loading forever when Storage has no real object.
- home catalog loading uses a real skeleton instead of briefly presenting a false empty-result state.
- category and featured headings use the validated storefront configuration.
- existing native search, microphone, notification and cart shell behavior was preserved.

### Theme and contrast

- theme-aware foreground tokens now exist for brand gold and brand green backgrounds.
- Emerald, Ruby and Champagne gold accents were darkened enough for usable light-theme text contrast.
- Obsidian/Dark theme uses dark foreground text on the bright green and gold accent fills where white would be too low contrast.
- a compatibility bridge keeps existing `bg-brand-gold` / `bg-brand-green` utility combinations contrast-safe while individual screens are incrementally migrated to semantic `text-brand-on-*` utilities.

### Seller and admin deduplication

- `SellerPanel` no longer imports the already-deleted `useDialogA11y` wrapper. It uses the canonical `useAccessibleDialog` hook.
- seller destructive confirmation now has canonical focus trap, Escape handling, body lock and focus restoration through that shared hook.
- the duplicate producer runtime path was removed from `AdminPage`.
- the duplicate vendor/seller menu path was removed from `AdminLayout`.
- seller operations remain under AccountCenter/SellerPanel only.
- `LegacyAdminEntry.tsx`, which only re-exported `AdminPage`, was removed.
- `App.tsx` now lazy-loads the canonical `AdminPage` directly.
- the obsolete `currentUser` prop on `AdminPage` was removed.
- the App shell continues to use the server-authoritative `getAdminSessionStatus()` gate before rendering admin.

### Regression guards

`scripts/release-audit.mjs` now fails if any of the following return:

- `LegacyAdminEntry.tsx`
- `useDialogA11y.ts` or a SellerPanel call to it
- a producer runtime/menu path inside AdminPage/AdminLayout
- App loading the legacy admin wrapper
- the misspelled `Capitor` runtime identifier
- silent hard-coded storefront hero fallback copy
- arbitrary non-featured spotlight promotion
- false producer fallback to the Golden Oremar brand
- removed transitional workflows and patch tooling
- retired customer order RPC v1-v4 calls
- missing semantic accent-foreground theme guards

## Backend reconciliation

- Supabase project: `rmfcziawxjgcnxexbrvw`
- live migration count: **151**
- latest confirmed live migration: `20260818232517_verify_producer_product_gallery_assets`
- the current hardening-series migration files are present on this branch
- Security Advisor last confirmed state: **0 lints** after migration 151
- current customer order entrypoint: `create_customer_order_v5`, authenticated only
- `create_customer_order`, v2, v3 and v4 have no authenticated or anon execute privilege
- Edge Functions: `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3, `payment-method-vault` v1
- `payment-method-vault` requires JWT and its source is present under `supabase/functions/payment-method-vault`

Do not claim the repository-only `20260819000204_harden_producer_traceability_country_and_review_status.sql` migration is confirmed live unless Supabase live history is re-read and proves it.

## Payment, gift and preference checkpoint

- saved card/payment-method metadata persists server-side without exposing reusable provider secrets to the client or admin order snapshot
- checkout and gift order paths use order v5 with the selected saved payment method when supplied
- payment card enrollment uses the live `payment-method-vault` Edge Function and remains fail-closed until real merchant/provider configuration is present
- gift note, occasion, presentation style, sender/recipient and price-hiding metadata persist with the order
- admin order operations can see gift instructions and only masked payment metadata
- theme and notification-sound preferences persist to the user account; local storage is only the fast-start copy
- runtime theme changes synchronize React/native UI state through the device-theme event path

## Real asset integrity checkpoint

Last confirmed live storage observation:

- `catalog-public`: 0 objects
- `content-public`: 0 objects

Database image paths therefore do **not** count as real assets. The application fails closed:

- public catalog/search/category/home/product-detail/producer-profile RPCs do not return a catalog image path unless the object exists in `catalog-public`
- content/event public RPCs do not return image paths unless the object exists in `content-public`
- admin product approval requires a real primary catalog object, not only a `product_images` row
- producer product gallery returns only real existing storage objects
- producer catalog uploads require the authenticated owner of a verified active producer and the `{producerId}/products/...` prefix
- producer overwrite/update access for existing public objects is removed
- producer delete is limited to the producer's own unused object

Do not invent or generate replacement product/content photographs merely to clear this blocker. Real approved assets must be supplied or intentionally sourced under a separate approved content workflow.

## Mobile shell invariants

- no desktop top navigation
- no main-app hamburger menu
- preserve product/producer/village search in the header
- preserve the existing single microphone/speech path, including native Android/iOS adapter integration
- persistent phone/tablet bottom navigation
- unread notification bell uses the real Supabase unread count and becomes red when nonzero
- cart badge uses total quantity, not line count
- keyboard hides bottom navigation while it owns the lower screen
- no fake price, stock, rating, location, currency, payment state, legal copy, support identity or credentials

## Release state

Do not call the newest head CI-green.

GitHub Actions runner allocation remains blocked by the account billing/minute/spending-limit condition. No new Actions run was triggered during this cleanup.

Last recorded blocked run: `32029478472`.

Previous Android release-bundle and iOS Simulator compilation baselines were green, but they predate the current functional head.

When runner allocation is restored, run exactly one current-head mobile quality gate covering release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS Simulator compile.

Do not merge PR #47 until reachable current-head release gates are green and the user explicitly authorizes merge.

## External production blockers

- real `catalog-public` product assets
- real `content-public` content/event assets
- legal business/support identity
- final applicable legal copy
- production payment merchant/provider credentials
- production Google/Facebook OAuth configuration
- production FCM/APNs credentials
- Play Store/App Store signing and release configuration
- real public HTTPS share origin
- fourteen active perishable-variant real shipping weights

## Next safe block

Continue from the current branch and current checkpoint. Do not repeat the completed seller/admin/storefront/theme cleanup.

Next scan order:

1. AccountCenter legacy route aliases and account data-contract normalization.
2. Canonical product-card visual/accessibility/theme pass without creating a second card component.
3. Search/filter/category consistency against the canonical card and live catalog contracts.
4. Admin data-contract and interaction scan for remaining permissive fallbacks or dead wrappers.
5. Record the next checkpoint before changing architectural direction.

Do not create an automation and do not trigger GitHub Actions while runner allocation remains blocked.
