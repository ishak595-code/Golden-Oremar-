# Golden Oremar 2026-08-18 production hardening checkpoint

Branch: `agent/admin-supabase-retire-node`
PR: #47
Product: Android/iOS application. React/Vite is only the Capacitor UI layer.

This checkpoint continues after the complete 2026-08-17 Hesabım, cart, events, health and contact pass. Do not repeat those completed blocks unless a new concrete regression is found.

Latest functional code head before state/report documentation commits:

`b74aa36719b71bd6f984a292dbe203f8ce73054f`

## Catalog truthfulness and purchase safety

The public catalog path was re-audited from backend response boundary through home, categories, search, product detail and producer profile.

Completed:

- `CatalogProductCard.tsx` no longer turns malformed/missing price into 0 or missing currency into TRY.
- Tracked/seasonal stock must be a verified nonnegative integer. Invalid stock locks quantity and purchase actions.
- A verified variant reference is required before adding to cart or starting a gift flow.
- Invalid rating/review values do not become fake zero values.
- `PublicProducerScreen.tsx` no longer turns missing producer location into `Türkiye` and no longer borrows producer village/district/province as a product's origin.
- Public producer product price/currency/stock/rating/review boundaries are fail-closed.
- `ProductDetailScreen.tsx` requires real variant, price, currency, availability and valid tracked stock before purchase or gift actions.
- Product detail location, review, shipping-readiness and certificate presentation no longer invents plausible fallback values.
- `CatalogSearchResults.tsx` and `CategoryDirectoryScreen.tsx` no longer use `price || 0`, `rating || 0`, `reviewCount || 0` or producer-location-as-product-origin fallbacks.
- Search and category pagination totals are validated and malformed rows fail safely.
- `useLiveHomeCatalog.ts` no longer converts missing money/rating/count values into plausible values before React sees them.
- `HomeSection.tsx` uses only verified number/currency values for price filtering and sorting. If a single verified catalog currency cannot be established, the price filter is disabled instead of assuming TL.
- `useCatalogFilterOptions.ts` only produces filters from validated category and explicit product-origin values.
- `src/features/catalog/api.ts` is now the central strict catalog response boundary for product/category/producer/variant IDs, price, currency, stock, rating, review count, pagination and safe public/storage asset URLs.
- The catalog zero-total/nonempty-page consistency edge case is explicitly rejected.

Observed live catalog sample during this pass:

- 42 published catalog products observed through the live catalog RPC.
- 9 public categories observed.
- Product data uses real backend currency/minor-unit values rather than UI constants.

## Authentication hardening

`src/features/auth/api.ts` and `AuthScreen.tsx` were hardened against malformed input and malformed session payloads.

Completed:

- e-mail validation and 254-character boundary;
- password 8-72 character boundary and control-character rejection;
- display name 2-120 character boundary;
- optional phone validation by real digit count;
- supported locale validation for `tr`, `en`, `de`, `fr`, `ku`, `ar`;
- invalid server locale no longer silently becomes Turkish;
- customer session response must contain a valid user UUID and its user ID must match the Supabase session user ID;
- live role contract was checked against the database and aligned to `customer`, `producer`, `support`, `content_editor`, `operations`, `admin`, `super_admin` while retaining legacy compatibility mapping only where the old app surface still needs it;
- admin session stays fail-closed and only admin/super_admin grant admin mode;
- registration has a real password-confirmation field;
- Login/Register uses accessible tab semantics with ArrowLeft/ArrowRight/Home/End keyboard behavior;
- mobile autocomplete/inputmode semantics are present;
- social-login controls remain hidden unless provider configuration is actually enabled.

`useCustomerSession.ts` now preserves only a previously server-verified user snapshot when a later profile/session hydration fails transiently, and retries live verification when the network-restored event fires. A transient API/network error no longer visually logs out an already verified user during the same app session.

## Gift order integrity

