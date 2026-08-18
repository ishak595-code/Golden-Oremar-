# Golden Oremar latest checkpoint

Date: 2026-08-19
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json` and:

`docs/manual-checkpoints/2026-08-19-payment-storage-preferences-reconciliation.md`

Older detailed checkpoints remain valid in Git history and must not be repeated or overwritten.

## Current source of truth

Latest functional application code checkpoint before state/report documentation commits:

`983d6c1350e4e46259c68cf948edb7956ebb519e`

The previous `PROJECT_STATE.json` and `TEST_REPORT.json` snapshots are preserved by Git history and their prior blob SHAs are recorded inside the new state/report files. Do not restore the old 130-migration/v4 values over the current state.

## Backend reconciliation

- Supabase project: `rmfcziawxjgcnxexbrvw`
- live migration count: **151**
- latest migration: `20260818232517_verify_producer_product_gallery_assets`
- the current hardening-series migration files are present in `supabase/migrations` on this branch
- Security Advisor: **0 lints** after migration 151
- current customer order entrypoint: `create_customer_order_v5`, authenticated only
- `create_customer_order`, v2, v3 and v4 have no authenticated or anon execute privilege
- Edge Functions: `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3, `payment-method-vault` v1
- `payment-method-vault` requires JWT and its source is present under `supabase/functions/payment-method-vault`

## Payment, gift and preference checkpoint

- saved card/payment-method metadata is persisted server-side without exposing reusable provider secrets to the client or admin order snapshot
- checkout and gift order paths use order v5 with the selected saved payment method when supplied
- payment card enrollment is implemented through the live `payment-method-vault` Edge Function and remains fail-closed until real merchant/provider configuration is present
- gift note, occasion, presentation style, sender/recipient and price-hiding metadata persist with the order
- admin order operations can see gift instructions and only masked payment metadata
- theme and notification-sound preferences persist to the user account; local storage is only the fast-start copy
- runtime theme changes synchronize React/native UI state through the device-theme event path

## Real asset integrity checkpoint

Live storage observation at this checkpoint:

- `catalog-public`: 0 objects
- `content-public`: 0 objects

Database image paths therefore do **not** count as real assets. The application now fails closed:

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
- persistent phone/tablet bottom navigation
- unread notification bell uses the real Supabase unread count and becomes red when nonzero
- cart badge uses total quantity, not line count
- keyboard hides bottom navigation while it owns the lower screen
- no fake price, stock, rating, location, currency, payment state, legal copy, support identity or credentials

## Release state

Do not call the newest head CI-green.

GitHub Actions runner allocation remains blocked by the account billing/minute/spending-limit condition. No new Actions run should be triggered while this condition persists.

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

Continue the manual account/seller/admin production accessibility and data-contract scan from the current branch. Do not repeat completed work, do not create an automation, and do not trigger GitHub Actions while runner allocation remains blocked.
