# Web + Mobil Ortak Altyapı Yol Haritası

Bu dosya, sohbet limitleri arasında işin kaybolmaması için tutulan kalıcı
ilerleme kaydıdır. Yeni bir oturum başladığında **önce bu dosya okunur**,
sonra en üstteki tamamlanmamış adımdan devam edilir. Tamamlanan adım
işaretlenir ve commit edilir. Hiçbir adım tekrar yapılmaz.

Son güncelleme: 2026-09-25

---

## Temel mimari gerçek (değişmez)

Golden Oremar **tek kod tabanı** ile üç çıktı üretir: web (Vercel),
Android ve iOS (Capacitor). Veritabanı tek Supabase projesidir
(`rmfcziawxjgcnxexbrvw`).

Bu nedenle hesap, sepet, favori, sipariş, adres, ödeme, stok ve bildirim
zaten web ile mobil arasında **ortaktır**. Sepet ve favoriler sunucuda
tutulur, cihazda değil. "İki ayrı sistem" problemi yoktur ve yaratılmamalıdır.

Yeni iş kuralı eklenirken tek doğru yer Supabase fonksiyonlarıdır
(`private.*` gerçek mantık, `public.*` ince sarmalayıcı). Web ve mobil için
ayrı iş kuralı yazılmaz.

---

## Analiz raporu özeti (2026-09-24)

Gerçek eksikler, ölçülerek tespit edildi:

- **A. Ürünlerin kendi web adresi yok.** Gezinme `history.pushState` ve
  `?tab=` ile yapılıyor. `/urun/<slug>` gibi paylaşılabilir adres yok.
  Sonuç: WhatsApp paylaşımı ürüne gitmiyor, Google ürünleri ayrı bulamıyor,
  mobil derin bağlantı çalışamıyor.
- **B. SEO neredeyse sıfır.** `index.html` içinde tek başlık ve tek açıklama
  var. Ürün başına meta, Open Graph, `Product` şeması yok. SSR veya
  prerender kütüphanesi yok. Google tüm sitede tek sayfa görüyor.
- **C. Mobil derin bağlantı yok.** `public/.well-known/` klasörü yok
  (`assetlinks.json`, `apple-app-site-association` yok).
- **D. Yasal sayfalar eksik.** Mevcut: gizlilik politikası, kullanım
  şartları. Eksik: mesafeli satış sözleşmesi, ön bilgilendirme formu,
  iade ve cayma hakkı, KVKK aydınlatma metni, çerez politikası.
  İlk ikisi ödeme almadan önce yasal zorunluluktur (6502 sayılı Kanun).
- **E. Domain bağlı değil.** Kodda `goldenoremar.com` geçiyor, site
  `golden-oremar.vercel.app` üzerinde.
- **F. Misafir sepeti belirsiz.** Sepet birleştirme kodu bulunamadı,
  test edilmeli.

---

## Aşamalar

Sıra bağımlılık nedeniyle bu şekildedir. SEO ve derin bağlantı, temiz
adresler olmadan yapılamaz.

### Aşama 1 — Temiz URL yönlendirmesi

Durum: **BÜYÜK KISMI TAMAMLANDI** (1.7 cihaz testi ve 1.9 bekliyor)

Hedef adresler:

- `/` ana sayfa
- `/urun/<slug>` ürün detayı
- `/kategori/<slug>` kategori
- `/uretici/<slug>` üretici mağazası
- `/sepet`, `/favoriler`, `/hesabim`, `/siparisler`
- mevcut `?tab=` adresleri geriye dönük çalışmaya devam etmeli
  (eski paylaşılmış linkler kırılmamalı)

Adımlar:

- [x] 1.1 Gezinme haritalandı. Bulgu: adres↔ekran eşlemesi zaten tek yerde
      (`src/features/navigation/appUrl.ts`). `routeFromPath` temiz yolları
      zaten okuyordu; sadece `build*Url` fonksiyonları `?tab=` üretiyordu.
      Uygulamanın yeniden yazılması gerekmedi.
- [x] 1.2 `PUBLIC_PATH` sabiti eklendi (tek kaynak): urun, uretici, kategori,
      etkinlikler, ara