The gift flow had two production-breaking truthfulness defaults and both were removed:

- missing recipient phone previously could become a fake fallback number;
- missing destination country could effectively flow into the legacy checkout core's TR default.

Current behavior:

- gift country starts blank and must be an explicit two-letter ISO code;
- real delivery phone is required and validated by digit count;
- gift recipient name, optional email, sender, note, coupon and address fields are bounded;
- variant, verified price/currency, availability and tracked stock must be valid before submission;
- quantity is constrained by verified stock and gift-order maximum;
- accessible loading/form/success dialogs use shared dialog focus containment;
- backdrop/close behavior is mutation-safe;
- successful order presentation states payment verification is pending rather than pretending the payment is captured;
- gift API validates order ID, order number, status, payment status, currency, subtotal, shipping, discount, total, destination country and reservation expiry. Missing `discountMinor` is rejected instead of becoming zero.

## Checkout backend entrypoint hardening

Two live Supabase migrations were applied and matching repository migration files were committed:

1. `20260818211256_require_explicit_shipping_country_in_order_v4`
2. `20260818211654_retire_legacy_customer_order_rpc_entrypoints`

The first migration makes `private.create_customer_order_v4` reject a missing/invalid destination country before calling the older internal order core.

The second migration retires external authenticated/anon/public execution of legacy `create_customer_order`, `create_customer_order_v2` and `create_customer_order_v3` RPC entrypoints. The only authenticated public customer-order entrypoint is now `create_customer_order_v4`. Internal private functions remain usable by the current secure wrapper.

Post-migration grants were queried and verified:

- legacy customer-order public RPCs: authenticated false, anon false, public false;
- `create_customer_order_v4`: authenticated true, anon false, public false.

Supabase Security Advisor was rerun after the DDL changes and returned 0 lints.

## Native offline typography

`src/index.css` no longer imports Google Fonts at runtime. The app now uses Android/iOS/system font stacks so typography is available without a network request during app startup.

`release-audit.mjs` now rejects:

- `fonts.googleapis.com` / `fonts.gstatic.com` in app styles;
- remote CSS `@import url(http...)` in the native app stylesheet.

Do not reintroduce a network font dependency. If a branded bundled font is ever added later, it must follow licensing, package-size and app-store requirements and must not depend on runtime network delivery.

## Voice search note

The app does not have a native speech-recognition plugin installed. The existing header voice-search path detects `window.SpeechRecognition` / `webkitSpeechRecognition` at runtime and explicitly reports unsupported devices instead of pretending recognition succeeded. Do not claim native voice search is universally available until a real Android/iOS speech implementation is deliberately added and tested.

## Backend checkpoint

- Supabase project: `rmfcziawxjgcnxexbrvw`
- live migration count: 130
- latest migration: `20260818211654_retire_legacy_customer_order_rpc_entrypoints`
- Security Advisor: 0 lints after migration 130
- edge functions remain recorded as `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3
- 14 active perishable variants still lack real shipping weight. Do not fabricate these values.

## Release state

Do not call the newest functional head CI-green.

GitHub Actions runner allocation is still blocked by the account billing/minute/spending-limit condition. No new Actions run was intentionally triggered during this pass.

The last recorded blocked Mobile Quality Gate is run `32029478472`; both `verify-ios` and `verify-web-android` had no executed steps/no runner allocation. Older Android release-bundle and iOS Simulator compilation baselines were green, but those baselines do not validate this newest head.

When runner allocation is restored, run one current-head mobile quality gate covering release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS Simulator compilation.

Do not merge PR #47 until reachable release gates are green and the user explicitly authorizes merge.

External values that must remain unfabricated: legal business/support identity, final applicable legal text, payment merchant/provider credentials, Google/Facebook production OAuth configuration, FCM/APNs provider secrets, Play/App Store signing/release credentials, real public HTTPS share origin and remaining real shipping weights.
