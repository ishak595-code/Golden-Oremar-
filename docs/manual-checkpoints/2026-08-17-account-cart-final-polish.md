# Golden Oremar Hesabım + Sepet final üretim checkpointi

Tarih: 2026-08-17
Dal: `agent/admin-supabase-retire-node`
PR: #47
Son fonksiyonel kod head'i: `d96e716d2d80ee34bf9d914b752382ec75d57c59`

Bu checkpoint, Android/iOS Golden Oremar uygulamasındaki Hesabım merkezi ve Sepet/Checkout akışının genişletilmiş final manuel denetimini kaydeder. Önceki `docs/account-audit/2026-08-17-account-tab-production-audit.md` geçerliliğini korur. Bu dosya onun üzerine yapılan destek, yasal içerik, doğrudan çıkış ve sepet sertleştirmelerini toplar.

## Hesabım merkezi

Hesabım artık düz ve uzun bir kart listesi yerine mobil uygulamaya uygun anlamlı bölümler halinde sunulur:

- Keşfet & Katıl
- Üretici & Yönetim
- Alışveriş & Hesap
- Mesajlar & Destek
- Tercihler & Güvenlik
- Bu cihazdaki oturum

Mevcut gerçek özellikler korunmuştur: profil, siparişler, yorumlar, favoriler, takip edilen satıcılar, hediyeler, adresler, ödeme geçmişi, mesajlar, bildirimler, iletişim, yardım, ayarlar, satıcı paneli, mağaza profili ve yetkili kullanıcılar için yönetim paneli.

Sipariş, favori, takip, hediye ve okunmamış bildirim sayaçları yalnız doğrulanmış hesap özetinden gösterilir. Bildirim sayacı kırmızı rozet kullanır. Bozuk sayı sahte sıfıra dönüştürülmez.

Hesabım ekranının en altında açık `Çıkış Yap` işlemi vardır. Bu yalnız mevcut cihazdaki oturumu kapatır. Diğer cihazlar ve tüm oturumlar Ayarlar > Oturum ve Güvenlik içinde ayrı işlemler olarak kalır.

## Yardım, destek, SSS ve yasal içerik

`SupportPanel.tsx` tam destek merkezine dönüştürüldü:

- güvenli destek konuşmaları
- uygulama içi iletişim formu
- Sık Sorulan Sorular
- Hakkımızda
- İade ve İptal
- Gizlilik ve Veri İşleme
- Kullanım Koşulları

Canlı Supabase `private.get_account_help_content_v1('tr')` çıktısı ayrıca kontrol edildi. Mevcut canlı gerçek:

- Hakkımızda yayınlanmış
- İade ve İptal yayınlanmış
- Gizlilik ve Veri İşleme yayınlanmış fakat metin kendisini canlı satış öncesi taslak olarak açıkça tanımlıyor
- Kullanım Koşulları için doğrulanmış yayın kaydı yok

Eksik Kullanım Koşulları uydurulmadı. Arayüz yayınlanmamış belgeyi açıkça `doğrulanmış yayın kaydı henüz yok` olarak gösterir.

Canlı help kayıtlarında `markdown` alanının HTML benzeri markup taşıdığı, `sanitizedHtml` alanının ise boş olduğu tespit edildi. Eski akış bu markup'ı kullanıcıya ham metin olarak gösterebiliyordu. Yeni yardım renderer'ı DOMParser ile yalnız güvenli semantik elemanları React düğümlerine dönüştürür. Arbitrary class, script, event attribute veya güvensiz link şemaları render edilmez. `dangerouslySetInnerHTML` bu yardım/yasal içerik akışında kullanılmaz.

`FaqPanel.tsx` ayrıca mobil kullanım için güçlendirildi:

- 120 karakterle sınırlı arama
- içeriğin gerçek locale değerine göre arama normalizasyonu
- aramayı temizleme
- tüm filtreleri temizleme
- daha güçlü focus-visible davranışı
- fallback dilinin açıkça belirtilmesi

## Ayarlar ve güvenlik

`SettingsPanel.tsx` tekrar incelendi. Önceki sertleştirmeler korunuyor ve yeni bir regresyon bulunmadığı için gereksiz yeniden yazım yapılmadı:

- tema ve uygulama içi bildirim sesi
- çift onaylı e-bülten durumu
- gerçek boolean push tercihleri
- native push izin durumu
- parola değişikliği
- mevcut cihaz, diğer cihazlar ve tüm cihazlar için oturum yönetimi
- erişilebilir onay diyalogları
- hesap kapatma talebi ve iptali

`PremiumPreferencesPanel.tsx` native uygulama diline hizalandı. Tarayıcı merkezli ses önizleme ifadesi kaldırıldı; sistem/cihaz ses politikası doğru şekilde belirtiliyor. Tema seçiminin fiyat, stok veya güven durumunu değiştirmediği açıkça ifade ediliyor.

