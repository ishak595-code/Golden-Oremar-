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

## Completed dynamic product and producer trust metrics
- Server-backed review rating/count and stock/variant truth are surfaced on customer product surfaces.
- Producer verification, origin verification and follower metrics are shown from server-backed data.
- Producer profile follow/follow-state uses the same server truth.

## Completed quantity and add-to-cart interaction package
- Product cards, catalog search, producer products and cart already use stock-aware quantity handling and were preserved.
- Product detail now uses accessible 44px minimum +/- controls, polite quantity announcements and server-derived stock boundaries instead of the remaining raw number field.
- Add-to-cart continues using the selected server variant and selected quantity; no client-side price or stock authority was introduced.

## Current active package
Structured product content enrichment: description, origin, usage/storage and health/nutrition information using published/server-backed fields, with source/warning handling and no invented health claims.

## Release gates still required on Apple hardware
A real Xcode archive/build, signing check and VoiceOver/device pass are required before App Store release; Linux CI cannot substitute for an Apple toolchain build.
