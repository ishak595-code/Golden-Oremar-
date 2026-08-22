# iOS App Store Release ve Signing

Golden Oremar bundle identifier: `com.goldenoremar.app`

## CI'nın otomatik doğrulayabildiği bölüm

Store-readiness CI, Xcode 26.6 ile:

1. Web build ve `cap sync ios` yapar.
2. Native asset doğrulamasını çalıştırır.
3. Swift package bağımlılıklarını çözer.
4. iOS Simulator build'i derler.
5. `Release` konfigürasyonunda gerçek `iphoneos` SDK ile **imzasız `.xcarchive` compile** eder.

Bu archive adımı release kaynak kodunun fiziksel iOS cihaz SDK'sına karşı derlenebildiğini doğrular. `CODE_SIGNING_ALLOWED=NO` kullanılması bilinçlidir; Apple Developer sertifikası ve provisioning profile repo/PR ortamında mevcut değildir.

## İshak'ın yapması gereken imzalı App Store adımları

1. Apple Developer Program üyeliğini etkinleştirin.
2. App Store Connect'te `com.goldenoremar.app` için uygulama kaydı oluşturun.
3. Apple Developer hesabında uygun Distribution sertifikası, App ID ve App Store provisioning yapılandırmasını tamamlayın.
4. Gerçek bir Mac'te Xcode ile projeyi açın, doğru Team'i seçin ve Signing & Capabilities ekranının temiz olduğunu doğrulayın.
5. En az bir kez `Product > Archive` çalıştırın.
6. Organizer içinden `Distribute App > App Store Connect` ile Validation ve Upload yapın.
7. TestFlight'ta gerçek cihaz testi yapın.
8. İlk başarılı insan kontrollü upload sonrasında istenirse App Store Connect API Key + sertifika/provisioning secrets ile CI upload otomasyonu ayrıca kurulabilir.

Bu insan adımları gerçekleşmeden “App Store'a imzalı build yüklendi” denmemelidir.

## Info.plist ve izinler

Mevcut native özellikler mikrofon ve konuşma tanıma izin açıklamalarını sesli arama amacıyla içerir. Uygulama native GPS, kamera veya fotoğraf kütüphanesi API'sini doğrudan istemediği için sırf mağaza hazırlığı amacıyla gereksiz izin anahtarları eklenmemelidir.

Mevcut kodda reklam/attribution tracking SDK'sı bulunmadığı ve kullanıcılar başka şirketlerin uygulama/web siteleri boyunca izlenmediği için ATT istemi ve `NSUserTrackingUsageDescription` gerekli değildir. Tracking davranışı ileride değişirse bu karar yeniden değerlendirilmelidir.

## Sürümleme

App Store'a her yeni build için `CFBundleVersion` artmalıdır. Pazarlama sürümü `CFBundleShortVersionString` ile yönetilir. İlk production upload öncesi Xcode'da Marketing Version ve Build değerleri App Store Connect kaydıyla eşleştirilmelidir.
