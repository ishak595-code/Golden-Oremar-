# Golden Oremar - Complete Engineering Handoff

Bu dosya Golden Oremar mobil uygulamasını başka bir geliştirici, ekip veya yazılım sistemi devraldığında mimariyi, güvenlik sınırlarını, çalışma biçimini ve bilinen gerçek durumu hızla anlayabilmesi için hazırlanmıştır.

## 1. Source of truth

- Canonical repository: `ishak595-code/Golden-Oremar-`
- Canonical branch: `main`
- Son işlevsel uygulama merge commit'i: `006c0f732dcde756ddceb0772b170fb9676dc726`
- Android release: `1.3.0`, versionCode `4`
- Android applicationId: `com.goldenoremar.app`
- Ürün formu: Android ve iOS native shell içinde çalışan mobil uygulama
- React/Vite katmanı bir web sitesi olarak değil, Capacitor tabanlı ortak mobil uygulama UI/runtime katmanı olarak ele alınmalıdır.

Bu handoff belgesi ve `PROJECT_STATE.json` güncel proje durumunun kalıcı kayıtlarıdır. Kaynak paketinin dosya adındaki SHA, paketin tam Git commit'ini gösterir.

## 2. Ana teknoloji yığını

- React 19
- TypeScript 5.8
- Vite 6.2
- Capacitor 8.5
- Android compile/target SDK 37
- Android minSdk 24
- Java 21
- iOS Capacitor 8.5
- CI üzerinde Xcode 26.6
- Supabase PostgreSQL, Auth, Storage ve Edge Functions
- `@supabase/supabase-js` 2.111.0
- GitHub Actions CI/CD
- Tailwind CSS 4
- Motion ve Lucide React

CI Node sürümü 22'dir. Yeni geliştirmelerde aynı ana sürüm tercih edilmelidir.

## 3. Klasör haritası

- `src/` - müşteri uygulaması, hesap, katalog, sepet, sipariş, admin ve ortak UI
- `src/features/home/` - ana sayfa ve premium Home sözleşmesi
- `src/features/catalog/` - katalog, arama, ürün detayı, ürün deneyimi
- `src/features/cart/` - sepet, checkout ve sunucu doğrulamalı sepet sözleşmesi
- `src/features/auth/` - Supabase Auth, sosyal giriş, recovery, authorization ve MFA
- `src/admin/` - yönetim paneli ekranları ve operasyon araçları
- `src/pages/AdminPage.tsx` - capability tabanlı admin shell
- `supabase/migrations/` - veritabanı şema ve iş kuralları
- `supabase/functions/` - Edge Functions
- `android/` - gerçek Capacitor Android projesi
- `ios/` - gerçek Capacitor iOS projesi
- `scripts/` - release, güvenlik, veri, mimari ve regresyon auditleri
- `.github/workflows/` - kalite, release APK, Google Play ve diğer CI akışları
- `HOME_PRESTIGE_CONTRACT.md` - ana sayfa ürün satırı tasarım sözleşmesi
- `TASKLIST.md` - tarihsel ve devam eden uygulama görev kayıtları
- `PROJECT_STATE.json` - makine-okunur güncel durum
- `.env.example` - istemci ve server-side sağlayıcı değişkenlerinin güvenli şablonu

## 4. Yerel kurulum

Gerekenler:

- Node.js 22
- npm
- Android için Java 21 ve Android SDK 37
- iOS için macOS ve uyumlu Xcode

Kurulum:

```bash
cp .env.example .env.local
npm ci --no-audit --no-fund
npm run quality
npm run dev
```

`.env.local` içine en az aşağıdaki public Supabase değerleri girilmelidir:

```text
VITE_SUPABASE_URL=<Supabase project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<current publishable key>
VITE_PUBLIC_APP_ORIGIN=<public https origin>
VITE_AUTH_REDIRECT_URL=<public callback URL>
VITE_NATIVE_AUTH_REDIRECT_URL=com.goldenoremar.app://auth/callback
```

