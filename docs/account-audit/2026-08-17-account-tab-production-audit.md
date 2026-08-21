# Golden Oremar Hesabım sekmesi üretim denetimi

Tarih: 2026-08-17
Dal: `agent/admin-supabase-retire-node`
PR: #47
Denetlenen alan: Android/iOS uygulamasındaki `Hesabım` merkezi ve buradan açılan müşteri/satıcı hesap yüzeyleri.

Bu dosya, Hesabım sekmesi için tek konsolide kontrol noktasıdır. Yeni çalışma başlamadan önce `PROJECT_STATE.json`, `TEST_REPORT.json`, `docs/manual-checkpoints/LATEST.md` ve bu dosya birlikte okunmalıdır. Aşağıdaki tamamlanmış bloklar sırf tekrar kontrol edilmiş olmak için yeniden yazılmamalıdır. Yalnız yeni ve somut bir regresyon bulunursa ilgili dosya tekrar değiştirilmelidir.

## Denetim yaklaşımı

Önce geçmiş commitler ve mevcut checkpoint kayıtları incelendi. Daha önce tamamlanmış hesap merkezi, ödeme sayfalama, bildirim sayfalama, mesajlaşma, favoriler, takip edilen üreticiler, hediyeler, adresler, profil, ayarlar, satıcı paneli ve erişilebilir dialog çalışmaları başlangıç noktası kabul edildi. Ardından branch üzerindeki güncel `src/features/account` dosyaları tek tek yeniden okundu. Eski bir checkpoint'te tamamlandı yazması, güncel dosyada regresyon varsa doğru kabul edilmedi.

Bu turda özellikle dört ilke uygulandı:

1. Eksik veya bozuk backend verisi hiçbir yerde gerçek `0`, `TRY`, geçerli tarih, geçerli puan, geçerli stok veya gerçek durum gibi gösterilmez.
2. Eksik kimlik, bozuk sayı, geçersiz dosya veya doğrulanmamış durum destructive/mutating bir işlemi açmaz.
3. Mobil ekran okuyucu, odak, Escape, live-region ve dialog davranışları gerçek uygulama akışına göre korunur.
4. Gerçek olmayan ödeme yöntemi, push sağlayıcısı, satıcı verisi, kargo/stok değeri veya kullanıcı bilgisi üretilmez.

## Bu denetimde yeni bulunan ve düzeltilen regresyonlar

### Hesap merkezi

`AccountCenter.tsx`

- Hesap özetinin ham RPC cevabı doğrudan render edilmeden önce artık yapı olarak doğrulanıyor.
- Profil ve özet nesnesi bozuksa ekran kontrollü hata veriyor, runtime çökmesine bırakılmıyor.
- Adresler yalnız gerçek dizi ise kullanılıyor; roller yalnız bilinen hesap rollerine indirgeniyor.
- Sessiz yenileme başarısız olursa açık panel ve daha önce doğrulanmış veri korunuyor.
- Alt panel açılışlarında odak ilgili panel başlığına taşınıyor.
- Genel `Mesajlarım` açılışı eski deep-link konuşma kimliğini taşımıyor.
- `Ödeme Yöntemlerim` gibi gerçekte saklanmayan kart varmış izlenimi veren ad kaldırıldı; bölüm `Ödeme Geçmişim` olarak adlandırıldı.

### Para ve ödeme doğruluğu

`ui.tsx`, `PaymentsPanel.tsx`

- Ortak `Money` bileşeni artık eksik para birimini otomatik `TRY` yapmıyor.
- Minor-unit tutar güvenli tam sayı değilse veya para birimi üç harfli geçerli kod değilse `Tutar doğrulanamadı` gösteriliyor.
- Ödeme geçmişindeki bozuk tutar artık `0` olarak görünmüyor.
- Eksik sipariş numarası, tarih veya ödeme kimliği gerçek değer gibi maskelenmiyor.
- Sayfalama toplamı doğrulanamıyorsa sahte toplam üretilmiyor.
- Golden Oremar'ın kart numarası veya CVV saklamadığı metinde açık tutuldu. Canlı provider bağlanmadan kayıtlı kart ekranı uydurulmuyor.

### Favoriler

`FavoritesPanel.tsx`

- Bozuk veya eksik fiyat artık `0` fiyatına dönüşmüyor.
- Para birimi doğrulanmadan fiyat gösterilmiyor.
- Compare-at fiyat yalnız doğrulanmış ve gerçek satış fiyatından büyükse gösteriliyor.
- Eksik ürün referansı favori kaldırma mutasyonunu devre dışı bırakıyor.
- Eksik üretici, menşe ve görsel bilgileri gerçekte varmış gibi doldurulmuyor.

### Takip edilen üreticiler

`FollowedProducersPanel.tsx`

