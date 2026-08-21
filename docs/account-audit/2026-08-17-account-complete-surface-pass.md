# Golden Oremar Hesabım tüm yüzeyler final denetimi

Tarih: 2026-08-17
Dal: `agent/admin-supabase-retire-node`
PR: #47
Son fonksiyonel kod head'i: `3a43d2cf63fedaaf9ca8f06e26ce32ca6e865819`

Bu tur kullanıcı isteği üzerine Hesabım yalnız `src/features/account` klasörü olarak değil, Hesabım ana merkezinden açılan bütün uygulama yüzeyleriyle birlikte yeniden değerlendirildi. Önceki ayrıntılı hesap audit'i ve cart final checkpoint'i geçerlidir; bu belge onların üzerine eklenen tam yüzey envanteri ve zenginleştirme turudur.

## Hesabım ekranında bulunan bütün ana girişler

Hesabım ana ekranı artık aşağıdaki gerçek ve işlevsel bölümleri gösterir:

### Üst hesap merkezi

- kullanıcı adı/e-posta
- toplam sipariş bilgisi
- tıklanabilir aktif sipariş sayacı
- tıklanabilir favori sayacı
- tıklanabilir adres sayacı
- tıklanabilir okunmamış bildirim sayacı
- okunmamış bildirim sayısı sıfırdan büyükse kırmızı dikkat göstergesi
- varsa son sipariş kartı
- son siparişten doğrudan sipariş detayına geçiş

Sayaçlar bozuk payload'ı `0` gibi göstermez. Kaynağı doğrulanamayan değer `?` veya doğrulanamadı durumunda kalır.

### Keşfet & Katıl

- Sağlık & Tarifler
- Etkinlikler & Kayıtlarım

### Üretici & Yönetim

- üretici hesabı doğrulama özeti, yalnız üretici kaydı varsa
- Mağaza Profilini Düzenle, yalnız üretici kaydı varsa
- Satıcı Ol veya mevcut üretici için Satıcı Paneli
- doğrulanmış admin/super_admin rolü varsa Yönetim Paneli

### Alışveriş & Hesap

- Profilimi Düzenle
- Siparişlerim
- Yorumlarım
- Favorilerim
- Takip Ettiğim Satıcılar
- Hediye Ettiklerim
- Adreslerim
- Ödeme Geçmişim

### Mesajlar & Destek

- Mesajlarım
- Bildirimler
- İletişim
- Yardım & Destek

Yardım & Destek içinde ayrıca:

- destek konuşmaları
- iletişim formu
- Sık Sorulan Sorular
- Hakkımızda
- İade ve İptal
- Gizlilik ve Veri İşleme
- Kullanım Koşulları slotu

Kullanım Koşulları için live doğrulanmış yayın kaydı yoksa metin uydurulmaz. Mevcut gizlilik metni canlı satış öncesi taslak olduğunu söylüyorsa final hukuk metni gibi sunulmaz.

### Tercihler & Güvenlik

Ayarlar içinde:

- premium görünüm/tema
- uygulama içi premium bildirim sesi
- e-bülten
- push bildirim ana tercihi
- sipariş bildirimleri
- ödeme bildirimleri
- kargo/teslimat bildirimleri
- iade/geri ödeme bildirimleri
- mesaj bildirimleri
- yorum bildirimleri
- satıcı/üretici bildirimleri
- sistem/güvenlik bildirimleri
- kampanya bildirimleri
- şifre değişikliği
- bu cihazdaki oturumu kapatma
- diğer cihazlardaki oturumları kapatma
- tüm cihazlardan çıkış
- hesap kapatma talebi ve uygun durumda iptali

### En alt güvenli çıkış

Hesabım ana ekranının en altında ayrıca `Çıkış Yap` vardır. Bu işlem yalnız mevcut cihazdaki local oturumu kapatır. Diğer cihazları kapatma işlemleri Ayarlar bölümünde ayrı tutulur.

## Etkinlikler & Kayıtlarım yeniden tasarlandı

`src/features/engagement/api.ts` ve `PublicEventsScreen.tsx` yeniden değerlendirildi.

Canlı Supabase kontrolünde:

- `public.events` gerçek event tablosudur.
- `public.event_reservations` gerçek event kayıt tablosudur.
- RLS kendi kullanıcısına ait event reservation satırlarını okumaya izin verir.
- `private.submit_event_reservation` aktif oturum varsa reservation'ı `auth.uid()` ile kullanıcıya bağlar.
- desteklenen kayıt durumları: pending, confirmed, waitlisted, cancelled, attended, no_show.

