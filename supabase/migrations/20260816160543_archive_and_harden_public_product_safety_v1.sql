create table if not exists private.product_public_content_archives (
  product_id uuid not null references public.products(id) on delete cascade,
  migration_key text not null,
  archived_at timestamptz not null default timezone('utc', now()),
  short_description text,
  description text,
  features jsonb not null default '[]'::jsonb,
  tags text[] not null default array[]::text[],
  specifications jsonb not null default '{}'::jsonb,
  is_perishable boolean not null,
  requires_cold_chain boolean not null,
  shelf_life_days integer,
  primary key (product_id, migration_key)
);

alter table private.product_public_content_archives enable row level security;
drop policy if exists product_public_content_archives_deny_all on private.product_public_content_archives;
create policy product_public_content_archives_deny_all
  on private.product_public_content_archives
  for all
  using (false)
  with check (false);
revoke all on private.product_public_content_archives from public, anon, authenticated;

insert into private.product_public_content_archives(
  product_id,migration_key,short_description,description,features,tags,specifications,
  is_perishable,requires_cold_chain,shelf_life_days
)
select id,'archive_and_harden_public_product_safety_v1',short_description,description,
       coalesce(features,'[]'::jsonb),coalesce(tags,array[]::text[]),coalesce(specifications,'{}'::jsonb),
       is_perishable,requires_cold_chain,shelf_life_days
from public.products
where status='published' and is_active=true and deleted_at is null
on conflict (product_id,migration_key) do nothing;

-- Keep taxonomy/IDs stable while removing implied treatment language.
update public.categories
set name='Bal & Dağ Bitkileri',
    description='Bal, çörek otu ve geleneksel dağ bitkileri.',
    updated_at=timezone('utc',now())
where slug='bal-sifa';

-- Clearly perishable/cold-chain animal foods and fresh high-risk produce.
update public.products
set is_perishable=true,
    requires_cold_chain=true,
    updated_at=timezone('utc',now())
where slug in (
  'abidin-in-yayla-kuzusu-302',
  'amine-nin-cifte-sari-koy-yumurtasi-305',
  'avasin-deresi-canli-alabaligi-ozel-hasat-301',
  'fahrettin-in-sutten-kesilmis-oglagi-303',
  'gunes-sirri-guzu-yagi-ic-yag-701',
  'salih-in-meralik-ozgur-horozu-304',
  'gunluk-taze-civik-sut-sagimdan-kapiya-204',
  'havahan-in-otlu-dag-peyniri-203',
  'merez-hatun-un-magara-tulum-peyniri-201',
  'naciye-nin-yayik-tereyagi-202',
  'taze-yayik-ayrani-canli-kultur-205',
  'dag-cilegi-yabani-803',
  'sessiz-orman-kuzu-gobegi-mantari-601'
);

update public.products
set is_perishable=true,
    updated_at=timezone('utc',now())
where slug in (
  'hakkari-dag-elmasi-801',
  'kitir-taze-cagla-badem-806',
  'yuksekova-yayla-domatesi-802'
);

-- Replace legacy medical/therapeutic claims with factual, verifiable product language.
update public.products set
  features='["Koyu renkli meşe/orman florası karakteri","Hasat bölgesi, üretici ve lot bilgileri ürün kaydında izlenir"]'::jsonb,
  tags=array['Koyu Renk'],
  updated_at=timezone('utc',now())
where slug='avasin-mese-bali-103';

update public.products set
  features='["Yabani hasat ürünü; tür doğrulaması satış öncesi kayıt altına alınmalıdır","Mevsimsel ve sınırlı hasat","Pişirme, yanlış tür tanımlamasından kaynaklanan toksin riskini garanti olarak ortadan kaldırmaz"]'::jsonb,
  tags=array['Mevsimsel Hasat','Tür Doğrulaması Gerekli'],
  updated_at=timezone('utc',now())
where slug='sessiz-orman-kuzu-gobegi-mantari-601';

