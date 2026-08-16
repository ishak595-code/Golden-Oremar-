# Golden Oremar Implementation Status

Last updated: 2026-08-16

This file is intentionally concise. Detailed sequencing lives in `MOBILE_PRODUCT_ROADMAP.md`; persistence rules live in `PERSISTENCE_AND_CHANGE_LEDGER.md`.

## Current phase
Mobile-first customer experience hardening before admin-panel finalization.

## Completed platform/auth package
- Stable Capacitor 8.5 core/platform baseline with locked official plugin versions.
- Android API 36, minSdk 24, Java 21, Kotlin 2.2.20, Gradle 8.14.3 and AGP 8.13.0.
- iOS deployment target 15.0 with Capacitor 8.5 UIScene lifecycle and preserved auth deep-link routing.
- Provider-gated Google/Facebook OAuth remains integrated through the existing Supabase/deep-link session flow; buttons remain disabled unless explicitly enabled.
- A permanent mobile CI gate is maintained separately under `.github/workflows/mobile-quality.yml`.

## Current active package
Dynamic product-card/store metrics: review summary, verified producer, follower count, stock/variant truth and follow state.

## Release gates still required on Apple hardware
A real Xcode archive/build and VoiceOver/device pass are required before App Store release; Linux CI cannot substitute for an Apple toolchain build.
