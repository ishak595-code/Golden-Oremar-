-- Ürün öne çıkan özellik (features) ve etiket (tags) metinlerinin sadeleştirilmesi.
-- Abartılı veya sağlık iddiası çağrıştıran ifadeler ("Lif Bombası", "Muhteşem Susuzluk
-- Giderici", "Ekstra Besleyicilik", "Yoğun Besleyici" vb.) sakin ve olgusal Türkçe
-- karşılıklarla değiştirildi. 305 numaralı üründe doğrulanmamış "yaşlı tavuk" ifadesi
-- kısa açıklama ve açıklamadan çıkarıldı.
-- Ürün id'sine göre idempotenttir; fiyat, stok, varyant ve diğer ticari alanlara dokunmaz.
-- null olan sütun mevcut değeri korur.
with v(id, features, tags, descr) as (
  values
  ('1347f7c2-9a3b-4622-ad85-53e70238ffaf'::uuid, $go$["Süleyman Usta'nın Kayalık Yamaç Hasadı", "Dağlıca Yayla Çiçeklerinden"]$go$::jsonb, array[$go$Yılda Tek Hasat$go$, $go$Kara Kovan$go$]::text[], null::text), -- 101 daglica-karakovan-petek-bali-101
  ('963b8bfa-8e7a-432d-b809-7cc4306c62e7'::uuid, $go$["Merez Hatun'un Geleneksel Yapımı", "8 Ay Mağarada Olgunlaştırma"]$go$::jsonb, array[$go$8 Ay Mağara$go$, $go$Geleneksel$go$]::text[], null::text), -- 201 merez-hatun-un-magara-tulum-peyniri-201
  ('7517d0c2-e0fe-4c6b-99fe-b6e38925a1df'::uuid, $go$["Ahşap Yayıkta Elle Dövülür", "İnek Sütü Kaymağından"]$go$::jsonb, null::text[], null::text), -- 202 naciye-nin-yayik-tereyagi-202
  ('1e22e0e3-3bd3-4359-8b1d-e83eb7501a54'::uuid, $go$["Dağ Otları Elle Toplanır", "Sirmo, Mendo ve Heliz Otlu", "Kaya Tuzu Salamurasında Dinlenir", "Sıkı ve Hafif Sert Doku"]$go$::jsonb, null::text[], null::text), -- 203 havahan-in-otlu-dag-peyniri-203
  ('35d9cc53-6667-44d5-90c3-3e4132a46d81'::uuid, $go$["Amine Ana'nın Şafak Sağımı", "Isıl İşlem Görmemiş, Kaynatılmamış Çiğ Süt", "Cam Şişede Teslim", "Bekledikçe Üstünde Kaymak Toplanır"]$go$::jsonb, null::text[], null::text), -- 204 gunluk-taze-civik-sut-sagimdan-kapiya-204
  ('b3744415-7a3b-406a-8874-641ce3512beb'::uuid, $go$["Üzerinde Tereyağı Zerreleri", "Yoğurdun Doğal Ekşiliği", "Soğuk İçime Uygun"]$go$::jsonb, array[$go$Soğuk Zincir$go$, $go$Yayık Ayranı$go$]::text[], null::text), -- 205 taze-yayik-ayrani-canli-kultur-205
  ('dc5c8644-550a-4033-82e1-5637301c277a'::uuid, $go$["Akarsu Ortamında Büyür", "Pembe Renkli Eti"]$go$::jsonb, null::text[], null::text), -- 301 avasin-deresi-canli-alabaligi-ozel-hasat-301
  ('aae99128-f40e-4bc7-929e-f896c00ab313'::uuid, $go$["Sipariş Üzerine Helal Kesim", "İsteğinize Göre Parçalanır"]$go$::jsonb, null::text[], null::text), -- 302 abidin-in-yayla-kuzusu-302
  ('dffffd4a-d660-40df-a682-76cf868858c7'::uuid, $go$["Merada Serbest Gezen Köy Horozu", "Koyu Renkli, Sıkı Et", "Helal Kesim"]$go$::jsonb, array[$go$Çorbalık ve Haşlamalık$go$, $go$Serbest Gezen$go$]::text[], null::text), -- 304 salih-in-meralik-ozgur-horozu-304
  ('bfd5e5f6-a2c0-4511-815a-d83f0be8ef78'::uuid, $go$["Amine Yenge'nin Elinden Seçme", "İri Boy", "Tek Tek Elle Seçilir"]$go$::jsonb, array[$go$İri Boy$go$, $go$Çifte Sarı$go$]::text[], $go$İri, çifte sarılı köy yumurtaları; Amine Yenge tek tek seçer, otuzluk kolide gelir.$go$), -- 305 amine-nin-cifte-sari-koy-yumurtasi-305
  ('65325abe-33ec-4588-9bcb-b3a9c3e85cb5'::uuid, $go$["Kuru Meşe Odunu", "Yarılmış ve Kurutulmuş", "Soba ve Şömine Boyunda Kesilir", "Kuzine Sobalara Uygun"]$go$::jsonb, array[$go$Kuru Meşe$go$, $go$Şömine Tipi$go$]::text[], null::text), -- 403 sobalik-mese-yarigi-403
  ('d55e016b-ec47-4f92-a900-a2550e6917c5'::uuid, $go$["Hüsnü Dayı'nın Geleneksel Kurutma Yöntemi", "İri ve Açık Renkli İç", "İnce, Kolay Kırılan Kabuk"]$go$::jsonb, null::text[], null::text), -- 504 husnu-dayi-nin-kagit-kabuklu-cevizi-504
  ('24a412fc-19d6-4e82-8e9f-78dae33acce8'::uuid, $go$["Ayşe Teyze'nin 5 Günlük Yapımı", "Dilimlenip Dondurularak Saklanabilir"]$go$::jsonb, array[$go$Palamut Unlu$go$, $go$Özel Sipariş$go$]::text[], null::text), -- 505 el-isciligi-mese-palamudu-ekmegi-505
  ('d80d915b-5653-43c9-868e-d376a50095fd'::uuid, $go$["Sabah Erken Toplanır", "İğneyle İpe Dizilir", "Gölgede Kurutulur, Yeşil Kalır"]$go$::jsonb, array[$go$El Emeği$go$, $go$Kışlık$go$]::text[], null::text), -- 702 sabir-kurutmasi-cicek-bamyasi-702
  ('1e90c6db-fa50-4b05-84f1-2f2224f04f21'::uuid, $go$["Toprakta Yetişir", "Suni Gübresiz", "Belirgin Domates Kokusu"]$go$::jsonb, null::text[], null::text), -- 802 yuksekova-yayla-domatesi-802
  ('79ea7368-1e8a-49c9-ac02-939a584d661f'::uuid, $go$["Geleneksel Fermantasyon", "Hardal Tohumlu"]$go$::jsonb, null::text[], null::text), -- 805 hardaliye-geleneksel-805
  ('ec7df8a1-4b85-4b5c-b440-aeae1b17f781'::uuid, $go$["Çekirdeksiz Dönem", "Kıtır Doku", "Ekşi Tat"]$go$::jsonb, null::text[], null::text), -- 806 kitir-taze-cagla-badem-806
  ('84714717-f619-4a84-9181-603252bd00c3'::uuid, $go$["Geleneksel Askı Yöntemi", "Kahve Yanı", "Bütün Meyve"]$go$::jsonb, null::text[], null::text), -- 808 kislik-kurutulmus-cennet-hurmasi-808
  ('77e8ba53-ccb1-41ef-9151-98a44be1469a'::uuid, $go$["Vişne ve Dağ Kekiği", "Odun Ateşinde Kaynatılır"]$go$::jsonb, array[$go$Soğuk Servis$go$, $go$Ev Yapımı$go$]::text[], null::text) -- 809 kekik-aromali-visne-kompostosu-809
)
update public.products p
set features = coalesce(v.features, p.features),
    tags = coalesce(v.tags, p.tags),
    short_description = coalesce(v.descr, p.short_description),
    description = coalesce(v.descr, p.description)
from v
where p.id = v.id
  and (p.features is distinct from coalesce(v.features, p.features)
    or p.tags is distinct from coalesce(v.tags, p.tags)
    or p.short_description is distinct from coalesce(v.descr, p.short_description)
    or p.description is distinct from coalesce(v.descr, p.description));
