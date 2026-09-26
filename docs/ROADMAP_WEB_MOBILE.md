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
- [x] 2.7a Canlı doğrulama yapıldı (2026-09-25, Vercel MCP ile):
      tüm yayınlar READY; `/gizlilik-politikasi` cleanUrls sonrası 200;
      ana sayfada og:image ve Organization şeması canlıda var.
      **Sitemap sadece 1 URL**: derleme log'unda
      `get_public_home_catalog_v3 returned HTTP 402`. Supabase kotası hâlâ
      kısıtlı. Pro'ya geçince YENİDEN YAYINLA, ürün sayfaları o zaman oluşur
- [x] 2.7b **CANLIDA BULUNAN KRİTİK HATA**: her temiz adres 404 veriyordu.
      `cleanUrls` açıkken catch-all hedefi `/index.html` artık geçerli
      değil. `/` yapıldı, canlıda 200 doğrulandı (commit 17a993c).
      vite preview bu hatayı YAKALAYAMAZ: Vercel'in cleanUrls davranışını
      taklit etmiyor. Yerel test yetmez, canlıda Vercel MCP ile doğrula
- [x] 2.7c Ana sayfa HTML'inden canonical ve og:url kaldırıldı. index.html
      tüm hazırlanmamış adreslerin yedeği olduğu için, ana sayfa canonical'ı
      her ürün adresine "ben ana sayfayım" dedirtiyordu
- [ ] 2.7 Kota açılıp yeniden yayınlandıktan sonra tekrar doğrula (sandbox Supabase'e ve Vercel'e erişemiyor):
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
- [x] 3.7 Ürün sayfasında cayma hakkı bildirimi, satın alma kontrollerinin
      hemen ardından. Üç kademe (`src/features/catalog/withdrawalRight.ts`):
      bozulabilir -> cayma yok; `non_food` -> 14 gün; diğer gıda -> ambalaj
      açılmamışsa 14 gün. Kaynak: detayın zaten döndürdüğü
      `handlingProfile`, yeni veritabanı değişikliği gerekmedi. Kategori
      adından türetilmez: kurutulmuş yoğurt süt kategorisinde, kurutulmuş
      hurma taze ürün kategorisinde ve ikisi de doğru olarak raf ömrü uzun.
      Veri eksikse hiçbir iddia yapılmaz. Her bildirim ayıplı mal hakkının
      sürdüğünü söyler. `consumer-rights-contract-audit` canlı katalogdaki
      18 ürün sınıfını kilitler
- [ ] 3.7b Aynı bildirim sepette ve ödeme özetinde de gösterilmeli (ön
      bilgilendirme formunun parçası). Ödeme açılınca yapılmalı
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

Durum: **DEVAM EDİYOR**

**EN ÖNEMLİ BULGU (2026-09-25):** Supabase public API'si HTTP 402 döndürüyor.
Uygulamanın kendisi de bu API'yi kullanıyor, yani şu an müşteriler ürünleri
göremiyor. Kod tarafında yapılacak bir şey yok: Pro plan veya aylık sıfırlama.

