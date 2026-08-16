# Golden Oremar Implementation Status

Last updated: 2026-08-16

This file is intentionally concise. Detailed sequencing lives in `MOBILE_PRODUCT_ROADMAP.md`; persistence rules live in `PERSISTENCE_AND_CHANGE_LEDGER.md`.

## Current phase
Mobile-first customer experience hardening before admin-panel finalization.

## Completed platform/auth package
- Stable Capacitor 8.5 core/platform baseline with locked official plugin versions.
- Android API 36, minSdk 24, Java 21, Kotlin 2.2.20, Gradle 8.14.3 and AGP 8.13.0.
- iOS deployment target 15.0 with Capacitor 8.5 UIScene lifecycle and preserved auth deep-link routing.
- Provider-gated Google/Facebook OAuth remains integrated through the existing Supabase/deep-link session flow; social buttons remain disabled unless explicitly enabled.
- Permanent mobile CI quality gate checks locked native baseline, production build, Capacitor Android/iOS sync reproducibility and Android debug compilation.

## Completed dynamic product/customer trust packages
- Server-backed review rating/count and stock/variant truth are surfaced on customer product surfaces.
- Producer verification, origin verification and follower metrics are shown from server-backed data.
- Producer profile follow/follow-state uses the same server truth.
- Product cards, catalog search, producer products, cart and product detail use stock-aware quantity handling and accessible quantity controls.
- CategoryDirectory reuses the same canonical product card instead of a weaker parallel card; category quantity, producer metrics, error/loading/empty states and mobile controls share the same server-backed customer contract.
- Home quick categories come from the live category ordering/product availability instead of hard-coded slugs.
- Home spotlight selection comes from real featured/sellable catalog data instead of a hard-coded product name.
- Producer trust metrics fail safe: if metric hydration is unavailable, verification or follower values are not invented.

## Completed structured product safety package
- Existing published `product_health` content is reused; no duplicate health-content system is created.
- All 42 published products have linked published structured safety content.
- Product detail and health content reuse the existing `get_public_product_safety_v1` RPC and shared structured safety UI.
- The public safety RPC keeps the published v2 customer contract while sanitizing warnings and source URLs and falling back to the real Turkish publication if a requested translation is unavailable.
- Customer-facing verification/disclaimer fields used by the shared UI keep their intended public types.
- Live safety migrations applied after the structured-safety merge are mirrored into GitHub so schema replay remains consistent.
- Supabase Security Advisor reports no security lints after the final public safety contract alignment.

## Completed published FAQ/help package
- The existing published content system is reused; no duplicate hard-coded help database is created.
- 13 Turkish FAQ entries are published across trust, account/discovery, seller, order/delivery, product-safety and account/privacy categories.
- `list_public_faq_v1` is the single FAQ read RPC, supports the app locales and explicitly reports Turkish fallback when a requested translation is unavailable.
- Account → Yardım & Destek loads the real FAQ source in an accessible searchable/category-filtered panel using native details/summary disclosure controls.
- FAQ answers render as plain published text; unsanitized HTML is not injected.
- Existing About, Returns, Privacy and messaging support flows remain intact. A Terms card is still not invented when no verified published Terms record exists.
- The live FAQ migration is mirrored into GitHub for schema/content replay.

## Completed mobile visual/accessibility finalization packages
- Public metadata/PWA copy, zoom behavior and client env boundary are hardened.
- Canonical product card density and live data are reused across home, search, producer and category customer surfaces.
- The home showcase preserves server order, uses real live category/featured data and respects reduced-motion behavior.
- Shared mobile header/search/action controls use explicit accessible names, visible focus, minimum ~44px interaction targets and real cart/unread counts.
- Bottom mobile navigation is a real `nav` landmark, reports the active page with `aria-current`, keeps safe-area placement and uses readable labels.
- Account subview changes move focus to the new panel heading and return focus context to the Account heading when navigating back.
- Shared account panels use explicit `aria-labelledby` / `aria-describedby` relationships.
- Address add/edit uses the shared accessible-dialog focus trap, Escape handling, scroll lock and focus restoration.
- Address deletion requires a separate accessible destructive confirmation; save/delete operations block duplicate actions and report completion state.
- Customer appearance is now a personal device preference rather than the legacy global Firestore `settings/general` theme value.
- Initial appearance is resolved before first render from the saved device preference or OS color scheme and is synchronized with the native status bar.
- Light mode now has a real ivory/white surface system with dark forest text and AA-checked green/gold/muted text contrast; dark mode retains the premium forest palette.
- Account Settings now isolates password/newsletter/notification/session/account-closure errors and success messages inside the relevant panel instead of sharing one misplaced error state.
- Notification preferences, newsletter, password, session and closure actions have explicit busy guards and duplicate-action protection.
- Password confirmation exposes mismatch validation to assistive technology and enforces the existing 8-72 character client boundary before backend verification.
- Account closure now uses an accessible confirmation alert dialog before the existing secure backend request; active closure cancellation has its own busy/error/status feedback.
- Account order/return dialogs now reuse the canonical shared accessible-dialog engine instead of maintaining a second focus-trap implementation.
- Avatar removal and pending-payment order cancellation require explicit accessible destructive confirmation before existing secure backend mutations run.
- Order detail suppresses its parent focus trap while a nested return/cancellation dialog is open, preventing competing modal focus loops.
- Return request/detail loading states remain true modal overlays with Escape/focus-return/body-scroll behavior instead of exposing the background screen during asynchronous loading.
- Favorites and followed-producer rows use per-item async busy guards, local success/error announcements, silent server refresh and focus-visible actions instead of unhandled inline promises.
- Followed-producer cards never invent a country/location fallback and only display producer/origin verification when the corresponding server-backed flag is true.
- Gift history and payment history clear stale errors on retry, show premium responsive cards and translate known order/payment status codes into customer-readable labels while preserving unknown server values safely.
- Payment history remains truthful: only verified backend payment activity is shown; no saved-card vault or fake payment method is simulated before a real provider is integrated.

## Current active package
Remaining public/customer surfaces outside the completed account core: audit Cart/Checkout, Auth, Events, Contact and Health screens for premium responsive presentation, loading/error/empty-state consistency, focus behavior and duplicate-action protection without changing their completed secure backend contracts.

## Release gates still required on Apple hardware
A real Xcode archive/build, signing check and VoiceOver/device pass are required before App Store release; Linux CI cannot substitute for an Apple toolchain build.