Gerçek provider secret'ları `VITE_` değişkenlerine kesinlikle konulmamalıdır. Ödeme, push ve benzeri secret'lar yalnız Supabase Edge Function secret veya ilgili güvenli provider/CI secret alanlarında tutulmalıdır.

## 5. Kalite kapısı

Ana kalite komutu:

```bash
npm run quality
```

Bu sırasıyla blocking auditleri, TypeScript kontrolünü ve production build'i çalıştırır.

Ayrı komutlar:

```bash
npm run audit:all
npm run lint
npm run build
npm run android:sync
npm run ios:sync
```

Son işlevsel merge öncesi ve sonrası doğrulamalar:

- Consolidation Preflight: başarılı
- TypeScript zero-error gate: başarılı
- Production Vite build: başarılı
- Authenticated customer E2E: başarılı
- Android native sync/build: başarılı
- Android signed release AAB: başarılı
- iOS simulator ve unsigned Release archive: başarılı
- Signed Release APK: başarılı
- Final main Signed Release APK workflow run: `33807690798`

## 6. Home tasarımında bozulmaması gereken sözleşme

`HOME_PRESTIGE_CONTRACT.md` ve `scripts/home-product-row-contract-audit.mjs` kaynak gerçeğidir.

Temel invariants:

- Bir ürün ana sayfada tek görsel satırdır.
- Yapı native `ul > li > a` olmalıdır.
- Ürün satırında yalnız bir ürün linki vardır.
- Görsel solda, kimlik/sinyal ortada, fiyat ve chevron sağdadır.
- Eski card-grid mimarisine geri dönülmemelidir.
- ProductCard içine duplicate `sr-only` ürün metni eklenmemelidir.
- `data-native-feature-marker="go-product-card-v2"` native CI sözleşmesidir ve görsel CSS class değildir.
- Ürün resmi `item.imagePath` kaynak gerçeğini kullanır.
- Eksik/kırık görsel fail-closed placeholder ile yönetilir.

Bu alanı değiştiren geliştirici sözleşme dosyasını ve blocking auditi birlikte, bilinçli olarak güncellemelidir.

## 7. Katalog ve ürün gerçeği

Canlı Supabase durumunda:

- toplam ürün: 50
- aktif yayındaki ürün: 42
- toplam aktif varyant: 50
- commerce profile: 50
- sales window: 16
- yayındaki 42 ürünün hikayesi en az 500 karakterdir
- `product_images` canlı tablo satırı: 0

Yeni 8 demo ürün güvenli biçimde yayın gerçeğine dönüştürülmeden müşteriye açılmamalıdır.

### Görsel gerçeği

50 ürün x 5 sahne için 250 managed WebP medya slotu/storyboard sözleşmesi hazırlanmıştır. Ancak gerçek 250 binary ürün fotoğrafı henüz canlı `product_images` tablosuna yüklenmiş değildir.

Bu nedenle:

- planlanmış medya slotlarını gerçek çekilmiş görsel olarak sunmayın,
- AI üretilmiş veya türetilmiş görselleri gerçek köy/hasat fotoğrafı diye etiketlemeyin,
- gerçek dosya Storage'a girmeden DB referansını yayın gerçeği saymayın,
- `catalog-media-verify` kalite doğrulamasını atlamayın.

Medya doğrulaması binary formatı, dosya uzantısı uyumu, checksum ve minimum 1200 x 1200 çözünürlük sözleşmelerini uygular.

## 8. Ürün hikayeleri ve merchandising

Ürün hikayeleri müşteri deneyiminde köken, üretim biçimi, mevsim, emek ve ürün karakterini anlatmak için kullanılır. Test/demo hikayeleri daha sonra gerçek üretici bilgisiyle doğrulanmalıdır.

