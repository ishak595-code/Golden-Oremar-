# Golden Oremar Mobile Product Roadmap

Bu belge Golden Oremar Android/iOS uygulamasının kalıcı uygulama yol haritasıdır. Sohbet geçmişinden bağımsız olarak hangi modüllerin tamamlandığını, hangi kararların alındığını ve sıradaki işleri takip eder.

## Ürün ilkesi
- Golden Oremar bir mobil uygulamadır; Android ve iOS birinci sınıf platformlardır.
- Odak: köy/doğal ürünleri, üretici doğrulaması, menşe ve lot izlenebilirliği.
- Sertifikasız ürün için "sertifikalı organik" iddiası kullanılmaz.
- Ödeme, stok, rol, doğrulama ve fiyat otoritesi server tarafındadır.
- Mevcut tamamlanmış modüller yeniden yazılmaz; yalnız eksik entegrasyon ve kalite sorunları düzeltilir.
- Admin paneli ürün/müşteri deneyimi tamamlandıktan sonra son aşamada ele alınır.

## Mobil platform tabanı
- Android application id: `com.goldenoremar.app`
- iOS bundle id: `com.goldenoremar.app`
- Android modern ana sürüm: minSdk 24 (Android 7+), target/compile SDK 36.
- Java toolchain: 21.
- iOS deployment target: 15.0.
- Capacitor 8 stable hattı.
- Android 6 (API 23) Capacitor 8 resmi minSdk 24 ile çakıştığı için modern ana sürümde desteklenmez. Gerekirse ayrı ve izole legacy varyant teknik/iş riski değerlendirmesiyle ele alınır; modern uygulama geriye düşürülmez.

## Tamamlanan ana müşteri modülleri
- Supabase Auth e-posta/şifre, native deep-link şifre kurtarma.
- Hesap merkezi: profil, siparişler, favoriler, takip edilen üreticiler, hediyeler, adresler, ödeme hareketleri, bildirimler, mesajlar, yorumlar, ayarlar, yardım.
- Güvenli sepet ve checkout altyapısı; hediye checkout v4.
- Ürün arama/filtre/sıralama ve katalog.
- Güvenli ürün detay API'si.
- Doğrulanmış yorum iş akışı.
- Üretici takip/takipten çıkma.
- Bildirim paneli + global gerçek unread rozeti.
- Satıcı başvuru/onboarding v4 ve satıcı dashboard backend'i.
- Lot/QR izlenebilirlik backend'i.
- İade/refund, promosyon/kupon, global kargo guard, finans/payout backend'i.
- Native Android/iOS kimliği, safe-area/status-bar ve Android geri tuşu sertleştirmesi.
- Public metadata/PWA güven ve erişilebilirlik sertleştirmesi.

## Sıradaki uygulama sırası
1. Mobil platform paketlerini güncel stable Capacitor 8 hattında hizala ve CI kalite kapıları ekle.
2. Google ve Facebook sosyal girişini provider-config kontrollü olarak ekle; native external browser + deep link dönüşü kullan.
3. Ürün kartlarını server-backed dinamik metriklerle güçlendir: değerlendirme puanı/sayısı, stok/variant, doğrulanmış üretici, üretici takipçi sayısı, menşe güven sinyalleri. Var olan bilgileri silme.
4. Üretici profilinde takipçi sayısı ve takip/takipten çıkma durumunu aynı server gerçeğinden göster.
5. Ürün miktar artır/azalt ve sepete ekleme mikro-etkileşimlerini erişilebilir, stok-korumalı ve performanslı hale getir.
6. Ürün açıklaması, menşe, kullanım/saklama ve sağlık/beslenme bilgi alanlarını yapılandırılmış içerik olarak zenginleştir; sağlık iddiası üretme, kaynak/uyarı modeli kullan.
7. SSS/Yardım içerik alanını gerçek yayınlanmış içerik sistemiyle tamamla; olmayan hukuki metinleri uydurma.
8. Ana sayfa vitrini, kategoriler ve kart yoğunluğunu mobil-first, yeşil prestijli tema ve kiraz kırmızısı marka aksanlarıyla sonlandır.
9. TalkBack/VoiceOver, dynamic text/zoom, focus, live-region, modal, minimum dokunma alanı ve Android back testleri.
10. Performans: startup, lazy loading, görsel boyutları, cache, bundle split ve ağ hata durumları.
11. iOS gerçek Xcode build/signing ve fiziksel cihaz testi; Android release AAB testleri.
12. Admin paneli son aşamada.

## Harici konfigürasyon gerektirenler
- Supabase Auth Additional Redirect URLs içine `com.goldenoremar.app://auth/callback` eklenmesi.
- Google OAuth uygulaması/Client ID + Secret ve Supabase Google provider ayarı.
- Meta/Facebook App ID + Secret ve Supabase Facebook provider ayarı.
- Gerçek ödeme sağlayıcısı.
- Gerçek kargo/carrier fiyatları ve ürün varyant gramajları.
- App Store / Play Store signing, privacy ve store listing bilgileri.

## Kalite kapısı
Her müşteri etkileyen paket mümkün olduğunda şu sırayla doğrulanır:
1. Kaynak sözleşme/TypeScript kontrolü.
2. Production web build.
3. `npx cap sync android` ve iOS sync.
4. Android gerçek `assembleDebug` veya release uygun kapı.
5. iOS için macOS/Xcode ortamında native build kapısı mevcut olduğunda çalıştırılır.
6. PR dosya farkı kontrol edilir; geçici workflow/scriptler kalıcı kaynaklara karışmaz.
