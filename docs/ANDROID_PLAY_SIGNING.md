# Android Play Store Signing

Golden Oremar Android application ID: `com.goldenoremar.app`

## 1. Upload key üretimi

Repo sahibi güvenilir bir bilgisayarda bir kez çalıştırmalıdır:

```bash
keytool -genkeypair -v \
  -keystore golden-oremar-upload.jks \
  -alias golden-oremar-upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Keystore ve şifreleri kaybedilmemelidir. `.jks` dosyası repoya, Git LFS'e veya herkese açık dosya depolamasına yüklenmemelidir. Güvenli çevrimdışı yedek alınmalıdır.

Google Play App Signing kullanılması önerilir. Play dağıtım anahtarını yönetirken bu dosya uygulamanın **upload key**'i olarak kullanılır.

## 2. GitHub Actions Secrets

Keystore dosyasını base64 metne dönüştürün ve şu repository secret'larını tanımlayın:

- `ANDROID_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_UPLOAD_KEYSTORE_PASSWORD`
- `ANDROID_UPLOAD_KEY_ALIAS`
- `ANDROID_UPLOAD_KEY_PASSWORD`

macOS/Linux örneği:

```bash
base64 < golden-oremar-upload.jks | tr -d '\n'
```

Üretilen tek satır çıktı `ANDROID_UPLOAD_KEYSTORE_BASE64` secret'ına girilir.

CI keystore'u yalnız runner'ın geçici dizinine çözer. Gradle'a şu runtime env değişkenleri verilir ve bunlar repoya yazılmaz:

- `ANDROID_KEYSTORE_FILE`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## 3. CI davranışı

Gerçek dört secret birlikte varsa `bundleRelease` gerçek Play upload key'i ile imzalanır ve artifact içindeki `signing-source.txt` değeri `github-secrets` olur.

Secret'lar henüz yoksa PR ve teknik doğrulama için runner içinde geçici bir CI keystore üretilebilir. Bu durumda `signing-source.txt` değeri `ephemeral-ci` olur. Bu geçici anahtarla üretilen AAB **Play Console'a yüklenmemelidir**. Ama signing yapılandırmasının ve AAB imza doğrulamasının çalıştığını kanıtlar.

Her release AAB için CI `jarsigner -verify` çalıştırır.

## 4. Play Console gönderim öncesi kapı

Play Console'a gönderilecek artifact için aşağıdakilerin tamamı doğru olmalıdır:

- `signing-source.txt = github-secrets`
- Upload key Play Console'da kayıtlı anahtarla eşleşiyor.
- `applicationId = com.goldenoremar.app`
- `targetSdkVersion = 37`
- `compileSdkVersion = 37`
- versionCode önceki Play sürümünden yüksek.
- Store listing, Data Safety, content rating ve privacy policy URL tamamlanmış.

## 5. Anahtar kaybı

Upload key kaybolursa Play App Signing kullanılan uygulamalarda Google'ın upload-key reset süreci uygulanabilir. Yine de üretim anahtarları parola yöneticisi + güvenli çevrimdışı yedek ile korunmalıdır.