Home merchandising sinyalleri nicel satış/popülerlik iddialarını uydurmamalıdır. Sunucu verisi olmadan kalıcı `en çok satan`, satış adedi veya stok kıtlığı gibi doğrulanamayan iddialar eklenmemelidir.

## 9. Ürün seçenekleri, fiyat ve sipariş snapshot sözleşmesi

Sipariş özelleştirmesi iki ayrı gerçeği korur:

1. Fiyat değiştiren paket/ağırlık seçimi sunucu-owned `product_variants` üzerinden gelir.
2. Kesim, parçalama, temizleme, olgunluk ve benzeri hazırlama seçenekleri ürün commerce/preparation sözleşmesinden gelir.

Kuzu/oğlak, balık, süt ürünleri, bal/arı ürünleri, meyve-sebze, mantar, ekmek ve diğer ürün aileleri için ürün tipine uygun seçenek altyapısı vardır.

Müşteri tarafından gelen fiyat asla doğrudan güvenilir kabul edilmez. Sunucu varyantı ve fiyatı yeniden doğrular. Seçilen hazırlama seçenekleri sepet ve sipariş kaleminde snapshot olarak korunur. Sipariş verildikten sonra katalog verisinin değişmesi eski siparişin seçimini değiştirmemelidir.

Admin fiyat varyant yönetimi SKU, paket/ağırlık etiketi, fiyat, karşılaştırma fiyatı, varsayılan varyant ve aktiflik alanlarını yönetir. Gerçek işletme verisi olmadan sahte ikinci fiyat eklenmemelidir.

## 10. Mevsim, ön sipariş ve bildirim

`product_commerce_profiles`, `product_sales_windows` ve availability subscription altyapısı:

- sürekli satış,
- mevsimlik ürün,
- ön sipariş,
- hazırlık süresi,
- satış penceresi,
- sezon açılınca haber verme

gibi davranışları taşır.

Doğrulanmamış sezon tarihleri otomatik biçimde müşteri satış gerçeğine çevrilmemelidir. Sezon ve hasat bilgileri coğrafya/üretici verisiyle doğrulanmalıdır.

## 11. Admin paneline giriş

Admin için ayrı hardcoded kullanıcı adı veya şifre yoktur. Normal Supabase Auth hesabı kullanılır.

Canlı sistemde aktif `super_admin` rolüne sahip 1 hesap bulunmaktadır. Handoff paketi bu hesabın e-posta adresini veya şifresini içermez.

Giriş akışı:

1. Uygulamayı açın.
2. Alt menüden `Hesabım` bölümüne gidin.
3. Super admin/admin hesabının e-posta ve şifresiyle normal hesap girişini yapın.
4. Sunucu `admin_session_status()` RPC'si ile `admin.access` capability'sini yeniden doğrular.
5. Yetki doğruysa Hesabım > `Üretici & Yönetim` bölümünde `Yönetim Paneli` düğmesi görünür.
6. Düğmeye basarak admin shell'e girin.

Doğrudan route:

```text
/?tab=admin
```

Bu URL güvenlik bypass'ı değildir. Yetkili session yoksa uygulama kullanıcıyı hesap ekranına döndürür.

Admin tarafında capability kontrolü yalnız menü gizlemeye dayanmaz. Sunucu her kritik işlemde yetkiyi tekrar doğrular.

### Admin MFA

Staff MFA politikası aktif kullanıcı için zorunluysa `StaffMfaGate` TOTP doğrulaması ister. `admin.access` rolü tek başına MFA gereksinimini bypass etmez.

### Şifre bilinmiyorsa

Kod veya ZIP içinde admin şifresi aramayın. Şifreler kaynak kodda tutulmaz. Normal `Şifremi unuttum` akışıyla Supabase Auth recovery kullanılmalıdır. Mevcut yetkili super admin rol atamalarını `Role Governance` ekranından yönetmelidir. Rol tablolarını elle değiştirmek capability ve audit zincirini bozabileceği için önerilmez.

## 12. Admin panelinde bulunan başlıca alanlar