- Bozuk ürün sayısı, puan ve değerlendirme sayısı artık sıfırmış gibi gösterilmiyor.
- Yalnız doğrulanmış gerçek sıfır değer `henüz değerlendirme yok` anlamına geliyor.
- Eksik konum otomatik `Türkiye` yapılmıyor.
- Eksik üretici kimliği takip bırakma mutasyonunu kapatıyor.

### Hediye geçmişi

`GiftsPanel.tsx`

- Hediye listesi ve ürün satırları dizi olarak doğrulanıyor.
- Eksik sipariş/alıcı kimliği açıkça doğrulanamadı olarak gösteriliyor.
- Ürün adedi yalnız pozitif güvenli tam sayıysa gerçek adet kabul ediliyor.
- Hediye toplamı ortak doğrulanmış para bileşenini kullanıyor.

### Siparişler

`OrdersPanel.tsx`

- Sipariş toplamı ve ürün adedi bozuksa sahte sıfır gösterilmiyor.
- Eksik sipariş kimliği olan satır açılmıyor veya iptal işlemine girmiyor.
- İndirim hesabı bozuk veriyi `-0` gibi gerçek değer haline getirmiyor.
- Kargo takip bağlantısı yalnız güvenli HTTPS URL ise açılıyor.
- Geçersiz tarihler açıkça `Tarih doğrulanamadı` olarak gösteriliyor.
- Sipariş iptali accessible `alertdialog` ile onaylanıyor.
- İade ve geri ödeme kayıtları doğrulanmış kimlik, tutar ve durumlarla gösteriliyor.

### İade talebi ve iade detayı

`ReturnRequestDialog.tsx`, `ReturnDetailDialog.tsx`, `returnsApi.ts`

- `canRequest`, uygunluk ve açık iade bayrakları yalnız gerçek boolean `true` ise işlem açıyor.
- Sipariş, iade ve sipariş-ürün kimlikleri API sınırında doğrulanıyor.
- İade adedi güvenli pozitif tam sayı olmak zorunda.
- Bilinmeyen iade nedeni veya bozuk ürün adedi gönderilemiyor.
- Bir ürün için en fazla 5, toplamda en fazla 15 kanıt dosyası sınırı hem UI hem API sınırında var.
- Kanıt dosyası MIME, boyut, storage path ve signed URL TTL sınırları sertleştirildi.
- Path traversal, kontrol karakterleri ve bozuk storage yolları reddediliyor.
- Önemli lifecycle düzeltmesi: backend iade talebini başarıyla oluşturduktan sonra yalnız ekran güncellemesi hata verirse yeni iade kaydına bağlı kanıt dosyaları yanlışlıkla silinmiyor.
- İade detayındaki eksik para birimi artık otomatik `TRY` yapılmıyor.
- Bozuk durum, neden, refund durumu, tarih veya adet açıkça doğrulanamadı olarak gösteriliyor.

### Bildirimler ve kırmızı gerçek sayaç

`NotificationsPanel.tsx`, `useUnreadNotificationCount.ts`

Bu alan uygulama için değişmez bir üretim kuralıdır:

- Bildirim zili yalnız gerçek Supabase okunmamış sayısını kullanır.
- Okunmamış bildirim varsa kırmızı, yüksek kontrastlı rozet ve gerçek sayı gösterilir.
- Bozuk, negatif veya tam sayı olmayan unread payload artık otomatik `0` yapılmaz.
- Bozuk yeni payload daha önce doğrulanmış kırmızı rozeti silemez.
- Bozuk payload cihazdaki teslim edilmiş native bildirimleri `okunmamış yok` sanarak temizleyemez.
- Yalnız doğrulanmış gerçek `0`, stale native bildirimleri temizleyebilir.
- Tek bildirim okuma ve tümünü okundu yapma sonrasında server-authoritative sayı yeniden kontrol edilir.
- Eksik bildirim kimliği mutasyona sokulmaz.
- Tarih, başlık, mesaj ve action hedefleri doğrulanamadığında bu durum kullanıcıya dürüstçe gösterilir.

### Mesajlar

`MessagesPanel.tsx`, `messagesApi.ts`

- Konuşma ve mesaj listeleri dizi olarak doğrulanıyor.
- Bozuk unread mesaj sayısı sıfırmış gibi gösterilmiyor.
- Konuşma durumu yalnız `open` veya `closed` ise işlem yapılabiliyor; bilinmeyen durum mesaj gönderme ve durum değiştirmeyi kapatıyor.
- Polling artık tüm mesaj geçmişini `aria-live` yapıp ekran okuyucuya tekrar tekrar okutmaz. Ayrı ve küçük live-status alanı kullanılır.
- Mesaj ve konuşma için fallback anahtarlar kullanılıyor; eksik ID'ler mutasyona girmiyor.
- Ek dosyalar UI ve API katmanında MIME, boyut, adet ve storage path açısından doğrulanıyor.
- Storage path traversal ve kontrol karakterleri reddediliyor.
- Signed URL süresi sınırlandırılıyor.
- Eski mesaj sayfalama tarihi geçersizse RPC çağrısı yapılmıyor.

