# Golden Oremar Persistence & Change Ledger

Bu belge proje bilgilerinin sohbet geçmişine bağımlı kalmaması için kalıcı kayıt sözleşmesidir.

## Nerede ne saklanır?

### GitHub — kaynak gerçekliği
Aşağıdakiler GitHub deposunda tutulur:
- React/TypeScript uygulama kaynakları.
- Android ve iOS native proje kaynakları.
- Capacitor yapılandırması.
- UI/UX, erişilebilirlik ve entegrasyon kodu.
- PWA/manifest ve public statik varlıklar.
- Dokümantasyon, roadmap ve kalite kapıları.
- Supabase migration manifest/export dosyaları depoya aktarıldığında bunların sürümlenmiş kopyaları.

### Supabase — canlı veri ve backend gerçekliği
Aşağıdakiler Supabase'te tutulur:
- Postgres şeması ve migration history.
- Ürünler, üreticiler, varyantlar ve stok.
- Sipariş/ödeme durumları, kargo, iade/refund.
- Kullanıcı profilleri, adresler, favoriler, takipler.
- Mesajlar, bildirimler, yorumlar.
- Satıcı başvuruları, doğrulama ve özel KYC verileri.
- Lot/batch izlenebilirlik kayıtları.
- Kampanya/kupon, finans/payout ve diğer server-side işlemler.

Kaynak kod veya build dosyaları veritabanına kopyalanmaz. Canlı müşteri/KYC verileri de GitHub'a konmaz. Bu ayrım güvenlik ve veri minimizasyonu için zorunludur.

## Tamamlanan ve kalıcı hale getirilen frontend/native paketleri
- Golden Oremar Android/iOS native kimliği: `com.goldenoremar.app`.
- Java 21 + Android API 36 build hattı.
- Capacitor native back davranışı ve safe-area/status-bar senkronu.
- Native e-posta doğrulama / şifre recovery deep link akışı.
- Provider-config kontrollü Google/Facebook OAuth temeli.
- Server-backed bildirim unread rozeti ve sipariş/mesaj deep-linkleri.
- Public metadata/PWA güven ve zoom erişilebilirlik sertleştirmesi.
- İstemci bundle'ına gereksiz gizli Gemini anahtarı enjekte edilmesinin kaldırılması.
- Route-level lazy loading ve kalıcı Mobile Quality Gate.
- Canonical canlı ürün kartı; ürün detayı, arama, üretici profili ve kategori ekranlarında aynı stok/puan/üretici güven modelinin kullanılması.
- Dinamik ana vitrin: server kategori sırası, gerçek featured/satılabilir spotlight seçimi ve fail-safe üretici trust metrikleri.
- Mobil üst kabuk: 44px sınıfı dokunma hedefleri, açık accessible names, focus-visible ve gerçek sepet/bildirim sayıları.
- Mobil alt gezinme: `nav` landmark, `aria-current`, safe-area ve okunabilir 11px etiketler.
- Hesap alt görünüm focus yönetimi ve ortak panel heading semantiği.
- Adres ekle/düzenle için shared accessible-dialog davranışı; adres silmede destructive confirmation; duplicate-action guards ve canlı durum geri bildirimi.
- Kişisel görünüm tercihi cihazda `golden-oremar:appearance-theme:v1` anahtarıyla tutulur; müşteri tema seçimi legacy global Firestore ayarına yazılmaz.
- İlk render öncesi kaydedilmiş tema veya OS color-scheme uygulanır ve native status bar aynı tema ile senkronlanır.
- Aydınlık tema gerçek açık yüzey/koyu metin tokenlarına taşınmıştır; temel light kart üzerindeki ana metin/yeşil/altın/muted metin kontrastları otomatik kontrol edilir.
- Hesap Ayarları async işlemleri işlem türüne göre ayrı error/status/busy durumları kullanır; şifre, bülten, bildirim, oturum ve hesap-kapatma hataları yanlış panelde gösterilmez.
- Bildirim kaydı ve diğer Ayarlar mutasyonları çift tetiklenmeye karşı busy guard kullanır; hesap kapatma backend isteğinden önce accessible confirmation alertdialog üzerinden açık onay alır.
- Hesap içindeki modal davranışı tek canonical `useAccessibleDialog` motorundan gelir; account özel eski focus-trap yalnız compatibility wrapper olarak aynı hook'u çağırır.
- Profil fotoğrafı kaldırma ve ödeme bekleyen siparişi iptal etme gibi destructive müşteri işlemleri backend mutasyonundan önce açık `alertdialog` onayı ister.
- Sipariş ana dialogu nested iade/cancel dialogu açıkken kendi focus trap'ini durdurur; iki modal aynı anda klavye odağı için yarışmaz.
- İade talebi ve iade detayı loading durumları gerçek modal overlay/focus trap/Escape/scroll lock sözleşmesini korur.
- Favori ve takip bırakma gibi geri alınabilir satır mutasyonlarında gereksiz destructive confirmation eklenmez; per-row busy guard, hata/başarı duyurusu ve secure server refresh kullanılır.
- Takip edilen üretici kartlarında konum veya doğrulama fallback ile uydurulmaz; yalnız backend alanları gösterilir.
- Hediye ve ödeme geçmişi raw durum kodlarını bilinen durumlar için müşteri diline çevirir, bilinmeyen backend değerlerini kaybetmeden güvenli biçimde insan-okunur sunar.
- Ödeme ekranı gerçek sağlayıcı bağlanmadan kayıtlı kart kasası veya sahte ödeme yöntemi simüle etmez.
- Sepet satır miktar/sil mutasyonları satır bazlı busy guard ve live status kullanır; paralel tekrar tetikleme engellenir.
- Tüm sepeti temizleme tek dokunuşla çalışmaz; canonical accessible confirmation dialog üzerinden açık onay ister.
- Checkout submit kilidi son server preview doğrulamasından önce devreye girer ve aynı müşteri tıklamasının paralel preview/order yarışını engeller; server idempotency ana güvenlik otoritesi olarak korunur.
- Cart error alert odak alır; coupon/shipping/submit/destructive kontrollerde explicit button/focus semantiği korunur.
- Etkinlik kayıt modalı canonical accessible dialog kullanır; form busy iken tekrar gönderilmez, kayıt/load hataları odağa alınır ve kapasite/bekleme listesi gerçeği backend'den gelir.
- İletişim ekranı geçici contact-config ağ hatasını "kanal yayınlanmadı" durumundan ayırır; form aktif kalır ve telefon/e-posta gibi iletişim bilgileri uydurulmaz.
- İletişim formu client validation, busy guard, focused error ve başarı duyurusu kullanır; mevcut secure edge submission/honeypot backend'i korunur.
- Sağlık & Tarifler ekranı içerik favorilerinde per-item busy/status kullanır; detail/loading modalı canonical accessible dialog davranışını paylaşır.
- Sağlık içerik detayı loading isteği request-id guard ile iptal edilebilir; kullanıcı modalı kapattıktan sonra eski async yanıt içeriği yeniden açamaz.
- Sağlık içeriğinin backend-sanitized HTML ve ürün güvenliği bilgisi korunur; yeni tedavi/sağlık iddiası eklenmez.
- Yayınlanmış SSS/Yardım içerik entegrasyonu; olmayan Terms metni uydurulmaz.
- Yapılandırılmış ürün güvenliği / sağlık uyarıları ve kaynak modeli.