Admin shell capability'lere göre aşağıdaki modülleri açar:

- Dashboard
- Production Readiness
- Business Compliance
- Release Setup
- Appearance
- Official Store Products
- Product Health
- Products ve Product Approvals
- Safe Product Removal
- Orders ve Returns
- Stock ve Shipping Readiness
- Finance, Producer Payouts, Payment Controls
- Transactional Emails
- Users ve Account Erasure
- Role Governance
- MFA Security
- System Errors
- Content ve Categories
- Vendors ve Storefronts
- Store Follow Simulation
- Reviews ve Campaigns
- Notifications
- Vendor Applications
- Events ve Producer Event Submissions

Her kullanıcı bütün sekmeleri görmez. `adminCapabilities.ts` ve sunucu capability matrisi yetki kaynağıdır.

## 13. Supabase backend

Canonical project ref:

```text
rmfcziawxjgcnxexbrvw
```

2026-09-03 doğrulamasında:

- migration sayısı: 417
- latest migration: `20260903210427_add_product_price_variant_management_v1`
- Auth, Storage, PostgreSQL ve Edge Functions uygulamanın canlı backend'idir.

Yeni ortam kurarken `supabase/migrations` kronolojik kaynak gerçeğidir. DDL değişiklikleri yeni migration olarak eklenmelidir. Eski migrationları sonradan değiştirerek geçmişi yeniden yazmayın.

## 14. Android

Önemli değerler:

```text
applicationId: com.goldenoremar.app
versionName: 1.3.0
versionCode: 4
minSdk: 24
targetSdk: 37
compileSdk: 37
Java: 21
```

Build:

```bash
npm ci --no-audit --no-fund
npm run quality
npm run android:sync
cd android
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
./gradlew :app:bundleRelease
```

Release signing environment variables:

```text
ANDROID_KEYSTORE_FILE
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`.github/workflows/release-apk.yml` install edilebilir signed release APK üretir ve imzayı doğrular.

## 15. Google Play

Google Play publish workflow:

```text
.github/workflows/google-play-release.yml
```

Yeni uygulama yayını için AAB kullanılır. Workflow fail-closed çalışır ve aşağıdaki gerçek production secret'ların tamamını ister:

```text
ANDROID_UPLOAD_KEYSTORE_BASE64
ANDROID_UPLOAD_KEYSTORE_PASSWORD
ANDROID_UPLOAD_KEY_ALIAS
ANDROID_UPLOAD_KEY_PASSWORD
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

Bu secret'lar yoksa workflow market yayını yapmaz.

Son verilen 1.3.0 build 4 APK kurulabilir ve `apksigner` ile doğrulanmıştır, fakat CI release APK'sı ephemeral CI signing material kullanmıştır. Bu APK Google Play production upload key ile imzalanmış gibi temsil edilmemelidir.

Google Play production yayını, gerçek upload key ve Play service account bağlanmadan tamamlanmış sayılmaz.

## 16. iOS

```bash
npm ci --no-audit --no-fund
npm run quality
npm run ios:sync
npm run ios:open
```

CI iOS simulator build ve unsigned Release archive doğrulamasını gerçekleştirir. App Store production signing/provisioning Apple hesabı ve gerçek dağıtım kimlik bilgileri gerektirir.

## 17. Auth ve session modeli

- Supabase Auth canonical kimlik sağlayıcıdır.
- Email/password akışı vardır.
- Google/Facebook/Apple düğmeleri provider gerçekten konfigüre edilmedikçe kapalıdır.
- Native OAuth callback: `com.goldenoremar.app://auth/callback`
- Password recovery aynı güvenli callback koordinatörünü kullanır.
- Customer session sunucu RPC ile doğrulanır.
- Admin session ayrıca `admin.access` capability ve rol/MFA politikasıyla doğrulanır.

Retired Firebase müşteri runtime veya eski SQLite/Node auth yollarını geri getirmeyin.

## 18. Güvenlik prensipleri

