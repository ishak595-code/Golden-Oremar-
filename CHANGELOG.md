# Golden Oremar cumulative development log

## Current checkpoint - 2026-08-16

### Backend
- 78 live Supabase migrations.
- Latest: `20260816041742_add_secure_checkout_preview_v1`.
- Latest: `20260816042124_normalize_customer_cart_variant_options`.
- Supabase Security Advisor: 0 security lints after the cart changes.

### Frontend completed in the cumulative package
- Supabase Auth/session customer path; hard-coded role escalation removed.
- AccountCenter: profile, private avatar, addresses, orders, favorites, followed producers, gifts, payment activity, notifications, settings, support, seller entry.
- Real gift order flow using checkout v4.
- Real Supabase cart and checkout flow.
- Delivery-address selection and manual address fallback.
- Server-side shipping, coupon and automatic promotion preview.
- Safe cumulative App.tsx patch scripts.

### Explicitly not faked
- No raw card/CVV storage.
- No payment marked successful before provider verification.
- No invented international shipping price.
- No invented certified-organic badge or lot traceability.

### Next frontend block
- Real catalog/search application wiring using the already-existing Supabase search RPCs.
- Then remaining product detail/favorites global wiring and native mobile polish.

## 2026-08-16 - cumulative frontend migration continuation

- Added server-authoritative checkout preview and cart option normalization.
- Migrated categories, home catalog, autocomplete/search, product detail and public producer profiles to Supabase.
- Replaced fake voice-search fallback and unrelated hard-coded origin filters.
- Added real public contact and event screens using secured Edge Functions.
- Updated event reservations so authenticated users are linked to their profile while guest reservations remain supported.
- Added double-opt-in newsletter account controls.
- Migrated health guides, product-health information and recipes to published Supabase content entries.
- Added private customer content favorites.
- Removed 34 random Picsum placeholder images from published health/recipe content.
- Added public storefront configuration and truthful launch-readiness messaging.
- Retired migrated Firestore customer/public listeners while preserving temporary legacy admin compatibility.
- Replaced legacy Firebase seller onboarding with the secure producer onboarding v4 contract.
- Added truthful village/manual-location suggestions without inventing legacy structured villages.
- Added producer product management, moderation-aware edits, stock/image fields and own-product archive support.
- Added producer profile editing and admin-reviewed verified-origin change requests.
- Added verified-purchase-only customer review center with private review media.
- Live Supabase schema now contains 90 migrations; latest Security Advisor run reports 0 lints.

## 2026-08-16 - secure admin Supabase continuation and Node retirement

- Migrated campaign administration from local `/api` endpoints to the protected Supabase `admin_list_campaigns` and `admin_upsert_campaign` RPC contracts.
- Corrected the historical campaign-unit bug: percentage discounts are now converted between human percentages and backend basis points, while fixed discounts and minimum basket amounts are converted between TRY and minor units at one typed API boundary.
- Added live product/category campaign targeting, scheduled/active/paused/ended states, free-shipping campaigns, usage limits, mobile cards, accessible controls and explicit backend error handling.
- Migrated finance administration to `admin_finance_report`, including verified gross sales, refunds, net sales, commission, estimated vendor payout, mobile/desktop presentation and CSV export.
- Migrated review moderation to `admin_list_reviews` and `admin_moderate_review_v1`, preserving verified-purchase state and the real published/rejected/hidden moderation lifecycle.
- Removed the obsolete local Express/SQLite runtime and its reset/test scripts after CI proved that no production `/api` callers remained.
- Removed server-only dependencies including Express, better-sqlite3, bcryptjs, jsonwebtoken, Stripe SDK, CORS and dotenv from the application package.
- Switched local development to Vite directly.
- One-shot retirement CI passed dependency installation, legacy caller scan, changed-admin TypeScript gate and production build before committing the runtime removal.
- Remaining work is intentionally not mislabeled as complete: legacy admin DataContext/Firestore surfaces still require staged Supabase migration, and mobile release hardware/signing checks remain separate release gates.
