# Store Görsel Varlık Kontrol Listesi

## Google Play

- [ ] High-res store icon: 512 x 512 PNG, Play Console'a ayrıca yüklenir.
- [ ] Feature graphic: tam 1024 x 500, JPEG veya 24-bit PNG, alpha olmadan.
- [ ] Telefon ekran görüntüsü: en az 2 adet. Play'in kabul ettiği görüntüler 320-3840 px aralığında olmalıdır; yüksek kaliteli mağaza görünümü için en az 4 gerçek telefon görüntüsü önerilir.
- [ ] Tablet/Chromebook gibi ayrıca hedeflenen cihaz türleri varsa ilgili gerçek screenshot setleri hazırlanır.

Android native uygulama tarafında adaptive launcher icon kaynağı ve density launcher ikonları bulunuyor. Store listing için gereken 512 x 512 Play icon ayrı bir Play Console varlığıdır.

## Apple App Store

- [ ] App Store Connect'te her desteklenen cihaz ailesi için gerçek uygulama screenshots.
- [ ] Bir screenshot setinde 1-10 görüntü.
- [ ] iPhone 6.9 inç kabul edilen portre boyutlarından biri kullanılabilir: 1260 x 2736, 1290 x 2796 veya 1320 x 2868.
- [ ] Uygulama iPad'i desteklediği için App Store Connect'in istediği iPad screenshot seti de hazırlanır.
- [ ] Screenshot'larda gerçek uygulama UI'si ve gerçek/uygun test verisi kullanılır; sahte mağaza ekranı oluşturulmaz.

İOS native asset catalog içinde 1024 x 1024 universal AppIcon kaynağı tanımlıdır. Xcode asset catalog farklı cihaz boyutlarını derleme sırasında üretir/validasyonunu yapar.

## Bu görevde üretilmeyen görseller

Feature graphic ve store screenshot'ları gerçek tasarım ve gerçek uygulama görüntüsü gerektirir. Bunlar yapay veya temsili ekranlarla doldurulmamalıdır. İshak, son TestFlight/Android release görünümünden gerçek cihaz veya simulator/emulator screenshot'larını çekmeli ve gerekiyorsa tasarım ekibi feature graphic'i marka varlıklarından hazırlamalıdır.

## Önerilen screenshot senaryoları

1. Ana sayfa ve doğrulanmış katalog.
2. Ürün detayı, üretici ve izlenebilirlik/güvenlik bilgileri.
3. Kategoriler ve arama.
4. Sepet/checkout önizlemesi, gerçek ödeme yapılmadan.
5. Hesabım/sipariş yönetimi.
6. Güvenlik ve İçerik Merkezi, raporlama/engelleme özellikleri.