Canlı doğrulama aracı: Vercel MCP (`web_fetch_vercel_url` canlı sayfayı,
`list_deployment_events` derleme log'unu okur). Sandbox Supabase'e ve
vercel.app'e doğrudan erişemez ama bu araçla erişilebilir.

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

## Tüm ekranlar, tüm cihazlar - 2026-09-26

Tarayıcı test düzeneği artık REPODA: `scripts/browser/` (kurulum `lib.mjs`
başında). Bir önceki oturumun düzeneği, bulut ortamı sıfırlanınca kayboldu;
bu yüzden kalıcı hale getirildi. Test verileri üretimden alındı:
`scripts/browser/fixtures/`. Üç betik:

- `responsive-check.mjs`: 6 ekran x 6 genişlik (320-1280). Sayfa taşması,
  sağ kenardan taşan öğe, "…" çalışmadan kesilen metin, 24 pikselden küçük
  dokunma alanı ve karta dokununca ürün sayfasının açılması. Gerçek veri ve
  `FIXTURE=search_stress.json` (en uzun isimler, 7 haneli fiyat) ile 72/72
- `resilience-check.mjs`: 7 kısmi kesinti senaryosu, 7/7
- `a11y-check.mjs`: 6 ekranda tam axe taraması + açık arama paneli + ürün
  sayfası video/iade kontrolleri, 19/19

Bulunan ve düzeltilen gerçek hatalar:

- **Alt menü 320 pikselde "Hesabım"ı kesiyordu.** 5 x 64 piksel zorunlu
  genişlik sığmıyordu. Android'in ekran boyutu erişilebilirlik ayarı da
  ekranı daralttığı için büyük yazı kullanan herkesi etkiliyordu
- **Filtre sayıları yüklenemezse kategori sayfasındaki bütün ürünler
  kayboluyordu** (Promise.all), ayrıca iki sorgu arasında bir ürün yayınlanırsa
  toplamlar tutmadığı için liste hataya düşüyordu (yarış durumu). Artık
  filtre sayıları ikincil: düşerse sadece sayılar gizlenir
- **Ana sayfa tek hata noktasıydı.** Vitrin ayarı sorgusu düşünce, katalog
  elde olsa bile ilk kez gelen müşteri hata ekranı görüyordu. Artık katalogdan
  sade bir vitrin kurulur (sadece öne çıkan ürünler, gerçek vitrinle aynı
  doğrulayıcıdan geçer, önbelleğe yazılmaz)
- **Ürün satırında rozetler kelime ortasından kesikti** ("İmza s"):
  `inline-flex` üzerinde text-overflow hiç çalışmaz. İsimler tek satıra
  sıkışıyordu. Artık isim 2 satır (dar ekranda 3), rozet bütün, bölge
  satırın kendi genişliğine göre "Yüksekova, Hakkâri" veya "Hakkâri"
  (CSS container query; kurallar dosya SONUNDA olmalı, yoksa ezilir)
- **Tüm kategori kartları aynı yaprak ikonunu gösteriyordu**; veritabanındaki
  ikon (Fish, Droplet, Sun...) hiç kullanılmıyordu
- **Öneriler başlığındaki buton** telefonda "Bal & Dağ Bitkileri kat" diye
  kesik ve oksuzdu. Artık "Tümünü gör ›", ekran okuyucu tam cümleyi okur
- **Arama kutusunda geçersiz ARIA** (`aria-expanded` searchbox'ta yasak,
  axe "kritik"): artık WAI-ARIA combobox + dialog açılır alan kalıbı.
  Açık öneri panelinde 7 kontrast hatası da düzeltildi
- Sesli arama eklentisi iki yerde kaydediliyordu; tek modüle alındı
  (`src/lib/nativeSpeechPlugin.ts`)

- **Sekme adresleri ürün yolunu koruyordu (beş kopya).** Ürün sayfasından
  "Tümünü gör" `/urun/<slug>?tab=categories`, "sepete git"
  `/urun/<slug>?tab=cart` üretiyordu: ekran değişiyor, adres ürünü
  gösteriyordu; paylaşılan/taranan bağlantı ürünün SEO sayfasını alıyordu.
  Faz 1'de sadece App.tsx'teki kopya düzeltilmişti. Artık tek fonksiyon:
  `buildTabUrl` (appUrl.ts); `public-route-contract-audit` başka yerde
  sekme adresi kurulmasını yasaklar (negatif kontrolle doğrulandı)

Kilit: `responsive-resilience-contract-audit.mjs` (3 negatif kontrolle
doğrulandı). Denetim sayısı: 51. Tarayıcı: `navigation-check.mjs` 14/14
(butonlar, alt menü, geri, adres çubuğu ve yenileme).

**GitHub erişimi (2026-09-26, ÇÖZÜLDÜ):** bulut oturumları artık PAT ile
değil, Claude GitHub App ile yazıyor. İshak claude.ai/code'dan GitHub'ı
bağladı ve uygulamayı depoya kurdu; oturumda `add_repo` ile depo eklenir.
Commit yazarı `Claude <noreply@anthropic.com>` olmalı (yoksa GitHub
"Unverified" gösterir). İki commit gönderildi, Vercel 6d2ae23 READY.
Supabase hâlâ HTTP 402 (kota): SEO ürün sayfaları kota açılınca oluşur.

**Tarayıcı testlerinden öğrenilen tuzaklar:** sabit test yanıtı kullanma,
istemci sayfa boyutunu kendi isteğiyle karşılaştırıyor (limit/offset'i
yansıt); marka ayarını mutlaka gerçek veriyle ver; `sr-only` öğeleri kesik
sayma; aynı komut satırında `pkill -f "[v]ite preview"` ve sunucu başlatma
olursa pkill kendi kabuğunu öldürür, ayrı komutlarda çalıştır.

## Tarayıcı testleri ve erişilebilirlik - 2026-09-25

İshak görme engelli olduğu için cihaz testlerini yapamıyor; testleri Claude
yapar. Sandbox'ta gerçek tarayıcı çalıştırmanın yolu: npm'den
`@sparticuz/chromium@131` + `playwright-core@1.56.0` (Playwright'ın kendi
indirmesi ağ kısıtı yüzünden engelli). Tarayıcı `--single-process` ve
`--no-zygote` argümanları ÇIKARILARAK başlatılmalı, yoksa yeni oturum açınca
çöker. Sandbox Supabase'e bağlanamadığı için RPC istekleri, Supabase MCP ile
canlıdan çekilmiş GERÇEK verilerle taklit edilir. Marka ayarı
(`get_public_brand_appearance_v1`) mutlaka gerçek veriyle taklit edilmeli:
boş bırakınca yedek renkler devreye girip yanlış alarm üretir (8 sahte ihlal
görüldü). DİKKAT: `pkill -f "vite preview"` kendi komut satırını da öldürür,
`pkill -f "[v]ite preview"` kullan.

Sonuçlar (412x915 telefon ekranı):
- Video: 16/16 test geçti. Oynat'a basılmadan YouTube'a hiç bağlanılmıyor,
  Shorts dikey, iframe'de allowfullscreen ve doğru referrer var
- **Kök hata bulundu ve düzeltildi:** Tailwind `dark:` varyantı sadece
  `data-theme="dark"` ile eşleşiyordu, ama varsayılan tema "custom" ve
  koyu. Uygulamadaki 2500'ü aşkın `dark:` sınıfının HİÇBİRİ varsayılan
  temada çalışmıyordu. Giriş ekranında "Hesap Aç" butonu, e-posta ve şifre
  etiketleri beyaz kart üstünde beyaza yakındı; yeni müşteri hesap açma
  butonunu göremiyordu. Varyant artık `data-color-scheme`'e bağlı
  (`setDocumentColorScheme`, hem tema hem marka ayarı buradan yazar).
  Ölçüm: 6 ekranda 39 kontrast ihlali -> 0. Tam axe taraması ihlal yok.
  `theme-contract-audit` kilitler, negatif kontrolle doğrulandı
- Android tam ekran: sandbox'ta Android olmadığı için cihazda denenemedi;
  kod APK derlemesinde derlendi. Fiziksel cihaz testi hâlâ açık

## Kota (egress) araştırması - 2026-09-25

İshak'ın haklı itirazı: "Pro'ya geçsem de, kotayı hızla tüketen şey
bulunmazsa hiçbir şey değişmez." Önceki "E2E testleri bitirdi" açıklaması
ÖLÇÜLMEMİŞ bir tahmindi. Ölçüm sonuçları:

- Hata türü `exceed_cached_egress_quota`: CDN'den sunulan DEPOLAMA trafiği,
  veritabanı API'si değil.
- Depolamada şu an 11 dosya, toplam 12 KB. Müşterinin gördüğü iki marka
  görseli 1 yıl önbellekli (doğru). 9 dosya E2E testlerinin canlıya
  yüklediği 21-68 baytlık test görseli.
- Son 24 saatte API'ye sadece 171 istek. Şu an kotayı yiyen bir döngü YOK.
- Videolu ürün yok.
- **Geçmişte kotayı neyin bitirdiği bu verilerden bulunamaz**: ücretsiz
  planda log saklama 24 saat. Kesin cevap Supabase panelinde:
  Organization > Usage > Cached Egress günlük grafiği.

### Asıl gelecek tehdidi bulundu ve kapatıldı

Telefon fotoğrafları 3-8 MB ve yükleme yolları onları HİÇ küçültmüyordu.
42 ürüne fotoğraf yüklenince her ürün görüntüleme megabaytlar indirecekti:
5 GB yaklaşık 1000 görüntülemede, Pro'nun 250 GB'ı yaklaşık 50.000'de
biterdi. "Hızla tüketen şey" bu olacaktı.

Çözüm `src/lib/compressImage.ts`: yükleme öncesi tarayıcıda WebP'ye
çevirip küçültür. Tipik sonuç 200-400 KB (15-30 kat küçük). Resmi mağaza,
üretici ve kategori yüklemelerine bağlandı. Mağaza markası zaten canvas ile
küçültüyordu, dokunulmadı.

**KRİTİK KURAL:** `catalog-media-verify` genişlik VE yüksekliğin en az 1200
piksel olmasını şart koşar (`MIN_PRODUCT_IMAGE_EDGE`). İlk tasarım sadece
uzun kenarı küçültüyordu ve 9:16 dikey fotoğrafı 1125 piksele indirip
sunucuya reddettirecekti. Küçültme artık kısa kenar 1200'e ulaşınca durur.
`media-upload-contract-audit.mjs` bu iki değeri birbirine kilitler; sunucu
tabanı değişip araç değişmezse derleme kırılır.

### Mimari karar (tekrar tartışılmasın)

Büyük uygulamalar her işi ayrı sisteme verir: veri için ilişkisel
veritabanı, görsel için görsel CDN'i, video için video platformu.
Supabase veri için kalır (sipariş, stok, kullanıcı). Video için YouTube
(bedava) veya ileride Bunny Stream. Görseller şimdilik Supabase'de,
küçültülmüş olarak; trafik 250 GB/ay sınırına yaklaşınca Bunny CDN'e
taşınır. Erken taşıma, olmayan bir sorun için karmaşıklık eklemek olur.

### Hâlâ açık

- [x] Video oynatıcı `preload="metadata"` -> `preload="none"`: video artık
      sadece oynat'a basılınca iner (ProductSafetyPanel, tek video öğesi)
- [ ] **Video altyapısı: Bunny Stream'e taşı (KARAR BEKLİYOR).** Büyük
      uygulamaların yöntemi: sunucu videoyu birden çok kaliteye çevirir
      (transcoding), küçük parçalara böler (HLS), oynatıcı bağlantı hızına
      göre kalite seçer, video dokunulmadan inmez, yükleme kesilirse devam
      eder (TUS). Supabase bunların hiçbirini yapmaz ve CDN çıkışı pahalıdır.
      Bunny Stream: transcoding ve oynatıcı ücretsiz, depolama ~0,01 $/GB/ay,
      teslimat ~0,005-0,01 $/GB (AB/ABD; TÜRKİYE BÖLGE FİYATI DOĞRULANMALI),
      aylık 1 $ minimum, AB şirketi (Slovenya). Dikey/yatay her en-boy oranı
      korunur, ek iş gerekmez.
      Entegrasyon planı: İshak Bunny hesabı + API anahtarı açar -> Supabase
      Edge Function imzalı yükleme adresi üretir (anahtar asla istemciye
      gitmez) -> uygulama TUS ile doğrudan Bunny'ye yükler -> veritabanında
      sadece video kimliği tutulur -> oynatıcı HLS ile oynatır, kapak
      görseli gösterir
- [x] YouTube desteği (`src/features/media/`): watch, youtu.be, embed,
      nocookie, live ve Shorts linkleri tanınır; Shorts dikey oynatıcıda
      açılır. Dokunulana kadar sadece kapak resmi yüklenir (YouTube betiği
      ve izleme yok). Native WebView'da gömülü oynatma başarısız olursa
      diye her zaman "YouTube'da aç" bağlantısı var. javascript:, data:
      ve http reddedilir; denetimle kilitli
- [x] **Ürünün kendi videosu artık ürün sayfasında.** `private.get_public_product_detail_v10`
      (v9 + video alanı, katmanlı desen korundu, köprü v10'a çevrildi).
      YouTube linki SADECE resmi mağaza ürünlerinde döner - kural
      veritabanında, arayüz atlatılsa bile geçerli. Depolama yolu sadece
      dosya gerçekten varsa döner. Canlıda geri alınan işlemle test edildi
- [x] **Android'de YouTube tam ekran** (commit 91a64b1, APK derlemesi başarılı).
      Capacitor `BridgeWebChromeClient.onShowCustomView` tam ekranı
      `callback.onCustomViewHidden()` ile ANINDA REDDEDİYORDU; web'de çalışıp
      uygulamada çalışmıyordu. `FullscreenVideoChromeClient` onu genişletir
      (dosya seçici / kamera yüklemesi korunur), `onCreate` içinde kurulur.
      Yön zorla yataya çevrilmez (Shorts dikey), geri hareketi tam ekrandan
      çıkar. CİHAZDA TEST EDİLMELİ
- [x] **Yönetim paneline YouTube linki alanı** (İshak onayladı, 2026-09-25).
      Veritabanı: `public.management_upsert_product_v2` artık YouTube linkini
      kabul ediyor; desen tek yerde (`private.is_youtube_video_url_v1`), hem
      kaydetme hem v10 aynı fonksiyonu kullanıyor. `producer_upsert_product_v2`
      DOKUNULMADI: üreticiler sadece yüklenmiş video. Arayüz: tek izinli link
      alanı `official-youtube-link`; `normalizeYoutubeInput` yapıştırılan her
      biçimi (https'siz, youtu.be, Shorts, ?si= izleme parametreli) sunucunun
      kabul edeceği biçime çevirir, geçersizi kaydetmeden önce reddeder,
      geçerliyse önizleme gösterir. Link girilince bekleyen dosya temizlenir
      (kaydetme dosyayı linke tercih ettiği için sessizce ezilmesin).
      Denetim KALDIRILMADI, DARALTILDI; negatif kontrolle doğrulandı.
      Canlıda test: yetki kapısı işlem içinde taklit edilip geri alındı.
      YouTube kaydedildi; yabancı link ve doğrulanmamış dosya reddedildi
- [ ] **YÖNETİCİ İKİ ADIMLI DOĞRULAMA:** test sırasında görüldü ki hiçbir
      yöneticinin doğrulanmış TOTP'si yok. `private.has_permission` personel
      için TOTP + aal2 şart koşuyor. İshak yönetim panelinde ürün kaydetmek
      için bir doğrulayıcı uygulama (Google Authenticator vb.) kurmalı;
      uygulamadaki `StaffMfaGate` bu kurulumu yönetir. Tasarım gereği
- [ ] **Medya altyapısı: Cloudflare R2 (KÖKTEN ÇÖZÜM, hesap bekliyor).**
      Kayıt: https://dash.cloudflare.com/sign-up . R2'yi etkinleştirmek
      ödeme yöntemi ister (ücretsiz katmanda çekim olmaz; DOĞRULA).
      Üretim için özel alan adı gerekir (r2.dev hız sınırlıdır): alan adı
      Cloudflare DNS'inde olmalı. Anahtarlar sohbete YAPIŞTIRILMAZ, doğrudan
      Supabase > Edge Functions > Secrets'a girilir:
      R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
      R2_PUBLIC_BASE_URL
      Çıkış ücreti her zaman sıfır, kalıcı ücretsiz katman: 10 GB depolama,
      ayda 10 milyon okuma, 1 milyon yazma (Eylül 2026 doğrulandı).
      Medya için "kota doldu" sorunu yapısal olarak ortadan kalkar.
      Kullanıcı deneyimi DEĞİŞMEZ: yükleme yine yönetim panelinden, kamera
      ve galeriyle; uygulama arka planda R2'ye gönderir.
      DİKKAT: görsel doğrulama katmanı (`catalog-media-verify`,
      `verified_catalog_product_image_path_v1`,
      `catalog_media_binary_verified_path_v2`) `storage.objects` tablosuna
      bağlı. R2'ye geçişte bu katman da yeniden kurulmalı; yarım geçiş
      HİÇBİR ürünün yayınlanamamasına yol açar. Gerekenler: Cloudflare
      hesabı, R2 kovası, API anahtarı (Supabase Edge Function sırrı olarak,
      istemciye asla gitmez), özel alan adı (r2.dev üretim için değil)
- [ ] E2E testleri canlı veritabanında test kullanıcısı oluşturup dosya
      yüklüyor (9 artık dosya). Doğru çözüm ayrı bir test Supabase projesi

## İshak'ın yapması gerekenler (kod dışı)

- [ ] Supabase Pro plana geçiş (kota kısıtlaması) - ÖNCE panelden
      Usage > Cached Egress grafiğine bak, hangi gün patladığını gör
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
