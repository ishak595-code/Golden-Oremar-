# Golden Oremar latest checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before any new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json`, `docs/manual-checkpoints/2026-08-17-production-hardening.md`, `docs/account-audit/2026-08-17-account-tab-production-audit.md`, `docs/manual-checkpoints/2026-08-17-account-cart-final-polish.md` and `docs/account-audit/2026-08-17-account-complete-surface-pass.md`. Do not rebuild completed blocks.

## Latest completed application-section audit

The newest full `Hesabım` surface pass is:

`docs/account-audit/2026-08-17-account-complete-surface-pass.md`

Latest functional frontend head before checkpoint documentation:

`3a43d2cf63fedaaf9ca8f06e26ce32ca6e865819`

## Hesabım final surface inventory

Hesabım is now treated as the complete mobile account hub, including every reachable account-related surface rather than only files under `src/features/account`.

### Top account hub

- profile identity
- total order count
- tappable active-order summary
- tappable favorite summary
- tappable address summary
- tappable real unread-notification summary
- latest order quick card and direct order-detail access when a verified recent order exists

Malformed counts are not coerced to fake zero.

### Discover & participate

- `Sağlık & Tarifler`
- `Etkinlikler & Kayıtlarım`

The event card now reads live event and own-reservation data. The current live event state has 0 upcoming events and 5 completed archived 2024 events. No future event is fabricated.

### Producer & management

- producer verification summary when applicable
- Store Profile Edit
- Become a Seller / Seller Panel
- Admin Panel only for verified admin/super_admin roles

### Shopping & account

- Profile Edit
- Orders
- Reviews
- Favorites
- Followed Producers
- Gifts
- Addresses
- Payment History

### Messages & support

- Messages
- Notifications
- Contact
- Help & Support
- FAQ
- About
- Returns & Cancellation
- Privacy & Data Processing
- Terms of Use slot

Terms remains unpublished when no verified live record exists. No legal copy is fabricated.

### Preferences & security

Settings retains theme, app notification sound, newsletter, push categories, password change, current/other/all device session management and account closure controls.

### Bottom sign-out

A visible `Çıkış Yap` action remains at the bottom of the account hub and signs out only the current device. Other-device/global sign-out remains inside Settings.

## Events & own registrations

`src/features/engagement/api.ts` now validates public event RPC results and event reservation inputs/outputs. `listMyEventReservations()` uses the existing own-user RLS policy on `public.event_reservations` and joins the published event row.

`PublicEventsScreen.tsx` now includes:

- event summary
- personal event reservation history
- reservation code
- reservation status
- guest count
- event date/location
- duplicate active-reservation CTA suppression
- truthful upcoming/archived event separation
- refreshed event and personal-reservation state after successful reservation

No customer cancellation button was invented because the current live cancellation RPC is admin-only. A customer cancellation workflow should only be added together with the correct backend capacity/waitlist semantics.

## Health & recipes

`PublicHealthScreen.tsx` now has complete tab semantics and keyboard ownership for Rehberler, Ürün Bilgileri and Tarifler: arrows, Home, End, `aria-selected`, `aria-controls` and `tabpanel` are aligned. Search is bounded to 120 characters, locale-aware, clearable and reports result count without making the whole content grid a noisy live region.

## Contact truthfulness

Live `get_public_contact_config_v1()` currently reports `supportChannelsReady=false`, email null and phone null. The stored `Hakkari, Türkiye` value is therefore not presented as an official support identity.

Direct phone/email/official support address now appears only when `supportChannelsReady === true`. Until then, the secure in-app contact form remains the truthful active contact channel.

## Cart and checkout final state

The previous cart/checkout final hardening remains in force:

- live cart `itemCount` is total quantity, not line count
- cart RPC payloads are normalized and line/subtotal integrity checked
- checkout does not assume TR for a new address
- country, phone, address, coupon and order-item boundaries are validated
- checkout intent changes invalidate the idempotency key
- shipping quote state invalidates when cart/destination/coupon changes
- no card charge or success is simulated without real provider/backend verification

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

No schema mutation was required for this account/events/content/contact pass. Existing live table/RLS/function contracts were read and used rather than creating a gratuitous migration.

## Release state

Do not call the newest frontend CI-green. GitHub Actions runner allocation is still blocked by the account billing/minute or spending-limit condition. No new manual Actions run was intentionally triggered during this audit.

When runner allocation is restored, the next release action is one meaningful latest-head mobile quality run covering release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS simulator compilation.

Do not merge PR #47 until reachable release gates are green and the user explicitly authorizes merge.

External production values must not be fabricated: legal business/support identity, final applicable legal copy, payment merchant/provider credentials, Google/Facebook OAuth production configuration, FCM/APNs credentials, store signing/release credentials, real public HTTPS share origin, and remaining real product shipping weights.
