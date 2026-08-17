# Golden Oremar latest checkpoint

Date: 2026-08-17
Branch: `agent/admin-supabase-retire-node`
PR: #47

Golden Oremar is an Android/iOS application. React/Vite is the Capacitor UI layer, not a desktop website shell.

Before any new work, read this file together with `PROJECT_STATE.json`, `TEST_REPORT.json`, `docs/manual-checkpoints/2026-08-17-production-hardening.md` and `docs/account-audit/2026-08-17-account-tab-production-audit.md`. Do not rebuild completed blocks.

## Latest completed application-section audit

The `Hesabım` section has now been reviewed file by file against both current branch code and earlier account-history/checkpoint work. The consolidated source of truth is:

`docs/account-audit/2026-08-17-account-tab-production-audit.md`

Latest functional account code before the audit documentation commit:

`6c6a4ed507dae643aacda0aacf86f19ca1e02df0`

Key new account fixes from this pass include:

- malformed account overview data is validated before the account hub renders;
- missing money/currency is never converted to fake zero or automatic TRY;
- malformed notification unread payloads cannot erase a previously verified red unread badge or clear delivered native notifications;
- payment, favorite, producer-follow, gift, order, return and review surfaces now distinguish invalid data from real zero/empty values;
- account messaging polling no longer makes the whole thread an aria-live region, and attachment/storage boundaries are hardened;
- profile locale and phone validation no longer silently normalizes invalid source data into plausible values;
- new customer addresses no longer assume TR, supporting the intended international application model;
- newsletter lookup failure no longer fabricates an `Abone değil` state;
- review withdrawal and pending seller product-change withdrawal use accessible confirmation dialogs rather than native confirmation behavior;
- seller inventory forms no longer initialize malformed backend stock values to zero, preventing accidental zero-stock writes;
- producer profile media uploads now clean abandoned temporary assets and validate location/media boundaries.

Files such as `PremiumPreferencesPanel.tsx`, `SupportPanel.tsx`, `FaqPanel.tsx`, `faqApi.ts`, `presentation.ts`, `types.ts` and `useDialogA11y.ts` were also reviewed. They were not rewritten because no concrete current production regression required a change. The application shell was checked to confirm that AccountCenter receives the real theme handler and app-level unread-count setter.

## Latest manual delta completed after the large checkpoint

- Admin campaign editor uses the shared accessible-dialog stack instead of an isolated Escape listener. Focus is contained/restored, backdrop close is guarded while saving, modal errors are assertive, search/text fields are bounded, dates are defensively rendered and campaign date/discount/usage/target inputs are validated before mutation.
- Android/iOS native status-bar foreground contrast was corrected. Dark application UI requests light status-bar foreground content; light application UI requests dark foreground content.
- The full Hesabım audit above is complete. Do not repeat it from the beginning unless a new concrete regression, backend contract change or user-reported failure is found.

## Mobile shell invariants

- Do not add a desktop top navigation menu.
- Do not add a main-app hamburger menu.
- Preserve the repository product/producer/village search control.
- Keep phone/tablet bottom application navigation.
- Notification bell count comes from the live server unread count and uses a red badge when nonzero.
- A malformed unread response must preserve the last verified badge value rather than force zero.
- Cart badge uses server total item quantity, not distinct line count.
- Account bottom navigation does not duplicate unread count.
- Native keyboard owns the lower screen while open, so bottom navigation is temporarily hidden.

## Backend checkpoint

- Supabase project: `rmfcziawxjgcnxexbrvw`.
- Recorded live migration count: 128.
- Recorded latest migration: `20260817105414_add_server_authoritative_push_badge_count_v3`.
- Recorded Security Advisor result: 0 lints.
- Recorded edge functions: `contact-submit` v1, `event-reservation` v2, `push-dispatch` v3.

No database mutation was required by the Hesabım UI/API boundary audit, so a gratuitous migration or Security Advisor rerun was not created.

## Release state

Do not call the newest frontend CI-green. GitHub Actions runner allocation is still blocked by the account billing/minute or spending-limit condition. No new manual Actions run was intentionally triggered during the Hesabım audit.

When runner allocation is restored, the next release action is one meaningful latest-head mobile quality run covering release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle and iOS simulator compilation. Do not merge PR #47 until reachable release gates are green and the user explicitly authorizes merge.

External production values must not be fabricated: legal business/support identity, payment merchant/provider credentials, Google/Facebook OAuth production configuration, FCM/APNs credentials, store signing/release credentials, real public HTTPS share origin, and the remaining real product shipping weights.