## Backend migration kaydı
Production Supabase projesi: `golden-oremar` (`rmfcziawxjgcnxexbrvw`).
Migration history Supabase'in migration tablosunda tutulmaktadır. Önemli son migration serileri arasında şunlar vardır:
- onboarding resume v4
- customer review dashboard
- public product detail + metadata sanitization
- account shopping hub + gift checkout v4
- payment activity/account overview
- account help content
- producer dashboard
- secure checkout preview
- category/home/public engagement catalog
- customer content favorites
- storefront config
- production location suggestions
- producer product/batch management
- atomic return evidence
- public producer inventory truth
- secure producer order fulfillment
- structured public product safety
- public FAQ/help content

## Değişiklik kuralı
1. Mevcut tamamlanmış modül yeniden yazılmaz.
2. Yeni paket ayrı branch/PR veya kontrollü commit ile hazırlanır.
3. Build/contract doğrulaması yapılır.
4. GitHub ana dalına alındıktan sonra tamamlandı kabul edilir.
5. DDL gerekiyorsa `apply_migration` ile Supabase migration history'ye yazılır.
6. Hassas iş verisi asla GitHub'a kopyalanmaz.
7. Harici sağlayıcı credential'ları source code'a yazılmaz.
8. Daha güçlü canonical bileşen mevcutsa daha zayıf paralel UI korunmaz; iş mantığı kopyalanmadan canonical yol yeniden kullanılır.
9. Kullanıcı-facing trust/organic/health/verification bilgisi yalnız server-backed doğrulanmış kaynaktan gösterilir; fallback ile güven rozeti üretilmez.
10. Cihaza/kişiye özel görünüm tercihi global admin/site ayarına yazılmaz; kullanıcı cihaz tercihi ile yönetim ayarı ayrı tutulur.
11. Kullanıcı tetiklediği async mutasyonlarda buton busy iken tekrar çalışmaz; hata ve başarı geri bildirimi işlemin gerçekleştiği panelde gösterilir.
12. Geri alınması zor destructive müşteri mutasyonları tek dokunuşla yapılmaz; uygun accessible confirmation kullanılır.
13. Modal focus/scroll/Escape/focus-return davranışı paralel implementasyonlarla çoğaltılmaz; canonical shared dialog hook yeniden kullanılır.
14. Geri alınabilir list-row mutasyonlarında tüm ekranı kilitlemek yerine ilgili satır busy olur; hata temizlenir, sonuç duyurulur ve server gerçeğiyle yeniden senkronlanır.
15. Ham backend durum kodu customer UI'da doğrudan bırakılmaz; bilinen değerler okunabilir etikete çevrilir, bilinmeyen değerler kaybolmadan güvenli fallback ile gösterilir.
16. Checkout UI kendi client busy kilidini kullanır ama fiyat/stok/kargo/kupon/idempotency otoritesi daima server tarafında kalır; client doğrulaması güvenlik sınırı sayılmaz.
17. Public ekranlarda geçici ağ/servis hatası, gerçekten yayınlanmamış içerik/kanal durumu gibi gösterilmez; failure state ve empty/unpublished state ayrı tutulur.
18. Uzun async detail istekleri kullanıcı modalı kapatıldıktan sonra UI'ı stale yanıtla yeniden açamaz; uygun request/cancellation guard kullanılır.

## Harici konfigürasyon notu
Google/Facebook OAuth, ödeme sağlayıcısı, kargo sağlayıcısı ve store signing gibi dış credential gerektiren özellikler; kod hazır olsa bile ilgili sağlayıcı gerçekten yapılandırılmadan "aktif" kabul edilmez.