Kullanıcı artık Etkinlikler ekranında kendi kayıtlarını görebilir:

- kayıt kodu
- event başlığı
- tarih
- konum
- kişi sayısı
- pending/confirmed/waitlisted/cancelled/attended/no_show durumu

Event kartında aynı event için aktif kullanıcı kaydı varsa tekrar `Kayıt Ol` butonu gösterilmez; mevcut kayıt durumu gösterilir.

Canlı event verisi ayrıca kontrol edildi. Şu anda:

- yaklaşan yayınlanmış event: 0
- arşiv/completed event: 5
- mevcut event kayıtları 2024 tarihli tamamlanmış kayıtlardır

Gelecekte event varmış gibi sahte yeni etkinlik eklenmedi. UI `Şu anda yayınlanmış yaklaşan etkinlik bulunmuyor` durumunu dürüstçe gösterir.

Event API sınırında ID, slug, başlık, açıklama, tarih sırası, capacity, remaining capacity, status, reservable ve waitlist değerleri doğrulanır. Reservation submit öncesinde ad, e-posta, telefon, kişi sayısı ve not sınırları istemcide de doğrulanır.

## Hesabım etkinlik özeti

Hesabım ana kartındaki `Etkinlikler & Kayıtlarım` artık statik açıklama değildir. Live event ve kullanıcının live event reservation verisini sessizce alarak:

- yaklaşan event sayısını
- aktif kişisel reservation sayısını

gösterir. Veri doğrulanamazsa sahte 0 yerine `Etkinlik özeti şu anda doğrulanamadı` durumu gösterilir.

## Sağlık & Tarifler yeniden değerlendirildi

`PublicHealthScreen.tsx` zenginleştirildi:

- Rehberler
- Ürün Bilgileri
- Tarifler

sekme sistemi gerçek erişilebilir tab davranışına taşındı.

Klavye ve ekran okuyucu için:

- Arrow Left/Right
- Arrow Up/Down
- Home
- End
- aria-selected
- aria-controls
- tabpanel ilişkisi

uygulanır.

Arama:

- 120 karakterle sınırlıdır
- uygulama locale değerine göre normalize edilir
- ayrı temizleme butonu vardır
- sonuç sayısı kullanıcıya bildirilir
- boş arama sonucunda filtreyi temizleme işlemi sunulur

İçerik/favori/detail mutation referansları doğrulanmadan işlem yapılmaz. Gerçek olmayan içerik sayısı üretilmez.

## İletişim ekranındaki önemli doğruluk düzeltmesi

Canlı `get_public_contact_config_v1()` çıktısı yeniden kontrol edildi. Mevcut live durumda:

- email: null
- phone: null
- address: `Hakkari, Türkiye`
- supportChannelsReady: false

Eski UI `supportChannelsReady=false` iken bile address alanını resmî destek adresi gibi gösterebiliyordu. Bu düzeltildi.

Yeni kural:

- telefon, e-posta ve resmî destek adresi yalnız `supportChannelsReady === true` ise gösterilir.
- mevcut `Hakkari, Türkiye` taslak/bölgesel değer, destek kimliği hazır olmadığı için resmî destek adresi gibi gösterilmez.
- güvenli uygulama iletişim formu kullanılabilir durumda kalır.

Form ayrıca name/email/optional phone/subject/message sınırlarını mutation öncesinde doğrular. Telefon yazılırsa 7-20 gerçek rakam içermelidir.

## Daha önce tamamlanan ve bu turda korunan yüzeyler

Önceki account audit'te zaten somut olarak sertleştirilen şu yüzeyler yeniden gereksiz biçimde yazılmadı:

- ProfilePanel
- AddressesPanel
- OrdersPanel
- ReturnRequestDialog
- ReturnDetailDialog
- FavoritesPanel
- FollowedProducersPanel
- GiftsPanel
- PaymentsPanel
- NotificationsPanel
- MessagesPanel ve messagesApi
- ReviewsPanel
- SellerPanel
- ProducerProfilePanel
- SettingsPanel

Bu ekranlar yeni ana Hesabım navigasyonundan erişilmeye devam eder. Önceki doğruluk, mutation guard ve erişilebilir dialog değişmezleri korunur.

## PR ve release doğruluğu

Bu audit sırasında GitHub Actions tetiklenmedi. Runner/billing engeli devam ederken son fonksiyonel head CI-green olarak adlandırılmaz.

PR #47 merge edilmemiştir ve erişilebilir son release gate gerçek runner üzerinde yeşil olmadan, ayrıca kullanıcı açıkça merge onayı vermeden merge edilmemelidir.
