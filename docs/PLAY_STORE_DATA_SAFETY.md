# Google Play Data Safety ve İçerik Derecelendirme Beyanı

Güncelleme: 22 Ağustos 2026

Bu belge Play Console formu doldurulurken Golden Oremar'ın gerçek runtime ve Supabase şemasıyla eşleştirilmiş çalışma notudur. Play Console'daki nihai cevaplar, gönderim gününde etkin özellikler ve hizmet sağlayıcı sözleşmeleriyle son kez karşılaştırılmalıdır.

## Veri Güvenliği özeti

- Uygulama kişisel veri toplar: Evet.
- Veriler aktarım sırasında şifrelenir: Evet, HTTPS/TLS.
- Kullanıcı hesap ve ilişkili veri silme talebinde bulunabilir: Evet, uygulama hesap yönetimi/destek akışı üzerinden.
- Reklam amaçlı veri satışı: Hayır.
- Üçüncü taraf reklam ağı veya uygulamalar arası reklam takibi: Mevcut kodda yok.
- Tam kart numarası/CVV Golden Oremar veritabanında tutulur: Hayır. Ödeme sağlayıcı token referansı ve maskeli kart metadatası tutulabilir.

## Toplanan veri kategorileri

| Play kategorisi | Örnek Golden Oremar verisi | Amaç | Gerekli/opsiyonel |
| --- | --- | --- | --- |
| Kişisel bilgiler | ad/görünen ad, e-posta, telefon | hesap, destek, sipariş | özelliğe göre |
| Adres | teslimat/fatura adresi, posta kodu | fiziksel ürün teslimatı | sipariş için gerekli |
| Finansal bilgiler | iyzico işlem/token referansı, kart markası, son 4 hane, son kullanma bilgisi | ödeme, iade, mutabakat | ödeme kullanılırsa |
| Satın alma geçmişi | siparişler, kalemler, iadeler, geri ödemeler | alışveriş ve destek | işlem yapılırsa |
| Kullanıcı içeriği | yorum, puan, yorum fotoğrafı, mesaj, mesaj eki, destek metni | pazaryeri iletişimi ve güven | kullanıcı seçimine bağlı |
| Fotoğraf/dosya | yorum görseli, mesaj görseli/PDF | UGC ve destek | opsiyonel |
| Uygulama etkinliği | favoriler, takipler, tercih ve etkileşim kayıtları | uygulama işlevleri | özelliğe göre |
| Uygulama bilgisi ve performansı | hata/diagnostic kayıtları | güvenilirlik ve hata giderme | otomatik olabilir |
| Cihaz/diğer kimlikler | kullanıcı UUID, push token/hash, güvenlik cihaz kimliği | oturum, push, güvenlik | özelliğe göre |
| Konum | üreticinin elle girdiği üretim koordinatları/ili | üretici ve menşe doğrulaması | satıcı özelliğinde |
| Hassas üretici/KYC | vergi/ticari doğrulama, şifreli kimlik/IBAN ve belgeler | satıcı doğrulama, finans/yasal uyum | satıcı başvurusunda |

Müşteri cihazının GPS konumunu arka planda izleyen bir runtime özelliği yoktur. Üretim konumu, satıcı tarafından iş akışı içinde girilen işletme/üretim konumudur.

## Hizmet sağlayıcılar ve paylaşım değerlendirmesi

- Supabase: Auth, Postgres, Storage ve Edge Functions için altyapı sağlayıcısı.
- iyzico: fiziksel ürün/etkinlik ödeme sağlayıcısı, tokenizasyon, ödeme, iade ve mutabakat.
- Resend: işlem e-postalarının gönderimi.
- APNs / Android push altyapısı: izin verilen push bildirimlerinin teslimi.
- Satıcı/üretici ve lojistik sağlayıcı: siparişin hazırlanması ve teslimi için gerekli bilgiler.

Google Play'in Data Safety formundaki “shared/paylaşılan” tanımı, hizmet sağlayıcı istisnası ve kullanıcı tarafından başlatılan aktarım istisnaları dikkate alınarak gönderim tarihinde tekrar kontrol edilmelidir. Bir sağlayıcı yalnız veri işleyen/service provider rolündeyse bu durum Play formunda “shared” olarak sayılmayabilir; nihai işaretleme ilgili DPA/sözleşmeyle doğrulanmadan tahmin edilmemelidir.

## Veri kullanım amaçları

- App functionality: hesap, sepet, sipariş, ödeme, mesaj, yorum, bildirim.
- Account management: kayıt, profil, adres, oturum, hesap kapatma.
- Fraud prevention, security and compliance: güvenlik olayları, cihaz/IP kontrolleri, kötüye kullanım ve UGC moderasyonu.
- Developer communications: sipariş/ödeme e-postaları, destek ve gerekli servis mesajları.
- Personalization: kullanıcının seçtiği tema, ses, favori/takip tercihleri.
- Advertising: Hayır.

## İçerik derecelendirmesi

Golden Oremar'ın editoryal/ürün kataloğunda mevcut taramada alkol, tütün, uyuşturucu, kumar, silah, cinsel içerik veya şiddet içeren ürün/özellik bulunmadı. Katalog fiziksel gıda, yöresel ürün ve el emeği ürünler üzerine kuruludur.

Ancak uygulamada UGC vardır ve bu mutlaka beyan edilmelidir:

- Doğrulanmış satın alma ürün yorumları: Evet.
- Yorum fotoğrafları: Evet.
- Üretici yanıtları: Evet.
- Müşteri-üretici/destek mesajlaşması: Evet.
- Mesaj görseli/PDF eki: Evet, Super Admin güvenlik politikasına bağlı.

UGC güvenlik önlemleri:

- UGC oluşturmadan önce Kullanım Şartları kabulü backend tarafından zorunlu tutulur.
- Yayınlanmış yorum uygulama içinden bildirilebilir.
- Konuşma uygulama içinden bildirilebilir.
- Uygun 1:1 konuşmalarda kullanıcı karşı tarafı engelleyebilir.
- Aktif engel varken yeni mesajlaşma backend'de reddedilir.
- Engellenen kişinin yayınlanmış yorumları engelleyen kullanıcı için filtrelenir.
- Yorum yayınlama zaten moderasyon statüsünden geçer; admin içerik rapor kuyruğunu inceleyebilir.

Play Console içerik derecelendirmesinde kullanıcı etkileşimi/UGC sorularına “var” yanıtı verilmelidir. Platformun kendi sağladığı şiddet/cinsellik/kumar/alkol içeriği bulunmadığı için bunlar gerçeğe uygun biçimde “yok” işaretlenebilir; kullanıcı içeriği olasılığı ayrı UGC sorularında açıklanmalıdır.
