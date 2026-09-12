# Go-Live Checklist / Yayına Alma Kontrol Listesi

**Golden Oremar** — Production deployment checklist for platform owner.

---

## 🔐 1. Payment Provider Credentials / Ödeme Sağlayıcı Kimlik Bilgileri

### iyzico Integration
**Status:** Fail-closed architecture ready. Checkout validates prerequisites before showing payment UI.

**Required Actions:**
- [ ] Set Supabase Edge Function secrets (server-side only, NEVER in client):
  - `IYZICO_API_KEY`
  - `IYZICO_SECRET_KEY`
  - `IYZICO_BASE_URL` (must be exactly `https://sandbox-api.iyzipay.com` or `https://api.iyzipay.com`)
- [ ] Enable payment features in `public.brand_settings.public_config.payments`:
  - `provider: "iyzico"`
  - `live_card_payments_enabled: true` (when ready for production)
- [ ] Test payment flow in sandbox with test cards
- [ ] Verify purchase readiness warnings appear when seller/product not ready

**Documentation:** System enforces fail-closed payment behavior — users cannot initiate checkout unless all prerequisites are met. See `.env.example` for secret placement rules.

---

## 📬 2. Notifications & Real-time / Bildirimler ve Gerçek Zamanlı

### Supabase Realtime Setup
**Status:** Code ready. Migrations already applied to this branch.

**Required Actions:**
- [ ] Verify notification migrations are applied in production:
  - `supabase/migrations/20260912000000_add_seller_notification_triggers_v1.sql` (latest seller triggers)
  - `supabase/migrations/20260826234521_separate_official_store_moderation_notifications_v1.sql`
  - `supabase/migrations/20260820212020_canonicalize_producer_application_notification_target_v1.sql`
  - `supabase/migrations/20260820205248_canonicalize_producer_payout_notification_targets.sql`
- [ ] Verify RLS policies on `notifications` table
- [ ] Test Realtime subscription with real user account (orders, messages, reviews)
- [ ] Confirm notification badges update without page refresh

**Existing Features:**
- Multi-seller notification channels (producer, admin, system)
- Secure attachment support in messages
- Fallback polling when Realtime unavailable

---

## 🔒 3. Repository Protection / Depo Koruma

### Branch Protection Rules
**Status:** Not enforced. Manual review required.

**Required Actions:**
- [ ] Enable branch protection on `main`
- [ ] Require pull request reviews (minimum 1 approval)
- [ ] Require status checks to pass before merging
- [ ] Disable force push to `main`
- [ ] Disable branch deletion

**Why:** Prevents accidental direct pushes to production branch.

---

## 📱 4. Android Release Signing / Android Yayın İmzalama

### Play Store Upload Keystore
**Status:** Not configured. Required for Play Store release.

**Required Actions:**
- [ ] Generate upload keystore: `keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
- [ ] Store keystore file securely (never commit to repo)
- [ ] Set GitHub Secrets for CI/CD (workflows already configured):
  - `ANDROID_UPLOAD_KEYSTORE_BASE64` (base64-encoded keystore file)
  - `ANDROID_UPLOAD_KEYSTORE_PASSWORD`
  - `ANDROID_UPLOAD_KEY_ALIAS`
  - `ANDROID_UPLOAD_KEY_PASSWORD`
- [ ] Test signed AAB generation via GitHub Actions

**Documentation:** See `docs/ANDROID_PLAY_SIGNING.md` for detailed steps. Workflows: `.github/workflows/google-play-release.yml`, `.github/workflows/release-apk.yml`

---

## 🌐 5. Vercel Deployment Protection / Vercel Dağıtım Koruması

### Preview Environment Security
**Status:** Open preview URLs may expose staging data.

**Required Actions:**
- [ ] Enable Vercel Preview Deployments basic auth password
- [ ] OR configure IP allowlist for preview environments
- [ ] Add `X-Robots-Tag: noindex` header to preview deployments
- [ ] Verify production deployment uses production Supabase project
- [ ] Verify staging/preview deployments use staging Supabase project

**Why:** Prevents search engines from indexing staging content and unauthorized access to preview environments.

---

## ✅ 6. Final Pre-Launch Verification / Yayın Öncesi Son Doğrulama

### Critical Path Testing
- [ ] Place test order end-to-end (cart → checkout → payment → confirmation)
- [ ] Verify seller receives order notification via Realtime
- [ ] Test producer message attachment upload/download
- [ ] Verify PWA install prompt appears on mobile web
- [ ] Test dark mode across all screens
- [ ] Confirm Turkish error messages appear consistently
- [ ] Verify scroll-to-top FAB works on long home page

### Performance & Budget
- [ ] Main JS chunk ≤ 250 KiB ✓ (currently 249.9 KiB)
- [ ] Lighthouse Performance score ≥ 90
- [ ] Time to Interactive ≤ 3.5s on 4G

### Legal & Compliance
- [ ] Privacy policy published and accessible
- [ ] Terms of use published and accessible
- [ ] Cookie consent banner functional (if EU users)
- [ ] KVKK disclosure complete (Turkish data protection)

---

## 📝 Post-Launch Monitoring / Yayın Sonrası İzleme

**Recommended:**
- Set up Sentry or similar error tracking
- Monitor Supabase logs for RLS policy violations
- Track Core Web Vitals via Vercel Analytics
- Review notification delivery success rates
- Monitor iyzico webhook failures

---

## 🐛 Known CI Issues

### E2E Test Provisioning (HTTP 402 Error)
**Status:** Requires owner action. Not an application code issue.

**Symptoms:**
- `customer-e2e` job fails with `E2E_CI_CONTROL_PROVISION_FAILED:402:unknown`
- Error originates from `ci-e2e-user` Supabase Edge Function
- Android build, iOS build, and TypeScript checks pass successfully

**Root Cause:**
The E2E test infrastructure Edge Function returns HTTP 402, typically indicating:
- Supabase project quota/billing issue
- Edge Function secrets missing or expired
- Test user provisioning service misconfigured

**Required Actions:**
- [ ] Check Supabase project billing status and quota limits
- [ ] Verify `ci-e2e-user` Edge Function secrets are configured
- [ ] Review Edge Function logs in Supabase Dashboard
- [ ] Confirm test database has capacity for provisioning test users

**Workaround:**
None. E2E tests validate end-to-end customer journeys and cannot be skipped. The application code is sound (TypeScript, build, and platform builds all pass).

**Related Workflows:**
- `.github/workflows/mobile-quality.yml` (customer-e2e job)
- `supabase/functions/ci-e2e-user/index.ts`

---

## 📚 Related Documentation

- Payment fail-closed behavior: `src/features/cart/CartCheckoutFlow.tsx` (purchase readiness validation)
- Payment server-side config: `supabase/functions/_shared/iyzico.ts` (loads secrets from Supabase Vault)
- Notification migrations: `supabase/migrations/20260912000000_add_seller_notification_triggers_v1.sql`
- Android signing: `docs/ANDROID_PLAY_SIGNING.md`
- iOS signing: `docs/IOS_RELEASE_SIGNING.md`
- Environment variables: `.env.example` (defines server-only vs client config rules)

---

**Last Updated:** 2026-09-12  
**PR Reference:** [#108](https://github.com/ishak595-code/Golden-Oremar-/pull/108)