update public.products set
  features='["El işçiliği ahşap kaşık ve yayık tokmağı","Vernik veya sanayi boyası kullanılmadığı üretici beyanına dayanır","Kullanım ve bakım talimatları ürün bilgi kartından kontrol edilmelidir"]'::jsonb,
  tags=array['El İşçiliği','Ahşap Zanaat'],
  updated_at=timezone('utc',now())
where slug='el-islemesi-tahta-kasik-ve-yayik-tokmagi-704';

update public.products set
  features='["Kristal kaya tuzu formu","Blok veya öğütmelik seçenekleri ürün varyantına göre sunulur","Gıda amaçlı kullanım için içerik, analiz ve etiket bilgileri doğrulanmalıdır"]'::jsonb,
  tags=array['Kristal Tuz','Belge Kontrolü'],
  updated_at=timezone('utc',now())
where slug='kirik-tas-kaya-tuzu-blogu-kristal-603';

update public.products set
  features='["Geleneksel ısı tutma/pres taşı olarak sunulur","Isıtma süresi ve yüzey sıcaklığı kullanım koşullarına göre değişir","Tıbbi tedavi amacıyla sunulmaz; sıcak yüzey temasında yanık riskine karşı dikkat edilmelidir"]'::jsonb,
  tags=array['Kültürel Kullanım','Isı Güvenliği'],
  updated_at=timezone('utc',now())
where slug='koyun-efsanevi-beyaz-isitma-pres-tasi-402';

update public.products set
  features='["Sütten kesilmiş oğlak eti","Kesim/parçalama seçeneği sipariş varyantına göre belirlenir","Soğuk zincir ve güvenli iç sıcaklık kurallarına uygun hazırlanmalıdır"]'::jsonb,
  tags=array['Gurme Seçim','Soğuk Zincir'],
  updated_at=timezone('utc',now())
where slug='fahrettin-in-sutten-kesilmis-oglagi-303';

update public.products set
  features='["Cam damacanada sunulan içme suyu","Kaynak, dolum ve analiz bilgileri satış öncesi doğrulanmalıdır","Mineral/pH değerleri yalnız doğrulanmış analiz raporuna dayanıyorsa gösterilir"]'::jsonb,
  tags=array['19L Cam','Analiz Belgesi Gerekli'],
  specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{pricePrefix}','"Cam Damacana"'::jsonb,true),
  updated_at=timezone('utc',now())
where slug='avasin-cam-damacana-suyu-401';

update public.products set
  features='["Geleneksel tarhana üretimi","Fermantasyon, içerik ve alerjen bilgileri etiketten doğrulanmalıdır","Kuru ve serin koşullarda, ambalaj kapalı tutulmalıdır"]'::jsonb,
  tags=array['Geleneksel Tarhana','İçerik Kontrolü'],
  updated_at=timezone('utc',now())
where slug='hatun-ana-nin-eksi-maya-gunesi-tarhana-501';

update public.products set
  features='["Tandır/odun isi karakteri taşıyan kuru üzüm","Kurutma ve paketleme bilgileri ürün kaydında belirtilir","İlave şeker iddiası yalnız içerik/etiket doğrulamasıyla gösterilir"]'::jsonb,
  tags=array['Kuru Üzüm','Odun İsli'],
  updated_at=timezone('utc',now())
where slug='isli-kaya-uzumleri-tane-kuru-506';

update public.products set
  features='["Odun ateşinde geleneksel pekmez üretimi","İçindekiler ve ilave şeker bilgisi etiketten doğrulanmalıdır","Serin ve kuru koşullarda, ambalaj kapalı saklanmalıdır"]'::jsonb,
  tags=array['Geleneksel Pekmez','İçerik Kontrolü'],
  updated_at=timezone('utc',now())
where slug='kadin-imecesi-odun-atesi-pekmezi-503';

