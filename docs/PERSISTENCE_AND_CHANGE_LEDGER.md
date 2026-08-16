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

## Harici konfigürasyon notu
Google/Facebook OAuth, ödeme sağlayıcısı, kargo sağlayıcısı ve store signing gibi dış credential gerektiren özellikler; kod hazır olsa bile ilgili sağlayıcı gerçekten yapılandırılmadan "aktif" kabul edilmez.
