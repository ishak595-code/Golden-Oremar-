# Ön Bilgilendirme Formu

> **TASLAKTIR. Avukat onayı olmadan yayına alınmaz.**
> Bu form, sipariş onaylanmadan **önce** alıcıya gösterilmek ve alıcının
> okuduğunu onaylaması zorunludur. Aşağıdaki `{{...}}` alanları her siparişte
> sistem tarafından otomatik doldurulur; `[DOLDURULACAK: ...]` alanları bir
> kez, satıcı kimliği belirlenince doldurulur.

## 1. Satıcı bilgileri

- Ticari unvan: [DOLDURULACAK]
- Açık adres: [DOLDURULACAK]
- Telefon: [DOLDURULACAK]
- E-posta: [DOLDURULACAK]
- Vergi dairesi ve numarası: [DOLDURULACAK]
- MERSIS numarası: [DOLDURULACAK]

[DOLDURULACAK: Başka üreticilerin ürünleri satılıyorsa, satıcı o ürünün
üreticisidir ve Golden Oremar aracı hizmet sağlayıcıdır. Bu durumda her
satıcı için yukarıdaki bilgiler ayrı gösterilmelidir. Avukat karar
vermeli.]

## 2. Ürün ve fiyat bilgileri

| Ürün | Seçenek | Adet | Birim fiyat | Tutar |
|---|---|---|---|---|
| {{urun_adi}} | {{secenek}} | {{adet}} | {{birim_fiyat}} | {{tutar}} |

- Ara toplam: {{ara_toplam}}
- İndirim: {{indirim}}
- Kargo: {{kargo_ucreti}}
- **Vergiler dahil toplam: {{genel_toplam}}**

Fiyatlara KDV dahildir. [DOLDURULACAK: vergi durumu mali müşavirle
doğrulanmalı]

## 3. Ödeme

Ödeme yöntemi: {{odeme_yontemi}}
Ödeme, sipariş sırasında alınır. [DOLDURULACAK: ön sipariş ürünlerinde
ödemenin ne zaman alındığı netleştirilmeli]

## 4. Teslimat

- Teslimat adresi: {{teslimat_adresi}}
- Tahmini teslimat: {{tahmini_teslimat}}

Ürünler en geç **30 gün** içinde teslim edilir. **Ön siparişli ürünlerde**
(örneğin kuzu, oğlak, taze balık) hasat veya kesim tarihi ürün sayfasında
belirtilir. [DOLDURULACAK: 30 günü aşabilecek ön siparişlerin yasal durumu
avukatla netleştirilmeli]

## 5. Cayma hakkı

**Bu siparişteki bazı ürünlerde cayma hakkı YOKTUR.** Çabuk bozulan
gıdalar ve ambalajı açılmış gıdalar sağlık ve hijyen nedeniyle cayma hakkı
kapsamı dışındadır.

{{cayma_hakki_olmayan_urunler_listesi}}

Diğer ürünlerde, teslimden itibaren 14 gün içinde gerekçe göstermeden
cayma hakkınızı kullanabilirsiniz. Ayrıntılar: İade ve Cayma Hakkı sayfası.

**Ayıplı ürün hakkınız her ürün için geçerlidir.**

## 6. Şikayet ve itiraz

Şikayetleriniz için yukarıdaki iletişim bilgilerini kullanabilirsiniz.
Parasal sınırlar dahilinde Tüketici Hakem Heyetine, sınırın üzerinde
Tüketici Mahkemesine başvurabilirsiniz. [DOLDURULACAK: güncel parasal
sınır her yıl değiştiği için metne sabit rakam yazılmamalı]