- [x] 1.3 `/urun/<slug>`
- [x] 1.4 `/kategori/<slug>`, `/uretici/<slug>`, `/etkinlikler/<slug>`, `/ara?q=`
- [x] 1.5 Eski `?tab=` ve İngilizce `/product/`, `/producer/` adresleri
      okunmaya devam ediyor (yönlendirme değil, doğrudan destek)
- [x] 1.6 `vercel.json` catch-all eklendi. Nokta hariç tutan kalıp
      kullanılmadı: slug'lar nokta içerebiliyor (`bal-1.5kg`)
- [ ] 1.7 Android geri tuşu cihazda test edilmeli (sandbox'tan yapılamaz).
      Tarayıcı geri tuşu mantığı değişmedi, `popstate` aynı
      `parsePublicRoute`'u kullanıyor
- [x] 1.8 tsc, build, 46 denetim, vite preview üzerinde doğrudan erişim
      testi (tüm yeni yollar 200). Kalıcı davranış denetimi eklendi:
      `scripts/public-route-contract-audit.mjs`
- [ ] 1.9 Sekme adresleri hâlâ `?tab=cart` biçiminde. `/sepet`, `/hesabim`
      gibi temiz sekme yolları istenirse ayrıca yapılır (SEO için önemsiz,
      bu sayfalar indekslenmez)

Yan bulgular ve düzeltmeler:

- `tabUrl` mevcut yolu koruyordu. `/urun/x` sayfasından sepete geçiş
  `/urun/x?tab=cart` üretirdi. Kök yola sıfırlandı.
- `toPublicShareUrl` mobilden paylaşımda sadece `?` sonrasını
  kopyalıyordu. Temiz adreslerle ürün paylaşımı ana sayfaya giderdi.
  Yol da kopyalanıyor.
- `customer-event-contract-audit` eski kodun birebir yazılışını arıyordu.
  Amacı korunarak yeni biçime uyarlandı; bozuk kodu hâlâ reddettiği
  negatif kontrolle doğrulandı.
- Misafir sepeti yok: giriş yapmadan sepete ekleme hesaba yönlendiriyor.
  Birleştirme problemi yoktur (Aşama 5.1 buna göre kapandı).

Risk: gezinmenin temeli değişiyor, her ekranı etkiliyor. Parça parça
yapılacak, her adımda build ve audit çalıştırılacak.

### Aşama 2 — SEO

Durum: **KOD TAMAMLANDI, CANLIDA DOĞRULANMALI** (bkz. 2.7)

- [x] 2.1 Ürün başına başlık, açıklama, canonical (`src/features/seo/seoModel.ts`)
- [x] 2.2 Open Graph ve Twitter Card. Ana sayfaya da og:image eklendi (önceden yoktu)
- [x] 2.3 JSON-LD: Product, Offer, Brand, BreadcrumbList, Organization
- [x] 2.4 `scripts/prerender-seo.mjs`, `npm run build` içinde. Sayfalar
      `urun/<slug>.html` olarak yazılır, `vercel.json` içinde `cleanUrls`
      açık. `<slug>/index.html` DENENDİ VE ÇALIŞMADI: sunucu sondaki `/`
      olmadan klasör indeksini çözmüyor, istek SPA'ya düşüyor ve hazır
      başlık hiç sunulmuyordu
- [x] 2.5 `sitemap.xml` ve `robots.txt` derleme anında üretilir
- [x] 2.6 InStock / OutOfStock / PreOrder doğru eşleniyor
- [ ] 2.7 **CANLIDA DOĞRULA** (sandbox Supabase'e ve Vercel'e erişemiyor):
      a) `golden-oremar.vercel.app/sitemap.xml` 40+ URL içeriyor mu
         (sadece 1 URL varsa derleme sırasında Supabase'e ulaşılamamış:
         Vercel build log'unda `[seo-prerender] WARNING` ara)
      b) Bir ürün linkini WhatsApp'a yapıştır: ürün adı ve görseli
         önizlemede çıkıyor mu
      c) `cleanUrls` sonrası `/gizlilik-politikasi` hâlâ açılıyor mu
      d) Google Rich Results Test ile bir ürün sayfası

### Aşama 3 — Yasal sayfalar

