# Kişisel Verilerin Korunması Aydınlatma Metni

> **TASLAKTIR. Avukat onayı olmadan yayına alınmaz.**
> Bu metin, uygulamanın veritabanı şeması incelenerek **gerçekte işlenen
> verilere** göre hazırlanmıştır. Yeni bir veri türü toplanmaya
> başlandığında metin güncellenmelidir.
>
> Mevcut `docs/legal/PRIVACY_POLICY_TR.md` ile çakışır. Avukat ikisini
> birleştirmeli veya tutarlı hale getirmelidir.

## 1. Veri sorumlusu

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri
sorumlusu:

[DOLDURULACAK: ticari unvan, adres, iletişim, VERBİS kayıt numarası
(varsa)]

## 2. İşlenen kişisel veriler

**Müşteriler için:**

- Kimlik ve iletişim: ad soyad, e-posta, telefon
- Teslimat: adres, teslimat notu
- Sipariş ve işlem: sipariş geçmişi, sepet, favoriler, iade talepleri,
  yorumlar, mesajlar
- Ödeme: kartın yalnızca markası, son 4 hanesi ve ödeme kuruluşunun verdiği
  referans. **Tam kart numarası sistemlerimizde hiçbir zaman tutulmaz**;
  ödeme bilgileri doğrudan ödeme kuruluşu tarafından işlenir.
- Cihaz: bildirim göndermek için cihaz anahtarı (şifrelenmiş olarak
  saklanır)
- Güvenlik: kötüye kullanımı önlemek için IP adresinin geri döndürülemez
  özeti (hash); IP adresinin kendisi bu amaçla saklanmaz
- Pazarlama izni ve izin tarihi

**Üreticiler için ek olarak:**

- T.C. kimlik numarası, vergi numarası, IBAN, MERSIS numarası, gıda kayıt
  numarası, organik sertifika numarası. **Bunların tamamı şifrelenmiş
  olarak saklanır** ve yönetim panelinde yalnızca maskelenmiş halde
  (son birkaç hane) görüntülenir.
- Üretim yeri bilgileri ve doğrulama belgeleri

## 3. İşleme amaçları ve hukuki sebepler

| Amaç | Hukuki sebep (KVKK md. 5) |
|---|---|
| Siparişi almak, teslim etmek, iadeyi yürütmek | Sözleşmenin kurulması ve ifası |
| Fatura ve muhasebe kayıtları | Hukuki yükümlülük |
| Üretici kimliğini ve menşeyi doğrulamak | Hukuki yükümlülük, meşru menfaat |
| Dolandırıcılığı ve kötüye kullanımı önlemek | Meşru menfaat |
| Sipariş durumu bildirimleri | Sözleşmenin ifası |
| Kampanya ve tanıtım bildirimleri | **Açık rıza** (varsayılan olarak kapalıdır) |

[DOLDURULACAK: avukat her amaç için hukuki sebebi doğrulamalı]

## 4. Yurt dışına aktarım

**Verileriniz Türkiye dışında saklanmaktadır.** Kullanılan hizmet
sağlayıcılar:

- **Supabase** - veritabanı ve dosya depolama. Sunucu konumu: Frankfurt,
  Almanya (Avrupa Birliği).
- **Vercel** - web sitesinin barındırılması. [DOLDURULACAK: bölge]
- **Google Firebase** - mobil bildirimlerin iletilmesi.
  [DOLDURULACAK: bölge]

[DOLDURULACAK: KVKK madde 9 kapsamında aktarımın dayanağı (standart
sözleşme, açık rıza veya diğer). Standart sözleşme kullanılıyorsa Kuruma
bildirim yükümlülüğü avukatla netleştirilmeli. BU MADDE YASAL RİSK
TAŞIR, avukatsız yayınlanmamalı.]

## 5. Aktarılan taraflar

- Ödeme kuruluşu: [DOLDURULACAK: iyzico, başvuru onaylanınca]
- Kargo firmaları: yalnızca teslimat için gerekli ad, adres, telefon
- Siparişi hazırlayan üretici: yalnızca kendi siparişi için gerekli
  teslimat bilgileri
- Yetkili kamu kurumları: yasal zorunluluk halinde

## 6. Saklama süresi

[DOLDURULACAK: vergi mevzuatı fatura ve muhasebe kayıtlarının saklanmasını
zorunlu kılar; diğer veriler için süreler avukat ve mali müşavirle
belirlenmeli]

Hesabınızı kapattığınızda profiliniz anonimleştirilir, adresleriniz,
favorileriniz ve bildirim anahtarlarınız silinir. Yasal saklama
yükümlülüğü olan sipariş kayıtları süre dolana kadar korunur.

## 7. Haklarınız (KVKK madde 11)

- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- İşlenmişse bilgi talep etme
- İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
- Yurt içinde ve yurt dışında aktarıldığı üçüncü kişileri bilme
- Eksik veya yanlış işlenmişse düzeltilmesini isteme
- Silinmesini veya yok edilmesini isteme
- Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere
  bildirilmesini isteme
- Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz
  etme
- Kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın
  giderilmesini talep etme

Başvuru: [DOLDURULACAK: başvuru e-postası ve adresi]
Uygulama içinden hesap kapatma talebi: **Hesabım → Ayarlar**
