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
- Existing published `product_health` content is reused; no new health copy is invented.
- All 42 published products have linked published safety content.
- The existing `get_public_product_safety_v1` RPC remains the single public product-safety source.
- Its public response is hardened to preparation/usage, storage, allergen/label guidance, warnings and HTTPS sources.
- Internal `claimPolicy` and `verificationNeeded` workflow metadata is no longer exposed by the public safety response.
- If a requested translation does not exist, the real Turkish publication is returned as a fallback and its returned locale remains explicit.
- Product detail renders the structured safety information in accessible sections and explicitly avoids treatment claims.
- Supabase security advisor reports no security lints after the safety API hardening.
- Live migration history is mirrored into the repository, including the superseded guidance migration and the following hardening migration, so schema replay remains consistent.

## Current active package
Published FAQ/help integration and remaining customer self-service guidance. Reuse the existing content library, account help RPC and messaging support flow rather than creating duplicate static pages.

## Release gates still required on Apple hardware
A real Xcode archive/build, signing check and VoiceOver/device pass are required before App Store release; Linux CI cannot substitute for an Apple toolchain build.
