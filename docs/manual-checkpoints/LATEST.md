# Golden Oremar latest checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before any new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json` and `docs/manual-checkpoints/2026-08-17-production-hardening.md`. Do not rebuild completed blocks.

## Latest manual delta completed after the large checkpoint

- Admin campaign editor now uses the shared accessible-dialog stack instead of an isolated Escape listener. Focus is contained/restored, backdrop close is guarded while saving, modal errors are assertive, search/text fields are bounded, dates are defensively rendered and campaign date/discount/usage/target inputs are validated before mutation.
- Android/iOS native status-bar foreground contrast was corrected. Dark application UI now requests light status-bar foreground content; light application UI requests dark foreground content.

## Mobile shell invariants

- Do not add a desktop top navigation menu.
- Do not add a main-app hamburger menu.
- Preserve the repository product/producer/village search control.
- Keep phone/tablet bottom application navigation.
- Notification bell count comes from the live server unread count and uses a red badge when nonzero.
- Cart badge uses server total item quantity, not distinct line count.
- Account bottom navigation does not duplicate unread count.
- Native keyboard owns the lower screen while open, so bottom navigation is temporarily hidden.

## Backend checkpoint

- Supabase project: `rmfcziawxjgcnxexbrvw`.
- Recorded live migration count: 128.
- Recorded latest migration: `20260817105414_add_server_authoritative_push_badge_count_v3`.
- Recorded Security Advisor result: 0 lints.
- Recorded edge functions: `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3.

## Release state

Do not call the newest frontend CI-green. GitHub Actions runner allocation is still blocked by the account billing/minute or spending-limit condition. Do not intentionally create repeated manual Actions runs while this blocker remains.

When runner allocation is restored, the next release action is one meaningful latest-head mobile quality run covering release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS simulator compilation. Do not merge PR #47 until reachable release gates are green and the user explicitly authorizes merge.

External production values must not be fabricated: legal business/support identity, payment merchant/provider credentials, Google/Facebook OAuth production configuration, FCM/APNs credentials, store signing/release credentials, real public HTTPS share origin, and the remaining real product shipping weights.
