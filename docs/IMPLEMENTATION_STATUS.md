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

## Completed structured product safety package
- Existing published `product_health` content is reused; no duplicate health-content system is created.
- All 42 published products have linked published structured safety content.
- Product detail and health content reuse the existing `get_public_product_safety_v1` RPC and shared structured safety UI.
- The public safety RPC keeps the published v2 customer contract while sanitizing warnings and source URLs and falling back to the real Turkish publication if a requested translation is unavailable.
- Customer-facing `verificationNeeded` and `claimPolicy` fields remain available because the existing shared UI intentionally renders them as verification guidance and disclaimer text; their types are preserved.
- Live safety migrations applied after the structured-safety merge are mirrored into GitHub so schema replay remains consistent.
- Supabase Security Advisor reports no security lints after the final public safety contract alignment.

## Current active package
Published FAQ/help integration and remaining customer self-service guidance. Reuse the existing content library, account help RPC and messaging support flow rather than creating duplicate static pages.

## Release gates still required on Apple hardware
A real Xcode archive/build, signing check and VoiceOver/device pass are required before App Store release; Linux CI cannot substitute for an Apple toolchain build.