### Profil

`ProfilePanel.tsx`

- Telefon yalnız görünürde 5 karakter olmasıyla geçerli sayılmıyor; gerçek rakam sayısı 5 ile 20 arasında olmalı.
- Backend'den gelen bilinmeyen locale artık sessizce Türkçe'ye çevrilmiyor.
- Locale bozuksa kullanıcıdan desteklenen gerçek bir dil seçmesi isteniyor.
- Ad, telefon ve avatar MIME/boyut sınırları korunuyor.
- Profil fotoğrafı kaldırma accessible confirmation dialog ile yapılıyor.

### Adresler

`AddressesPanel.tsx`

- Yeni adres artık otomatik `TR` ile başlamıyor. Golden Oremar dünya çapında kullanılabileceği için ülke kullanıcı tarafından açıkça seçiliyor/yazılıyor.
- Ülke kodu iki harfli ISO biçiminde doğrulanıyor.
- Telefon gerçek rakam sayısı 7 ile 20 arasında olmalı.
- Alıcı, il/bölge, ilçe/şehir, köy/mahalle, posta kodu, açık adres ve teslimat notu sınırları uygulandı.
- Eksik adres kimliği silme işlemini kapatıyor.
- Ekleme/düzenleme ve silme dialogları ekran okuyucu odak yönetimini koruyor.

### Ayarlar, güvenlik ve e-bülten

`SettingsPanel.tsx`

- E-bülten sorgusu başarısız olduğunda eski davranıştaki gibi sahte `Abone değil` durumu oluşturulmuyor.
- Bilinmeyen newsletter durumu kullanıcıya `Durum doğrulanamadı` olarak gösteriliyor ve yeniden kontrol isteniyor.
- Abonelik veya abonelikten çıkma başarılı olup yalnız sonraki refresh başarısızsa mutasyon başarısızmış gibi yanlış mesaj verilmiyor.
- Bildirim preference payload'ı gerçek boolean değerlerle doğrulanıyor; örneğin string `false` yanlışlıkla açık tercih sayılmıyor.
- Native push izni teknik ham değer yerine anlaşılır durum etiketiyle gösteriliyor.
- Şifre uzunluğu, eşleşme ve mevcut-yeni şifre farkı sınırları korunuyor.
- Diğer cihazlar ve tüm cihazlar oturum kapatma accessible confirmation dialog kullanıyor.
- Hesap kapatma nedeni işlem anında da 10 ile 1000 karakter arasında yeniden doğrulanıyor.
- Bilinmeyen hesap kapatma durumu gerçek bir iş durumu gibi gösterilmiyor.

### Yorumlar

`ReviewsPanel.tsx`

- Güncel branch'te destructive yorum geri çekme işleminin yeniden `window.confirm` kullanımına döndüğü bulundu. Bu regresyon kaldırıldı.
- Yorum geri çekme shared accessible alertdialog sistemine geri taşındı.
- Puan yalnız güvenli 1-5 tam sayıysa yıldız olarak gösteriliyor.
- Bozuk rating sahte yıldız veya `NaN` üretmiyor.
- Yorum ve sipariş-ürün kimliği eksikse mutation kapalı.
- Medya MIME, boyut ve toplam görsel sayısı seçim anında ve upload sınırında doğrulanıyor.

### Satıcı paneli

`SellerPanel.tsx`

Bu denetimde bulunan en kritik stok regresyonlarından biri düzeltildi:

- Eski kod bozuk `availableQuantity` veya `reorderLevel` değerini `0` ile başlatabiliyordu. Satıcı formu kaydederse gerçek stok yanlışlıkla sıfıra yazılabilirdi.
- Artık bozuk kaynak stok değeri formda boş ve disabled kalıyor. Doğrulanmış veri gelmeden stok yazılamıyor.
- Satıcı panelindeki ürün, lot, düşük stok ve değişiklik sayaçları bozuksa artık sahte sıfır gösterilmiyor.
- Inventory, change request ve finance dizileri bozuksa `boş liste` gibi davranılmıyor; ayrı doğrulama hatası gösteriliyor.
- Varyant kimliği ve inventory version doğrulanmadan stok mutation yapılmıyor.
- Bekleyen ürün değişikliği geri çekme işlemi accessible confirmation dialog kullanıyor.

### Üretici mağaza profili

`ProducerProfilePanel.tsx`

