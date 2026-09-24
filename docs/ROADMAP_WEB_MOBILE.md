# Web + Mobil Ortak Altyapı Yol Haritası

Bu dosya, sohbet limitleri arasında işin kaybolmaması için tutulan kalıcı
ilerleme kaydıdır. Yeni bir oturum başladığında **önce bu dosya okunur**,
sonra en üstteki tamamlanmamış adımdan devam edilir. Tamamlanan adım
işaretlenir ve commit edilir. Hiçbir adım tekrar yapılmaz.

Son güncelleme: 2026-09-24

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

Durum: **BAŞLADI**

Hedef adresler:

- `/` ana sayfa
- `/urun/<slug>` ürün detayı
- `/kategori/<slug>` kategori
- `/uretici/<slug>` üretici mağazası
- `/sepet`, `/favoriler`, `/hesabim`, `/siparisler`
- mevcut `?tab=` adresleri geriye dönük çalışmaya devam etmeli
  (eski paylaşılmış linkler kırılmamalı)

Adımlar:

- [ ] 1.1 Mevcut gezinme sistemini haritala (App.tsx, sekmeler, geri tuşu,
      derinlik takibi). Hiçbir şey değiştirmeden önce tam anla.
- [ ] 1.2 Adres ↔ ekran eşleme katmanı yaz (tek kaynak, test edilebilir)
- [ ] 1.3 Ürün detayını `/urun/<slug>` ile açılabilir yap
- [ ] 1.4 Kategori ve üretici adresleri
- [ ] 1.5 Eski `?tab=` adreslerini yeni adreslere yönlendir
- [ ] 1.6 Vercel `rewrites` ile tüm yolların SPA'ya düşmesini sağla
      (sayfa yenilemede 404 olmasın)
- [ ] 1.7 Android geri tuşu ve tarayıcı geri tuşu doğru çalışıyor mu test
- [ ] 1.8 tsc + build + audit:all + manuel gezinme testi

Risk: gezinmenin temeli değişiyor, her ekranı etkiliyor. Parça parça
yapılacak, her adımda build ve audit çalıştırılacak.

### Aşama 2 — SEO

Durum: bekliyor (Aşama 1'e bağlı)

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

- [ ] 5.1 Misafir sepeti ve giriş sonrası birleştirme testi
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
