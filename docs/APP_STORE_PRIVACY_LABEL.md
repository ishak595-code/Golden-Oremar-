# App Store Privacy Nutrition Label Çalışma Notu

Güncelleme: 22 Ağustos 2026

Bu belge App Store Connect App Privacy formunu gerçek Golden Oremar veri akışlarıyla eşlemek için hazırlanmıştır. Nihai gönderimde etkin özellikler ve üçüncü taraf hizmet sözleşmeleri yeniden doğrulanmalıdır.

## Genel beyan

- Kullanıcı veya cihazla bağlantılı veri toplanıyor: Evet.
- Uygulamalar/siteler arası reklam takibi: Hayır.
- Reklam ağı/advertising SDK: Mevcut kodda yok.
- ATT istemi: Mevcut davranış için gerekli değil. Uygulama başka şirketlerin uygulama ve web siteleri boyunca kullanıcı takibi yapmıyor. Bu nedenle sırf mağaza hazırlığı için NSUserTrackingUsageDescription veya ATT istemi eklenmemelidir.
- Kişisel veri satışı: Hayır.

## App Privacy kategorileri

| Apple kategorisi | Golden Oremar örnekleri | Kullanıcıyla bağlantılı | Ana amaç |
| --- | --- | --- | --- |
| Contact Info | ad, e-posta, telefon, teslimat/fatura adresi | Evet | App Functionality, Account Management, Developer Communications |
| Financial Info | iyzico sağlayıcı/token referansı, maskeli kart metadatası, satıcı IBAN/KYC alanları | Evet | App Functionality, Fraud Prevention, Legal/Compliance |
| Purchases | sipariş, iade, refund, ödeme geçmişi | Evet | App Functionality, Account Management |
| User Content | yorumlar, puanlar, yorum görselleri, mesajlar, ekler, destek metni | Evet | App Functionality, Safety/Moderation |
| Identifiers | Supabase kullanıcı UUID, push/device güvenlik kimlikleri | Evet | App Functionality, Fraud Prevention/Security |
| Usage Data | favori, takip, bildirim/tema tercihleri ve uygulama işlevi etkileşim kayıtları | Genellikle Evet | App Functionality, Personalization |
| Diagnostics | hata ve güvenlik telemetry kayıtları, user-agent/IP türevleri | Evet veya oturumla ilişkilendirilebilir | App Functionality, Fraud Prevention/Security |
| Location | satıcının elle girdiği üretim yeri/koordinatları | Satıcı hesabıyla bağlantılı | App Functionality, Seller Verification |

Müşteri cihazının hassas GPS konumunu arka planda takip eden bir iOS konum izni yoktur.

## Üçüncü taraf hizmet sağlayıcılar

App Privacy formunda Apple'ın “third-party partners” yaklaşımı gereği aşağıdaki veri akışları da uygulama beyanına dahil edilmelidir:

- Supabase: hesap/auth, veri tabanı, dosya depolama ve Edge Functions.
- iyzico: fiziksel mal/etkinlik ödeme işlemleri, tokenizasyon, iade ve ödeme mutabakatı.
- Resend: işlem e-postaları.
- APNs ve Android karşılığı push altyapısı: push tokenı ve bildirim teslimi.
- Siparişin satıcısı/üreticisi ve lojistik sağlayıcı: fiziksel siparişin ifası için gereken bilgiler.

## Ödeme verisi sınırı

Golden Oremar tam kart numarası veya CVV saklamak için tasarlanmamıştır. Sağlayıcı token referansı, kart markası, son dört hane ve son kullanma metadatası gibi maskeli/izinli kayıtlar bulunabilir.

## Tracking ve ATT kararı

Mevcut kod ve bağımlılık taramasında reklam/attribution amaçlı tracking SDK'sı bulunmadı. Kullanıcı verisi başka şirketlerin uygulama veya web siteleri arasında reklam hedefleme/ölçüm için birleştirilmiyor. Bu nedenle ATT promptu eklemek doğru değildir. Gelecekte reklam SDK'sı, cross-app attribution veya Apple'ın Tracking tanımına giren veri kullanımı eklenirse bu karar yeniden değerlendirilmelidir.

## App Store Connect için önerilen amaçlar

- App Functionality: Evet.
- Account Management: Evet.
- Developer Communications: işlem/destek mesajları için Evet.
- Fraud Prevention and Security: Evet.
- Personalization: kullanıcı tercihleri için Evet.
- Analytics: yalnız gerçekten analytics amaçlı kullanım eklenirse işaretlenmeli; mevcut uygulamada reklam/analytics SDK'sı varsayılmamalıdır.
- Third-Party Advertising: Hayır.
- Developer Advertising or Marketing: mevcut mağaza sürümünde pazarlama amacıyla izleme yapılmıyor.

## UGC ve gizlilik

Ürün yorumları ve 1:1 mesajlar kullanıcı içeriğidir. Uygulama içi bildirme, uygun konuşmalarda engelleme, backend Terms kabulü ve moderasyon kuyruğu vardır. Kullanıcı raporları güvenlik/moderasyon amacıyla işlenir.

## Gönderim öncesi insan kontrolü

App Store Connect'te form doldurulurken şu üç nokta son kez karşılaştırılmalıdır:

1. O tarihte etkin olan iyzico, e-posta ve push sağlayıcılarının sözleşme/DPA durumu.
2. TestFlight build'inde yeni bir analytics/ads SDK eklenip eklenmediği.
3. App Store Connect'in güncel veri kategorisi ve amaç seçeneklerinin bu belgeyle eşleşmesi.
