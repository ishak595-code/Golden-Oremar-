# Golden Oremar Implementation Status

Last updated: 2026-08-16

This file is intentionally concise. Detailed sequencing lives in `MOBILE_PRODUCT_ROADMAP.md`; persistence rules live in `PERSISTENCE_AND_CHANGE_LEDGER.md`.

## Current phase
Mobile-first customer experience hardening before admin-panel finalization.

## Current active package
1. Align Capacitor 8 dependencies with latest stable 8.x.
2. Preserve Android API 36 / Java 21 / minSdk 24 modern baseline.
3. Keep iOS deployment target 15.0.
4. Add real, provider-gated Google/Facebook OAuth using native external browser + existing deep-link callback.
5. Do not expose social-auth buttons until provider configuration is explicitly enabled.

## Next package
Dynamic product-card/store metrics: review summary, verified producer, follower count, stock/variant truth and follow state.
