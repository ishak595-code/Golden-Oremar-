# Golden Oremar

Golden Oremar, köy ve yöresel ürünleri üreticiden müşteriye izlenebilir biçimde ulaştırmayı hedefleyen mobil pazar yeri uygulamasıdır.

## Architecture

- React + Vite + Capacitor mobile application
- Supabase Auth, Postgres, Storage, RPC and Edge Functions
- Controlled customer / producer / admin roles
- Server-authoritative pricing, stock, promotion and checkout
- Producer verification, batch traceability and public origin trust layer

## Repository status

This is the canonical Golden Oremar repository. The repository bootstrap imports the remaining legacy application shell from `ishak595-code/bilgideposu`, preserves the new Supabase-backed modules already present here, and applies the cumulative migration scripts to the real application shell.

Current backend state recorded in this repository: 90 applied migrations and 0 Supabase Security Advisor lints at the last verified checkpoint.

## Environment

Copy `.env.example` to `.env.local` and provide:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_AUTH_REDIRECT_URL=
```

Never commit service-role keys, raw payment credentials, KYC documents or other secrets.
