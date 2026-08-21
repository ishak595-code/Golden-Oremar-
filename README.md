# Golden Oremar

Golden Oremar, köy ve yöresel ürünleri doğrulanmış üreticilerden müşteriye izlenebilir biçimde ulaştırmayı hedefleyen React + Vite + Capacitor mobil pazar yeri uygulamasıdır.

## Canonical repository state

- **Source of truth branch:** `main`
- Canonical backend: **Supabase** (Auth, Postgres, Storage, RPC, Vault and Edge Functions)
- Legacy Firebase customer runtime: **retired**
- Legacy Node/SQLite/JWT runtime: **retired**
- Merged production-hardening work: PR **#47** and security cleanup PR **#48**
- Latest verified production gate: **Mobile Quality Gate #1086**, all jobs successful
- Verified pre-merge head: `a7fd0b04fceb94fa79b668cd7b743547a0caf65a`
- Current merged code head at this checkpoint: `1ea0d37c24b4b62bed88c3cf9d92ab92de2dbdab`

Do not treat stale feature branches or historical files as current runtime source. `main`, `PROJECT_STATE.json` and `TEST_REPORT.json` are the current repository references.

## Architecture

- React 19 + Vite
- Capacitor Android and iOS
- Supabase Auth and server-authoritative role checks
- Supabase Postgres/RPC with explicit public/private security boundaries
- Supabase Storage with fail-closed asset handling
- Supabase Vault for provider secrets
- Server-authoritative pricing, stock, promotions and checkout
- Producer verification, traceability, settlement and Super Admin management
- Dynamic brand appearance, company identity, domains and release configuration from Supabase

## Current verified backend checkpoint

- 312 applied migrations
- Latest migration: `20260821142610_isolate_anonymous_rpc_privileges_in_api_internal_v2`
- Supabase Security Advisor: 0 lints
- Runtime dependency integrity: ready
- Missing public/private runtime references: 0 / 0
- System error ledger rows: 0
- Legal/commercial readiness: ready
- 42 published products and 42 active published variants

Real catalog image binaries, physically verified shipping weights and production provider/signing credentials remain external inputs. They must not be fabricated.

## Quality gate

The verified #1086 gate passed:

- real Chromium customer E2E
- release/security audits
- TypeScript `--noEmit`
- production web build
- Android debug APK
- Android unsigned release AAB
- Capacitor Android/iOS sync reproducibility
- iOS Simulator build
- deployment target and `com.goldenoremar.app` verification

Build and E2E artifacts are retained by GitHub Actions according to workflow retention.

## Environment

Copy `.env.example` to `.env.local` and provide only public client configuration required by the application, for example:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_AUTH_REDIRECT_URL=
```

Never commit service-role keys, payment-provider secrets, private keys, passwords, KYC documents or signing credentials. Provider secrets belong in server-side secret management / Supabase Vault.
