# Go-Live Checklist / Yayına Alma Kontrol Listesi

**Golden Oremar** — Production deployment checklist for platform owner.

---

## 🔐 1. Payment Provider Credentials / Ödeme Sağlayıcı Kimlik Bilgileri

### iyzico Integration
**Status:** Fail-closed architecture ready. Checkout validates prerequisites before showing payment UI.

**Required Actions:**
- [ ] Set `VITE_IYZICO_API_KEY` in Vercel/deployment environment variables
- [ ] Set `VITE_IYZICO_SECRET_KEY` in Vercel/deployment environment variables  
- [ ] Set `VITE_IYZICO_BASE_URL` to sandbox or production endpoint
- [ ] Update Supabase Edge Function secrets for server-side iyzico validation
- [ ] Test payment flow in sandbox with test cards
- [ ] Verify purchase readiness warnings appear when seller/product not ready

**Documentation:** System enforces fail-closed payment behavior — users cannot initiate checkout unless all prerequisites are met.

---

## 📬 2. Notifications & Real-time / Bildirimler ve Gerçek Zamanlı

### Supabase Realtime Setup
**Status:** Code ready. Migration file exists.

**Required Actions:**
- [ ] Execute migration: `supabase/migrations/20240315000000_notifications_realtime.sql` in production
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
- [ ] Set environment variables for CI/CD:
  - `ANDROID_KEYSTORE_FILE` (base64-encoded keystore)
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- [ ] Configure Capacitor build.gradle for release signing
- [ ] Test signed AAB generation

**Documentation:** See `docs/ANDROID_PLAY_SIGNING.md` for detailed steps.

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

## 📚 Related Documentation

- Payment fail-closed behavior: `src/features/cart/CartCheckoutFlow.tsx` (purchase readiness validation)
- Notification schema: `supabase/migrations/20240315000000_notifications_realtime.sql`
- Android signing: `docs/ANDROID_PLAY_SIGNING.md`
- iOS signing: `docs/IOS_RELEASE_SIGNING.md`
- Environment setup: `README.md`

---

**Last Updated:** 2026-09-12  
**PR Reference:** [#108](https://github.com/ishak595-code/Golden-Oremar-/pull/108)