Durum: **TASLAKLAR HAZIR, SATICI KİMLİĞİ VE AVUKAT BEKLENİYOR**

**ENGEL (2026-09-25):** Veritabanında satıcı kimliği yok. `legal_name` =
"Golden Oremar" (marka adı), yasal adres / vergi dairesi / vergi no BOŞ.
Satıcı unvanı olmadan ne mesafeli satış sözleşmesi geçerli olur ne de
iyzico başvurusu onaylanır. Bu bir iş kararıdır, kod sorunu değildir.
Ayrıntı: `docs/legal/taslak/README.md`.

- [x] 3.1 `docs/legal/taslak/MESAFELI_SATIS_SOZLESMESI.md`
- [x] 3.2 `docs/legal/taslak/ON_BILGILENDIRME_FORMU.md`
- [x] 3.3 `docs/legal/taslak/IADE_VE_CAYMA.md` - gıdaya özel cayma
      istisnaları (çabuk bozulan ve ambalajı açılan ürünler) ayrıntılı
- [x] 3.4 `docs/legal/taslak/KVKK_AYDINLATMA_METNI.md` - şemadan çıkarılan
      gerçek veri listesiyle. Veriler Frankfurt'ta: KVKK md. 9 yurt dışı
      aktarımı avukata soruldu
- [x] 3.5 `docs/legal/taslak/CEREZ_POLITIKASI.md` - kod taraması: hiç
      izleme/reklam aracı yok, çerez yazılmıyor. Sadece zorunlu depolama,
      bu yüzden çerez izin penceresi GEREKMİYOR
- [ ] 3.6 Ödeme adımında onay kutusu + onaylanan sözleşme sürümünün
      siparişle birlikte kaydedilmesi. BLOKLU: satıcı kimliği ve avukat
- [ ] 3.7 Ürün sayfasında "cayma hakkı yoktur" etiketi. Veritabanında
      `products.is_perishable` alanı ZATEN VAR, etiket buradan
      beslenebilir. Ambalaj açılma istisnası için ayrı bir alan gerekebilir
- [ ] 3.8 Taslakları statik sayfaya çevirip yayınlama (avukat onayından
      sonra, `gizlilik-politikasi` ile aynı yapıda)

**Uyarı:** Yasal metinler taslaktır. Satıcı unvanı, vergi numarası, adres,
cayma süresi gibi kesin bilgiler içerir. **Avukat onayı olmadan yayına
alınmaz.**

### Aşama 4 — Domain ve mobil derin bağlantı

Durum: **KOD TAMAMLANDI (Android), İSHAK'IN DEĞERLERİ BEKLENİYOR**

- [ ] 4.1 `goldenoremar.com` Vercel'e bağlanır (İshak yapar)
- [x] 4.2 `assetlinks.json` derleme anında `scripts/write-well-known.mjs`
      tarafından `ANDROID_APP_SHA256_FINGERPRINTS` ortam değişkeninden
      üretilir. Değişken yoksa dosya yazılmaz, linkler tarayıcıda açılır
- [x] 4.3 `apple-app-site-association` aynı şekilde `APPLE_TEAM_ID`
      değişkeninden. `vercel.json` Content-Type başlığını ayarlar
- [x] 4.4 `useNativeDeepLinks` (açıkken + soğuk başlatma, tekrar
      engelleme). Android `AndroidManifest.xml` autoVerify filtresi
      eklendi. Mevcut auth dinleyicisi (`useAuthRecoveryCoordinator`)
      bozulmadı: `resolveDeepLinkTarget` auth URL'leri için null döner
- [ ] 4.4b iOS Associated Domains entitlement'ı. Apple Developer hesabı ve
      Xcode gerekir; `pbxproj` elle düzenlenmedi (risk)
- [ ] 4.5 Cihazda test: WhatsApp'tan ürün linkine tıkla, uygulama o ürünü
      açmalı. Sandbox'tan yapılamaz

Güvenlik kararları:

- Sadece `DEEP_LINK_HOSTS` içindeki https alan adları kabul edilir
- Link ile hesap, sepet, sipariş veya yönetim ekranı ASLA açılmaz, ana
  sayfaya düşer. Dokunulan bir link kimseyi oturum açılmış ekrana atmamalı