update public.products set
  short_description='İri beyaz dutların geleneksel yöntemle kurutularak yoğun aroma ve gevrek doku kazandığı kuru meyve.',
  description='İri beyaz dutların geleneksel yöntemle kurutularak yoğun aroma ve gevrek doku kazandığı kuru meyve.',
  features='["Geleneksel dut hasadı ve kurutma","Kuru meyve olarak doğrudan veya tariflerde kullanılabilir","İçerik ve lot bilgileri ambalaj/ürün kaydından kontrol edilmelidir"]'::jsonb,
  tags=array['Kuru Dut','Geleneksel Kurutma'],
  specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{pricePrefix}','"Kuru Meyve"'::jsonb,true),
  updated_at=timezone('utc',now())
where slug='sami-usta-nin-kurutulmus-dag-dutlari-502';

update public.products set
  features='["Serin ortamda kurutulmuş dağ kekiği","Baharat, demleme veya marinasyon kullanımına uygundur","Kullanım miktarı ve içerik bilgileri ürün kaydından kontrol edilmelidir"]'::jsonb,
  tags=array['Dağ Kekiği','Marinasyon'],
  updated_at=timezone('utc',now())
where slug='zahter-harmani-dag-kekigi-507';

update public.products set
  features='["Geleneksel kurutulmuş yoğurt ürünü","Tuz, süt içeriği ve saklama koşulları ambalaj/ürün kaydından doğrulanmalıdır","Raf ömrü doğrulanmış lot/etiket bilgisi olmadan kesin süre olarak gösterilmez"]'::jsonb,
  tags=array['Kurutulmuş Süt Ürünü','Süt İçerir'],
  updated_at=timezone('utc',now())
where slug='kekik-aromali-kesik-yogurt-kurud-703';

update public.products set
  features='["Dağ kekiğinin distilasyonuyla elde edilen aromatik ürün","İçilebilir ürün statüsü, içerik ve üretim/hijyen belgeleri satış öncesi doğrulanmalıdır","Tıbbi veya antiseptik etki iddiası olarak sunulmaz"]'::jsonb,
  tags=array['Distile Ürün','Belge Kontrolü'],
  updated_at=timezone('utc',now())
where slug='ata-tohumu-dag-kekigi-suyu-distile-807';

update public.products set
  features='["Yabani kızılcık bazlı geleneksel şurup","İçindekiler, ilave şeker ve saklama koşulları etiketten doğrulanmalıdır","Hediyelik cam şişe seti"]'::jsonb,
  tags=array['Kızılcık Şurubu','İçerik Kontrolü'],
  updated_at=timezone('utc',now())
where slug='kan-kirmizi-yabani-kizilcik-surubu-seti-602';

update public.products set
  features='["Mevsimlik hasat iç yağ","Kavurma ve sıcak yemeklerde kullanıma yönelik hayvansal yağ","Soğuk zincirde taşınmalı ve gıda güvenliği koşullarında saklanmalıdır"]'::jsonb,
  tags=array['Hayvansal Yağ','Soğuk Zincir'],
  updated_at=timezone('utc',now())
where slug='gunes-sirri-guzu-yagi-ic-yag-701';

update public.products set
  features='["500 g kese satış birimi","Üretici ve köken kaydı ürün profilinde izlenir","İçerik, lot ve ambalaj bilgileri satış öncesi doğrulanır"]'::jsonb,
  tags=array['Tohum','Belge Kontrolü'],
  specifications=jsonb_set(coalesce(specifications,'{}'::jsonb),'{pricePrefix}','"500 g Kese"'::jsonb,true),
  updated_at=timezone('utc',now())
where slug='buyuk-iskender-corek-otu-tohumu-705';

-- Avoid unverified processing/biochemical claims in the flower honey record.
update public.products set
  features='["Bahar çiçek florasından bal profili","Kristalleşme doğal bal ürünlerinde görülebilir ve tek başına bozulma göstergesi değildir","Isıl işlem ve analiz bilgileri lot belgesiyle doğrulanmalıdır"]'::jsonb,
  tags=array['İlkbahar Hasadı','Çiçek Balı'],
  updated_at=timezone('utc',now())
where slug='bercelan-yaylasi-bahar-cicek-bali-102';