# Golden Oremar UX Professionalization Tasklist

Bu dosya `release/ux-professionalization-2026-08` çalışmasının kalıcı ilerleme kaydıdır. Yeniden başlanırsa önce bu dosya okunmalıdır.

- [x] Madde 1: Arama kutusu mikrofon ikonunu gerçek izin/dinleme durumuna bağla; kapalı durumda açıkça kapalı ikon kullan. Doğrulama: Consolidation Preflight run `33254826377` success (`audit:all`, `tsc --noEmit`, production build).
- [x] Madde 2: Ana sayfa, kategori, ürün listesi ve boş durum dahil müşteri metinlerini sıcak, güven veren ve doğrulanabilir pazarlama diline geçir; metinleri tek merkezden yönet. Sunum dili `src/features/customer-experience/customerCopy.ts` altında merkezileştirildi; Home veri/sıra/source semantiği server-owned bırakıldı ve sahte bestseller/mevsim kampanyası iddiaları audit ile yasaklandı. Doğrulama: Consolidation Preflight run `33255234791` success (`audit:all`, `tsc --noEmit`, production build).
- [ ] Madde 3: Ana sayfa/kategori/arama ürün kartlarında erişilebilir alt metin ve tek-duyuş aria etiketi sağla; gerçek runtime erişilebilirlik davranışını doğrula.
- [ ] Madde 4: Ürün detay bilgi hiyerarşisini düzelt; fiyatı başlık yakınına taşı, satın alma aksiyonlarını ikincil öğelerden önce konumlandır, tekrarlayan teknik satırı kaldır. `shortDescription` veri olarak uzun/tekrarlıysa zorla kısaltma yapmadan ayrıca not et.
- [ ] Madde 5: Müşteri runtime akışlarını gerçek veriyle tara; ürün listesi, filtre, favoriler ve sepet dahil statik/tepkisiz davranışları bul, her bulguyu bu dosyaya ayrı satır ekleyerek düzelt.
- [ ] Madde 6: Ana sayfa kategori ve ürün vitrininde spacing, tipografi hiyerarşisi ve yoğunluğu daha sakin/premium hale getir; WCAG kontrast sözleşmesini koru.
- [ ] Madde 7: Admin dışındaki müşteri ekranlarında teknik/geliştirici dilini kaldır; veritabanı, backend, API, query/kayıt, sistem hatası gibi kullanıcıya faydasız teknik ifadeleri insan diline çevir.

## Kapsam dışı, bilinçli durum

Ürün fotoğrafları ve logo görünümü bilinçli olarak placeholder/eksik bırakılmıştır. Bu çalışma bunları sorun olarak raporlamaz, düzeltmez ve bunlara yönelik audit/uyarı eklemez.

## Doğrulama standardı

Her madde tamamlandığında ve finalde tekrar: `npx tsc --noEmit`, `npm run build`, `npm run audit:all`. Tamamlanan her madde bu dosyada işaretlenir ve madde numarasını belirten commit ile kaydedilir.
