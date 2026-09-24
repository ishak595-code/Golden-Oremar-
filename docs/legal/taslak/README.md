# Yasal Metin Taslakları - Okumadan Yayına Alma

**Bu klasördeki hiçbir metin yayında değildir ve avukat onayı olmadan
yayına alınmamalıdır.** Metinler, avukatın sıfırdan yazmak yerine kontrol
edip düzeltebileceği bir başlangıç noktasıdır.

Hazırlanma tarihi: 2026-09-25

---

## ÖNCE ÇÖZÜLMESİ GEREKEN ENGEL: Satıcı kimliği yok

Veritabanı kontrolü (2026-09-25):

- `brand_settings.legal_name` = "Golden Oremar" (bu bir marka adı, şirket
  unvanı değil)
- Yasal adres: **boş**
- Vergi dairesi: **boş**
- Vergi numarası: **boş**

Türkiye'de internetten tüketiciye satış için satıcının **ticari unvanı,
açık adresi, vergi numarası veya MERSIS numarası** sözleşmede ve sitede yer
almak zorundadır. iyzico başvurusu da bir tüzel kişilik veya şahıs şirketi
olmadan onaylanmaz.

Bu bir kod sorunu değil, **iş kararıdır**. Karar verilmesi gerekenler:

1. **Satışı hangi tüzel kişilik yapacak?** Olası seçenekler:
   - Mevcut aile şirketi (Alperler Otomotiv Turizm ve Tic. Ltd. Şti.).
     Faaliyet alanı otomotiv ve turizm. Gıda perakendesi için şirketin
     faaliyet konusuna ve NACE koduna gıda ticareti eklenmesi gerekebilir.
   - Yeni bir şahıs şirketi veya limited şirket.
   - Başka bir aile üyesi adına kurulacak bir işletme.

   İshak'ın İsviçre'de ikamet etmesi, Türkiye'de şirket sahipliği ve vergi
   mükellefiyeti açısından ayrıca değerlendirilmelidir. **Mali müşavire
   sorulmalı.**

2. **Gıda işletme kaydı.** Gıda satan bir işletme, Tarım ve Orman
   Bakanlığı il müdürlüğünden kayıt veya onay belgesi almak zorundadır.
   Hangi belgenin gerektiği (kayıt mı onay mı) ürün türüne ve işletmenin
   üretici mi aracı mı olduğuna göre değişir. **Doğrulanmalı.**

3. **Satıcı mı, aracı mı?** Şu an tüm ürünleri Golden Oremar resmi mağazası
   satıyor. Başka üreticiler katıldığında Golden Oremar, 6563 sayılı
   Elektronik Ticaretin Düzenlenmesi Hakkında Kanun kapsamında **aracı
   hizmet sağlayıcı** olur. Bu durumda sözleşmenin tarafı her ürün için
   o ürünü satan üreticidir, Golden Oremar değil. Metinlerin buna göre iki
   ayrı sürümü gerekebilir. **Avukata sorulmalı.**

---

## Taslaklar

| Dosya | Yasal dayanak | Ne zaman gerekli |
|---|---|---|
| `ON_BILGILENDIRME_FORMU.md` | Mesafeli Sözleşmeler Yönetmeliği | Sipariş onayından ÖNCE gösterilmeli |
| `MESAFELI_SATIS_SOZLESMESI.md` | 6502 sayılı Kanun, Yönetmelik | Her siparişte |
| `IADE_VE_CAYMA.md` | Yönetmelik, cayma hakkı ve istisnalar | Sitede kalıcı sayfa |
| `KVKK_AYDINLATMA_METNI.md` | 6698 sayılı KVKK | Veri toplamadan önce |
| `CEREZ_POLITIKASI.md` | KVKK, Kurul rehberleri | Sitede kalıcı sayfa |

Mevcut yayındaki metinler: `docs/legal/PRIVACY_POLICY_TR.md` (gizlilik
politikası) ve `docs/legal/TERMS_OF_USE_TR.md` (kullanım şartları).
**KVKK aydınlatma metni gizlilik politikası ile çakışır.** Avukat ikisini
birleştirmeli veya çelişki olmadığını doğrulamalıdır.

---

## Avukata sorulacaklar (kontrol listesi)

- [ ] Satıcı tüzel kişiliği ve unvanı nedir?
- [ ] Golden Oremar satıcı mı, aracı hizmet sağlayıcı mı, yoksa ikisi mi
      (resmi mağaza için satıcı, diğer üreticiler için aracı)?
- [ ] **Cayma hakkı istisnaları** ürün bazında doğru uygulanmış mı? Bu,
      Golden Oremar için en kritik madde: bal, süt, peynir, yumurta, taze
      meyve gibi çabuk bozulan ürünlerde cayma hakkı kullanılamaz. Hangi
      ürünün istisnaya girdiği ürün sayfasında ve ön bilgilendirmede açıkça
      belirtilmeli.
- [ ] Veriler Frankfurt'ta (Supabase, AB) tutuluyor. **KVKK madde 9
      kapsamında yurt dışına aktarım** için hangi dayanak kullanılacak?
      Standart sözleşme kullanılırsa Kurum'a bildirim yükümlülüğü var mı?
- [ ] Diğer yurt dışı hizmet sağlayıcılar: Vercel (barındırma), Google
      Firebase (bildirimler). Bunlar da aktarım kapsamında mı?
- [ ] VERBİS kaydı gerekiyor mu?
- [ ] Ticari elektronik ileti (kampanya bildirimleri) için İYS kaydı
      gerekiyor mu?
- [ ] Teslimat süresi: Yönetmelik en fazla 30 gün öngörüyor. Ön siparişli
      ürünlerde (kuzu, oğlak, alabalık) bu süre nasıl karşılanacak?
- [ ] Hediye siparişi: sözleşmenin tarafı alıcı mı, hediyeyi alan mı?

---

## Yayına alma adımları (avukat onayından SONRA)

1. Tüm `[DOLDURULACAK: ...]` alanlarını doldur.
2. Metinleri `public/<sayfa-adi>/index.html` olarak statik sayfaya çevir
   (mevcut `gizlilik-politikasi` ile aynı yapı) ve `vercel.json` içine
   rewrite ekle.
3. Ödeme adımına onay kutusu ekle (yol haritası 3.6). Kullanıcının hangi
   sürümü onayladığı siparişle birlikte kaydedilmeli: uyuşmazlıkta
   ispat yükü satıcıdadır.
4. Ürün sayfasında, cayma hakkı istisnasına giren ürünlerde bunu açıkça
   göster.
