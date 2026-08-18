# Golden Oremar latest checkpoint

Date: 2026-08-18
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json` and the latest detailed checkpoint:

`docs/manual-checkpoints/2026-08-18-catalog-auth-gift-native-hardening.md`

Older full-account checkpoints remain valid and should not be repeated:

- `docs/account-audit/2026-08-17-account-tab-production-audit.md`
- `docs/manual-checkpoints/2026-08-17-account-cart-final-polish.md`
- `docs/account-audit/2026-08-17-account-complete-surface-pass.md`

## Latest functional code checkpoint

Latest functional code head before state/report/checkpoint documentation commits:

`b74aa36719b71bd6f984a292dbe203f8ce73054f`

The newest completed hardening pass covers:

- central strict live catalog response validation;
- product/card/search/category/home/producer price, currency, stock, rating and origin truthfulness;
- purchase locking when price/currency/variant/tracked stock cannot be verified;
- authentication input/session/live-role boundary validation;
- accessible registration/login tabs and password confirmation;
- preservation of a previously verified session snapshot across transient hydration failures with network-restored revalidation;
- gift order removal of fake phone/default-country behavior;
- explicit shipping country required both client-side and server-side;
- retirement of legacy authenticated customer-order RPC entrypoints;
- gift-order response financial completeness checks;
- removal of runtime Google Fonts dependency from the Android/iOS app shell;
- release-audit guard against remote stylesheet/font regressions.

## Mobile shell invariants

These are non-negotiable unless the user explicitly changes the product direction:

- no desktop top navigation;
- no main-app hamburger menu;
- preserve product/producer/village search in the header;
- persistent phone/tablet bottom navigation;
- unread notification bell uses real Supabase unread count and becomes red when nonzero;
- malformed unread payload cannot erase a previously verified badge;
- cart badge uses total item quantity, not line count;
- checkout/cart mutations keep app-shell count synchronized;
- keyboard temporarily owns the lower screen and bottom navigation hides while open;
- no fake price, stock, rating, location, currency, payment provider, legal text, support identity or credentials.

## Catalog truthfulness invariants

- missing price never becomes 0;
- missing currency never becomes TRY;
- invalid tracked/seasonal stock locks purchase;
- invalid rating/review count does not become 0;
- product origin is never inferred from producer village/district/province;
- price filters use verified catalog currency or are disabled;
- only HTTPS external assets or safe storage paths are accepted;
- malformed pagination totals/rows fail safely.

## Authentication invariants

- e-mail, password, display name, phone and locale are bounded before auth mutations;
- live role contract includes `customer`, `producer`, `support`, `content_editor`, `operations`, `admin`, `super_admin`;
- only admin/super_admin can satisfy app admin mode;
- server profile user ID must match the Supabase auth session user ID;
- malformed live locale does not silently become Turkish;
- an already verified user is not visually logged out only because a later profile hydration request failed transiently;
- network restore retries session verification.

## Gift and checkout invariants

- gift delivery country starts blank and must be explicit two-letter ISO;
- gift delivery phone is real and required, no generated fallback number;
- gift purchase requires valid variant, price, currency, availability and tracked stock;
- missing order financial fields are rejected, not replaced with zero;
- payment verification pending is never displayed as paid;
- current authenticated public customer-order entrypoint is `create_customer_order_v4` only;
- legacy `create_customer_order`, v2 and v3 are not externally executable by authenticated/anon/public roles.

## Backend checkpoint

- Supabase project: `rmfcziawxjgcnxexbrvw`
- live migration count: 130
- latest migration: `20260818211654_retire_legacy_customer_order_rpc_entrypoints`
- latest two migrations are recorded in the repo and live history
- Security Advisor after migration 130: 0 lints
- recorded edge functions: `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3
- 14 active perishable variants still require real shipping weights; do not fabricate them

## Native offline checkpoint

The application stylesheet no longer imports Google Fonts. System font stacks are used so native startup typography does not require a remote CSS/font request. `release-audit.mjs` blocks Google Fonts and remote stylesheet imports from returning.

The app does not currently include a native speech-recognition plugin. Existing voice-search code checks runtime Web Speech support and reports unsupported devices. Do not claim universal Android/iOS voice recognition until a real native implementation is intentionally added and tested.

## Release state

Do not call the newest head CI-green.

GitHub Actions runner allocation is still blocked by the account billing/minute/spending-limit condition. No new Actions run was intentionally triggered during this hardening pass.

Last recorded blocked run: `32029478472`, with `verify-ios` and `verify-web-android` receiving no executed steps/no runner.

Previous Android release-bundle and iOS Simulator compilation baselines were green, but they predate the newest functional head.

When runner allocation is restored, run exactly one meaningful current-head mobile quality gate: release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS Simulator compile.

Do not merge PR #47 until reachable release gates are green and the user explicitly authorizes merge.

External production values must not be fabricated: legal business/support identity, final applicable legal copy, payment merchant/provider credentials, Google/Facebook production OAuth configuration, FCM/APNs credentials, store signing/release credentials, real public HTTPS share origin and remaining real product shipping weights.