- Android manifest, Apple dosyası ve `PUBLIC_PATH` aynı yolları
  tanımlamak zorunda; `public-route-contract-audit` bunu kilitler
  (negatif kontrolle doğrulandı)

### Aşama 5 — Doğrulama

Durum: **SIRADAKİ** (cihaz ve canlı erişim gerektiren testler)

- [x] 5.1 Misafir sepeti yok, birleştirme gerekmiyor (bkz. Aşama 1)
- [ ] 5.2 Web'de ekle, mobilde gör testi
- [ ] 5.3 Ürün paylaş, linkten aç testi

---

## Aşama 2 tasarım kararları (tekrar tartışılmasın)

- Meta ve JSON-LD tek dosyada üretilir: `seoModel.ts`. Hem derleme hem
  uygulama aynı fonksiyonu kullanır. İkisi ayrışırsa Google fiyat
  uyuşmazlığı nedeniyle zengin sonucu düşürür.
- Derleme anında 42 ayrı ürün detay çağrısı yerine TEK çağrı
  (`get_public_home_catalog_v3`) kullanılır. Her yayında kota harcamamak için.
- Prerender ASLA derlemeyi durdurmaz. Veri çekilemezse uyarı verir, ana
  sayfa ve robots/sitemap yine üretilir. Kota dolu olsa bile yayın çıkar.
- Yorum yoksa `aggregateRating` yazılmaz. Sahte puan tüm sitenin zengin
  sonuçlarını düşürebilir.
- Gerçek fiyat yoksa `Offer` yazılmaz.
- Ürün adlarını üreticiler yazar, yani güvenilmezdir. JSON-LD `<`, `>`, `&`
  kaçırılır; nitelikler HTML kaçırılır. `seo-contract-audit.mjs` bunu
  kilitler; negatif kontrolle doğrulandı.
- Slug dosya yolu olur, `isSafeSlug` + `dist` dışına yazma kontrolü ile
  korunur. `../../etc/passwd` testte reddedildi.
- Yeni eklenen ürünün bir sonraki yayına kadar hazır sayfası olmaz. İstek
  SPA'ya düşer, uygulama başlığı canlı veriyle günceller. Bu kabul edilen
  bir sınırdır; çözüm periyodik yeniden derlemedir (Vercel deploy hook).

## İshak'ın yapması gerekenler (kod dışı)

- [ ] Supabase Pro plana geçiş (kota kısıtlaması)
- [ ] Uygulama önbelleğini temizleme veya yeniden kurma
- [ ] Ürün fotoğraflarını yükleme
- [ ] Authentication ayarlarında "Leaked password protection" açma
- [ ] `goldenoremar.com` domainini Vercel'e bağlama
- [ ] Vercel ortam değişkeni `ANDROID_APP_SHA256_FINGERPRINTS`: Play
      Console > Kurulum > Uygulama bütünlüğü içindeki uygulama imzalama
      anahtarı VE yükleme anahtarının SHA-256 parmak izleri, virgülle
- [ ] Vercel ortam değişkeni `APPLE_TEAM_ID` (Apple Developer hesabı)
- [ ] Değişkenlerden sonra yeniden yayınla (redeploy)
- [ ] **Satıcı tüzel kişiliğine karar ver** (mevcut aile şirketi mi,
      yeni şirket mi) - mali müşavire danış. İsviçre ikameti ayrıca
      değerlendirilmeli
- [ ] Gıda işletme kayıt/onay belgesi (Tarım ve Orman Bakanlığı il
      müdürlüğü)
- [ ] Yasal metinleri avukata okut: `docs/legal/taslak/README.md`
      içindeki kontrol listesiyle
- [ ] iyzico başvurusu

---

## Kurallar

- Her adım bitince bu dosyada işaretlenir ve commit edilir.
- Yeni oturum bu dosyayı okuyarak başlar.
- Çalışan kod gereksiz yere yeniden yazılmaz.
- Her değişiklikten sonra: `tsc`, `build`, `audit:all`.
- Push sayısı gereksiz artırılmaz: E2E testleri canlı Supabase'e bağlanır
  ve kota tüketir. Belge ve migration değişiklikleri artık testi
  tetiklemez (`paths-ignore`), ama uygulama kodu değişiklikleri tetikler.