## Para sunumu

Ortak `Money` bileşeninde kritik tip doğruluğu güçlendirildi. `Number(minor)` coercion kaldırıldı. Artık yalnız gerçek `number` türünde güvenli tam sayı ve gerçek üç harfli para birimi kodu para olarak gösterilir. `null`, boş string veya bozuk payload sahte `0` tutara dönüşmez.

## Sepet toplam ürün adedi doğrulaması

Canlı Supabase fonksiyonu `private.get_customer_cart_snapshot_v1` doğrudan incelendi. Sunucu `itemCount` alanını `sum(quantity)` ile hesaplar. Bu nedenle uygulama kabuğundaki sepet rozeti ayrı satır sayısını değil gerçek toplam ürün adedini ifade eder.

Checkout preview fonksiyonu `private.preview_my_checkout_v1` de `item_count` değerini `sum(ci.quantity)` ile hesaplar. Bu invariant korunmalıdır.

## Sepet API sınırı

`src/features/cart/api.ts` artık RPC cevaplarını doğrudan güvenilir kabul etmez.

Cart snapshot için doğrulanan alanlar:

- sepet ve ürün kimlikleri
- gerçek 1-99 adet
- ürün ve varyant adları
- producer nesnesi
- selectedOptions nesnesi
- satış durumu boolean
- fiyat ve satır toplamı güvenli integer
- currency
- sellable quantity
- expiresAt
- subtotal ile satır toplamlarının eşleşmesi

İstemci `itemCount` değerini doğrulanmış satır quantity toplamından yeniden üretir. Bu live backend sözleşmesiyle aynıdır ve bozuk ayrı sayaç payload'ının app badge'ini bozmasını engeller.

Checkout preview ayrıca canCheckout, ülke, currency, item count, para alanları, shipping/promotion nesneleri ve toplam matematiğini doğrular.

Canlı `preview_my_checkout_v1` fonksiyonunun boş sepet için erken dönüşte `previewOnly` alanını koymadığı tespit edildi. İstemci yalnız doğrulanmış `canCheckout=false + blockingReason=cart_empty + itemCount=0` durumunda bu eski/erken dönüş sözleşmesini kabul eder. Diğer durumlarda `previewOnly=true` zorunluluğu devam eder.

## Sepet ve checkout mobil UX

`CartCheckoutFlow.tsx` final turunda güçlendirildi:

- premium mobil Sepet > Teslimat > Doğrulama görsel akışı
- güçlü kart hiyerarşisi ve mobil dokunma hedefleri
- satır bazlı async busy durumları
- erişilebilir sepet temizleme alertdialog'u
- gerçek server cart snapshot ile app-shell badge senkronizasyonu
- ürün görselleri ve missing-image erişilebilirliği
- stok doğrulanmadan adet artırmayı engelleme
- sahte ülke varsayımı kaldırıldı
- manuel yeni adreste otomatik TR yok
- gerçek iki harfli ülke kodu olmadan kargo/checkout preview yapılmıyor
- telefon 7-20 gerçek rakamla doğrulanıyor
- adres alanları bounded
- kupon karakterleri ve uzunluğu sınırlı
- checkout intent değişince idempotency key yenileniyor
- sepet, hedef ülke veya kupon değişince eski kargo teklif talebi state'i geçersizleşiyor
- payment readiness yalnız gerçek backend değerleriyle açıklanıyor
- canlı kart sağlayıcısı yokken ödeme başarılı veya karttan para çekilmiş gibi davranılmıyor
- sipariş başarı ekranında eksik order number gerçek numara gibi uydurulmuyor

## Bilerek yapılmayanlar

- Kullanım Koşulları metni uydurulmadı.
- Nihai KVKK/gizlilik metni uydurulmadı; mevcut live içerik taslak olduğunu söylüyorsa bu gerçek korunuyor.
- Sahte işletme veya destek kimliği eklenmedi.
- Sahte ödeme sağlayıcısı, kart veya merchant bilgisi eklenmedi.
- Sahte kargo fiyatı veya eksik ürün ağırlığı eklenmedi.
- GitHub Actions billing/minute engeli devam ederken yeni workflow tetiklenmedi.
- PR #47 merge edilmedi.

## Doğrulama ve release durumu

Son fonksiyonel kod head'i:

`d96e716d2d80ee34bf9d914b752382ec75d57c59`

Bu head üzerinde GitHub Actions çalıştırılmadı. Mevcut billing/minute veya runner allocation engeli nedeniyle bu çalışma `CI-green` olarak adlandırılamaz.

Runner tahsisi geri geldiğinde tek anlamlı son quality gate çalıştırılmalıdır: release audit, TypeScript, production build, Capacitor sync reproducibility, Android release bundle ve iOS simulator compilation.

Bu gerçek quality gate yeşil olmadan ve kullanıcı açıkça merge onayı vermeden PR #47 merge edilmemelidir.
