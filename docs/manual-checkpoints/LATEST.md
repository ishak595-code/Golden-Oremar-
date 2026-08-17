# Golden Oremar latest checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before any new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json`, `docs/manual-checkpoints/2026-08-17-production-hardening.md`, `docs/account-audit/2026-08-17-account-tab-production-audit.md` and `docs/manual-checkpoints/2026-08-17-account-cart-final-polish.md`. Do not rebuild completed blocks.

## Latest completed application-section audit

The expanded `Hesabım` + `Sepet/Checkout` final manual audit is recorded in:

`docs/manual-checkpoints/2026-08-17-account-cart-final-polish.md`

Latest functional code before checkpoint documentation:

`d96e716d2d80ee34bf9d914b752382ec75d57c59`

## Hesabım final state

- The account hub is grouped into mobile-native sections instead of one undifferentiated card list.
- Profile, orders, reviews, favorites, followed producers, gifts, addresses, payment history, messages, notifications, contact, support, settings, seller and admin capabilities remain reachable according to real role/callback availability.
- Verified order/favorite/follow/gift counts can be surfaced on account cards; unread notifications use the real red unread badge.
- A direct `Çıkış Yap` action exists at the bottom of Hesabım and only signs out the current device.
- Settings keeps the complete session-security surface for current, other and all devices.

## Support, FAQ and legal/help content

- Support center includes secure support conversations and the application contact form.
- FAQ search is bounded, locale-aware and has explicit clear-search / clear-filter actions.
- Four canonical help/legal slots are represented: About, Returns & Cancellation, Privacy & Data Processing, Terms of Use.
- Live Supabase verification found About, Returns and Privacy records published; Terms currently has no verified published record.
- Missing Terms is not fabricated.
- The currently published privacy copy identifies itself as pre-live/final-identity-incomplete copy; the application does not relabel it as final legal compliance.
- Live help records currently carry HTML-like markup in their `markdown` field while `sanitizedHtml` is empty. The account help UI now uses a safe structured renderer instead of displaying raw tags or trusting arbitrary HTML. Unsafe attributes/schemes are discarded and `dangerouslySetInnerHTML` is not used in this account legal/help path.

## Settings and premium preferences

- Notification preference payloads remain strict real booleans.
- Newsletter fetch failure does not fabricate `Abone değil`.
- Password/session/account-closure boundaries and accessible confirmations remain in place.
- Premium sound wording is native-app oriented rather than browser oriented.
- Theme changes only appearance; product, price, stock and trust truth do not change.

## Cart and checkout final state

- Live Supabase `private.get_customer_cart_snapshot_v1` was inspected: server `itemCount` is `sum(quantity)`, so the app cart badge is total product units, not distinct lines.
- Live `private.preview_my_checkout_v1` also computes item count from quantity sum.
- Every cart RPC response is normalized at the client boundary: identifiers, quantities, currency, money, producer data, availability, selected options, stock, expiry and line/subtotal consistency.
- Client itemCount is recomputed from verified row quantities and therefore cannot be corrupted by a malformed separate count field.
- Checkout preview validates booleans, money math, country, currency, count, shipping and promotion structures.
- The live backend's early `cart_empty` preview omits `previewOnly`; the client accepts that exact valid empty-cart contract only, while continuing to require `previewOnly=true` for other preview responses.
- Manual checkout addresses no longer assume `TR`. A real two-letter country code is required before shipping/preview calculation.
- Phone, address, coupon and order-item boundaries are validated before mutation.
- Checkout idempotency key is reset when the checkout intent changes.
- Shipping quote state resets when cart/destination/coupon changes.
- Payment readiness remains truthful; no card charge or success is simulated without a real live provider and backend verification.

## Mobile shell invariants

- Do not add a desktop top navigation menu.
- Do not add a main-app hamburger menu.
- Preserve the repository product/producer/village search control.
- Keep phone/tablet bottom application navigation.
- Notification bell count comes from the live server unread count and uses a red badge when nonzero.
- A malformed unread response must preserve the last verified badge value rather than force zero.
- Cart badge uses total item quantity, not distinct line count.
- Account bottom navigation does not duplicate unread count.
- Native keyboard owns the lower screen while open, so bottom navigation is temporarily hidden.

## Backend checkpoint

- Supabase project: `rmfcziawxjgcnxexbrvw`.
- Recorded live migration count: 128.
- Recorded latest migration: `20260817105414_add_server_authoritative_push_badge_count_v3`.
- Recorded Security Advisor result: 0 lints.
- Recorded edge functions: `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3.

No schema mutation was needed for this Account/Cart pass. Live function definitions were read to verify cart-count and preview semantics; no gratuitous migration was created.

## Release state

Do not call the newest frontend CI-green. GitHub Actions runner allocation is still blocked by the account billing/minute or spending-limit condition. No new manual Actions run was intentionally triggered during this audit.

When runner allocation is restored, the next release action is one meaningful latest-head mobile quality run covering release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS simulator compilation.

Do not merge PR #47 until reachable release gates are green and the user explicitly authorizes merge.

External production values must not be fabricated: legal business/support identity, final applicable legal copy, payment merchant/provider credentials, Google/Facebook OAuth production configuration, FCM/APNs credentials, store signing/release credentials, real public HTTPS share origin, and remaining real product shipping weights.