- Eksik üretim ülkesi artık otomatik `TR` yapılmıyor.
- Üretici profil RPC cevabı object olarak doğrulanıyor.
- Üretici kimliği media storage yolu için doğrulanıyor.
- Mağaza adı, açıklama ve hikâye uzunlukları sınırlandırıldı.
- Ülke, il/bölge, ilçe/şehir, köy/mezra ve konum değişiklik nedeni doğrulanıyor.
- Sadece `pending` değil `under_review` konum talebi de ikinci paralel talebi kapatıyor.
- Yeni logo/kapak upload edilip form kaydedilmeden ekran terk edilirse orphan geçici dosyalar temizleniyor.
- Aynı oturumda yeni bir görsel tekrar seçildiğinde kullanılmayan önceki geçici upload temizleniyor.
- Profil DB güncellemesi başarıyla tamamlandıktan sonra eski, bu üreticiye ait profile görseli güvenli biçimde temizleniyor.

## İncelenen ve bu turda değiştirilmesi gerekmeyen hesap dosyaları

- `PremiumPreferencesPanel.tsx`: tema ve bildirim sesi tercihleri cihaz-yerel tercihlerdir; backend ürünü veya ödeme verisi uydurmuyor. `App.tsx` içinde gerçek `onThemeChange={setAppearanceTheme}` bağlantısı doğrulandı.
- `SupportPanel.tsx`: canlı help content kullanıyor; sessiz reconnect sırasında yüklenmiş içerik korunuyor; eksik hukuki metni uydurmuyor.
- `FaqPanel.tsx`: canlı FAQ verisi ve reconnect davranışı mevcut; filtre yalnız yerel UI aramasıdır.
- `faqApi.ts`: locale, öğe sayısı, soru/cevap, kategori, etiket ve sayısal alan sınırları zaten uygulanmış.
- `presentation.ts`: hesap tarih/durum etiketlerini merkezi ve savunmalı biçimde sunuyor.
- `types.ts`: yalnız tip sözleşmeleri içeriyor.
- `useDialogA11y.ts`: uygulamanın stacked `useAccessibleDialog` altyapısına bağlanan ince wrapper olarak doğru kalıyor.

## Uygulama kabuğuyla doğrulanan Hesabım bağlantıları

`App.tsx` incelendi:

- `AccountCenter` gerçek `appearanceTheme` ve `setAppearanceTheme` alıyor.
- Ürün ve üretici açma callback'leri gerçek public route sistemine bağlı.
- Satıcı başvurusu mevcut account route state'ine bağlı.
- Bildirim unread değişikliği doğrudan uygulama seviyesindeki `setUnreadCount` bağlantısına gidiyor.
- Bildirim action URL/metadata sipariş, mesaj ve satıcı ekranlarına uygulama içi route ile taşınıyor.

## Sepet sayacı hakkında hesap denetimi dışı ama korunacak invariant

Hesabım çalışması sepet mimarisini değiştirmedi. Uygulama kabuğundaki sepet rozeti gerçek server cart snapshot içindeki toplam ürün adedini kullanmaya devam etmelidir. Ayrı ürün satırı sayısı rozet sayısı değildir. Checkout mutasyonları app-shell sayaç snapshot'ını güncel tutmalıdır.

## Bilerek yapılmayanlar

- Sahte kart veya ödeme sağlayıcısı eklenmedi.
- Sahte push/FCM/APNs bilgisi eklenmedi.
- Sahte Google/Facebook OAuth bilgisi eklenmedi.
- Sahte mağaza, satıcı, puan, takip, stok, fiyat, sipariş, kargo, iade veya kullanıcı sayısı eklenmedi.
- Eksik kargo ağırlıkları doldurulmadı.
- GitHub Actions billing/minute engeli devam ederken yeni manuel workflow tetiklenmedi.
- PR #47 merge edilmedi.

## Doğrulama durumu

Bu Hesabım denetiminin son fonksiyonel kod commit'i dokümantasyon başlamadan önce:

`6c6a4ed507dae643aacda0aacf86f19ca1e02df0`

Bu SHA ve bundan önceki hesap düzeltmeleri GitHub'a işlendi ancak mevcut GitHub Actions billing/spending-limit engeli nedeniyle en yeni account kodu üzerinde Android/iOS quality gate çalıştırılmış değildir. Bu nedenle bu kod `CI-green` olarak tanımlanamaz.

Runner tahsisi geri geldiğinde tek anlamlı son kalite çalışması yapılmalıdır: release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle ve iOS simulator compile. Bu gerçek koşum yeşil olmadan ve kullanıcı açıkça onay vermeden PR merge edilmemelidir.

## Hesabım için sonraki çalışma kuralı

Bu dosyada listelenen modülleri tekrar sıfırdan ele alma. Yeni bir hesap hatası, kullanıcı geri bildirimi, yeni backend sözleşmesi veya gerçek test regresyonu görülürse yalnız etkilenen noktayı düzelt. Hesabım sekmesi için bu denetim artık ana referanstır.