- Client fiyatına güvenilmez.
- Client role iddiasına güvenilmez.
- Kritik admin işlemleri server capability kontrolü uygular.
- RLS ve private/public RPC sınırları korunur.
- Secret'lar `VITE_` olarak bundle'a sokulmaz.
- Kart verisi ve CVV uygulama veritabanında tutulmaz.
- Medya gerçekliği Storage binary doğrulaması olmadan kabul edilmez.
- Release workflow imza malzemesi eksikse fail-closed olmalıdır.

## 19. Başka bir yazılımın projeyi geliştirirken önce okuyacağı dosyalar

Önerilen sıra:

1. `PROJECT_HANDOFF.md`
2. `PROJECT_STATE.json`
3. `README.md`
4. `HOME_PRESTIGE_CONTRACT.md`
5. `TASKLIST.md`
6. `package.json`
7. `.env.example`
8. `src/App.tsx`
9. `src/features/auth/api.ts`
10. `src/pages/AdminPage.tsx`
11. `src/admin/adminCapabilities.ts`
12. `src/features/catalog/ProductDetailScreen.tsx`
13. `src/features/cart/api.ts`
14. `supabase/migrations/`
15. `scripts/run-all-audits.mjs`
16. `.github/workflows/mobile-quality.yml`
17. `.github/workflows/release-apk.yml`
18. `.github/workflows/google-play-release.yml`

## 20. Bilinen açık gerçekler ve sonraki güvenli işler

Aşağıdakiler yazılım hatası olarak gizlenmemelidir:

- 250 ürün medya slotunun gerçek binary fotoğrafları henüz canlı Storage/product_images zincirine tamamlanmadı.
- Yeni 8 demo ürün gerçek ürün/üretici bilgisi doğrulanmadan yayınlanmamalıdır.
- 50 ürünün 50 aktif varyantı vardır, ancak gerçek işletme verisi gelmeden uydurma fiyat/paket varyantı eklenmemelidir.
- Google Play production upload key ve service account dış hesap girdileridir.
- App Store production signing dış Apple hesap girdisidir.
- Ödeme, e-posta ve push sağlayıcılarını production-ready saymadan önce gerçek provider secret ve callback durumları yeniden doğrulanmalıdır.

## 21. Değişiklik yaparken zorunlu mühendislik akışı

1. Mevcut canonical contract ve migrationı okuyun.
2. Aynı işi yapan ikinci bir paralel sistem kurmayın.
3. Gerçek kullanım yerlerini doğrulamadan eski dosya silmeyin.
4. DB şema değişikliğini migration olarak ekleyin.
5. `npm run audit:all` çalıştırın.
6. `npx tsc --noEmit` veya `npm run lint` çalıştırın.
7. `npm run build` çalıştırın.
8. Native davranış etkileniyorsa Android ve iOS sync/build doğrulayın.
9. Auth, cart, order veya admin değişiyorsa authenticated E2E çalıştırın.
10. Release değişiyorsa imza ve artefakt doğrulamasını atlamayın.
11. Başarılı sonuçtan sonra `PROJECT_STATE.json` veya ilgili contract/checkpoint'i güncelleyin.

## 22. Handoff ZIP doğruluğu

`Complete Source Handoff` workflow'u kaynak ZIP'ini `git archive HEAD` ile oluşturur. Bu nedenle paket:

- tracked kaynak dosyalarını eksiksiz içerir,
- `.git` geçmiş metadata klasörünü içermez,
- `node_modules` içermez,
- yerel `.env` veya geliştirici secret'larını içermez,
- başka ortamda `npm ci` ile bağımlılıkları tekrar kurmaya uygundur.

Kullanıcıya teslim edilen genişletilmiş handoff ZIP'i ayrıca `_release/` altında son doğrulanmış APK ve SHA-256 dosyasını içerebilir. APK uygulama kaynağının yerine geçmez, yalnız binary release kanıtıdır.
