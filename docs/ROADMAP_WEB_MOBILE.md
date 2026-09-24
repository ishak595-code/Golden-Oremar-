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

Durum: **SIRADAKİ** (Aşama 1 hazır)

- [ ] 2.1 Ürün başına başlık, açıklama, canonical
- [ ] 2.2 Open Graph ve Twitter Card (WhatsApp/Instagram önizlemesi)
- [ ] 2.3 JSON-LD: Product, Offer, Brand, BreadcrumbList, Organization
- [ ] 2.4 Derleme anında ürün sayfalarını hazır HTML olarak üret
      (prerender), Google içeriği görebilsin
- [ ] 2.5 `sitemap.xml` ve `robots.txt`
- [ ] 2.6 Stokta olmayan ürün için doğru `availability` değeri

### Aşama 3 — Yasal sayfalar

Durum: bekliyor

- [ ] 3.1 Mesafeli satış sözleşmesi taslağı
- [ ] 3.2 Ön bilgilendirme formu taslağı
- [ ] 3.3 İade ve cayma hakkı
- [ ] 3.4 KVKK aydınlatma metni
- [ ] 3.5 Çerez politikası
- [ ] 3.6 Ödeme adımında onay kutuları

**Uyarı:** Yasal metinler taslaktır. Satıcı unvanı, vergi numarası, adres,
cayma süresi gibi kesin bilgiler içerir. **Avukat onayı olmadan yayına
alınmaz.**

### Aşama 4 — Domain ve mobil derin bağlantı

Durum: bekliyor (domain bağlanmasına bağlı)

- [ ] 4.1 `goldenoremar.com` Vercel'e bağlanır (İshak yapar)
- [ ] 4.2 `public/.well-known/assetlinks.json` (Android App Links)
- [ ] 4.3 `public/.well-known/apple-app-site-association` (iOS)
- [ ] 4.4 Capacitor tarafında derin bağlantı dinleyicisi
- [ ] 4.5 Linkten ürüne atlama testi

### Aşama 5 — Doğrulama

- [x] 5.1 Misafir sepeti yok, birleştirme gerekmiyor (bkz. Aşama 1)
- [ ] 5.2 Web'de ekle, mobilde gör testi
- [ ] 5.3 Ürün paylaş, linkten aç testi

---

## İshak'ın yapması gerekenler (kod dışı)

- [ ] Supabase Pro plana geçiş (kota kısıtlaması)
- [ ] Uygulama önbelleğini temizleme veya yeniden kurma
- [ ] Ürün fotoğraflarını yükleme
- [ ] Authentication ayarlarında "Leaked password protection" açma
- [ ] `goldenoremar.com` domainini Vercel'e bağlama
- [ ] Yasal metinleri avukata okutma
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
