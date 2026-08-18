# Golden Oremar 2026-08-18 native/content follow-up checkpoint

Branch: `agent/admin-supabase-retire-node`
PR: #47
Product: Android/iOS app. React/Vite is the Capacitor UI layer.

Read this after `docs/manual-checkpoints/2026-08-18-catalog-auth-gift-native-hardening.md`. Do not redo the blocks below unless a new concrete regression is found.

## Native capability truthfulness

- `src/native.ts` sets a root `data-native-platform` marker for Android/iOS capability-specific UI behavior.
- Browser Web Speech remains available only on browser surfaces where `SpeechRecognition`/`webkitSpeechRecognition` exists.
- The Android/iOS package does not currently ship a native speech-recognition plugin, Android `RECORD_AUDIO` permission, or iOS microphone usage-description contract.
- Therefore `src/index.css` hides the `Sesli arama` microphone affordance on native packages instead of advertising an incomplete feature. Text search remains fully functional.
- Release audit already guards this browser-only voice capability from accidentally returning to native UI before a real native implementation exists.

## Native safe-area ownership

- `capacitor.config.ts` enables Capacitor 8 System Bars CSS inset handling.
- The app uses the injected `--safe-area-inset-*` variables when available with `env(safe-area-inset-*)` fallback.
- Body no longer owns top/bottom safe-area padding, avoiding duplicate top inset with the sticky header.
- Header owns the top system-bar inset.
- Fixed bottom navigation owns bottom plus landscape left/right safe-area insets.
- Keyboard-open state still hides bottom navigation.

## Native offline typography

- Runtime Google Fonts dependency remains retired.
- Android/iOS startup typography uses system/native font stacks.
- Search confirmed no Google Fonts domain dependency should be reintroduced.

## Public information and legal navigation

`src/features/storefront/PublicInfoScreen.tsx` was corrected so its information tabs are functional even when the App shell only opens the `about` route and does not provide an `onSelectPage` callback.

Current behavior:

- Hakkımızda, İade ve İptal, Gizlilik ve Veri İşleme, Kullanım Koşulları use internal active-page state.
- A page button is disabled if the corresponding live publication does not exist.
- Missing Terms content remains explicitly unpublished rather than fabricated.
- HTML-like markdown no longer appears as raw `<h3 ...>` text.
- Public info content does not use arbitrary `dangerouslySetInnerHTML`.

## Shared safe published-content renderer

New file:

`src/features/content/SafePublishedBody.tsx`

It converts publication HTML-like text to React nodes through a whitelist-oriented DOMParser renderer. It supports semantic headings, paragraphs, lists, emphasis, blockquote, code, line breaks and safe links. Links are limited to HTTPS, mailto and tel. Arbitrary source attributes/classes/event handlers are not copied into React output.

`PublicInfoScreen.tsx` now uses this shared renderer.

`PublicHealthScreen.tsx` also uses it for Health Guides, Product Information and Recipes. The prior `dangerouslySetInnerHTML` path was removed from that detail flow.

## Public content API boundary

`src/features/content/api.ts` now validates:

- content type;
- supported locale input;
- list total/limit/offset consistency;
- ID, slug, title, category, summary and dates;
- publication body size;
- safety payload object shape;
- related-product identity;
- favorite list/action shape;
- content asset URLs.

Content asset URLs accept HTTPS external assets or safe `content-public` storage paths. Arbitrary schemes, control characters and path traversal are rejected.

## Storefront/help/legal API boundary

`src/features/storefront/api.ts` now validates:

- storefront interface/home-section/sales-readiness structure;
- help/legal publication IDs, slugs, titles, locale, body and dates;
- FAQ list shape and bounded tags/text;
- newsletter status booleans and dates.

`getAccountHelpContent` and the public info screen now share the same normalized help/legal publication source rather than trusting raw RPC data differently.

## Health and recipe UI

`PublicHealthScreen.tsx` retains the prior accessible tab contract and now additionally keeps publication rendering on the shared safe renderer. Content references are validated before detail/favorite actions. Search remains bounded, clearable and announces result counts without making the full card grid a live region.

## Backend checkpoint inherited from previous file

- Supabase project: `rmfcziawxjgcnxexbrvw`
- live migration count: 130
- latest migration: `20260818211654_retire_legacy_customer_order_rpc_entrypoints`
- Security Advisor after migration 130: 0 lints
- authenticated public customer-order entrypoint: v4 only
- 14 active perishable variants still require real shipping weights and must not receive fabricated values

## Release state

Do not call the newest branch head CI-green. GitHub Actions runner allocation remains blocked by the account billing/minute/spending-limit condition, and no new Actions run was intentionally triggered during this follow-up.

Do not merge PR #47 until reachable current-head Android/iOS quality gates are green and the user explicitly authorizes merge.
