-- Test/demo catalog expansion requested for the Hakkâri / Yüksekova / Yeşiltaş storefront.
-- The eight additions are deliberately created as inactive drafts. This produces 50 managed product records
-- without bypassing the canonical product.publish + product-health + media integrity gates.
-- Season months and stories below are editable operational seed data, not immutable agricultural claims.

create or replace function private.seed_demo_product_option_schema_v1(p_slug text,p_name text,p_category_slug text)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare h text:=lower(coalesce(p_slug,'')||' '||coalesce(p_name,'')||' '||coalesce(p_category_slug,''));
begin
  if h like '%kuzu%' or h like '%oğlak%' or h like '%oglak%' then
    return '[{"key":"preparation","label":"Hazırlama şekli","required":true,"choices":[{"value":"whole","label":"Bütün karkas"},{"value":"butchered","label":"Kasap usulü parçalanmış"}]},{"key":"cutStyle","label":"Parçalama stili","required":true,"visibleWhen":{"key":"preparation","equals":"butchered"},"choices":[{"value":"balanced","label":"Dengeli kasap kesimi"},{"value":"grill","label":"Izgaralık ağırlıklı"},{"value":"stew","label":"Tencerelik ağırlıklı"}]},{"key":"offal","label":"Sakatat tercihi","required":true,"choices":[{"value":"included","label":"Dahil et"},{"value":"separate","label":"Ayrı paketle"},{"value":"none","label":"İstemiyorum"}]},{"key":"packaging","label":"Paket düzeni","required":true,"choices":[{"value":"by_cut","label":"Parça bazlı paket"},{"value":"family_1kg","label":"Yaklaşık 1 kg aile paketleri"},{"value":"large_2kg","label":"Yaklaşık 2 kg büyük paketler"}]}]'::jsonb;
  elsif h like '%alabal%' or h like '%balık%' or h like '%balik%' then
    return '[{"key":"catchPlan","label":"Av planı","required":true,"choices":[{"value":"daily_catch","label":"Günlük av uygunsa ayır"},{"value":"catch_to_order","label":"Sipariş üzerine av planla"}]},{"key":"cleaning","label":"Temizleme","required":true,"choices":[{"value":"whole","label":"Bütün"},{"value":"cleaned","label":"Temizlenmiş"},{"value":"fillet","label":"Fileto"}]},{"key":"packaging","label":"Soğuk paketleme","required":true,"choices":[{"value":"whole_cold","label":"Bütün soğuk paket"},{"value":"portioned_cold","label":"Porsiyonlu soğuk paket"}]}]'::jsonb;
  elsif h like '%yumurta%' then
    return '[{"key":"selection","label":"Seçim düzeni","required":true,"choices":[{"value":"uniform","label":"Mümkün olduğunca benzer boy"},{"value":"natural_mix","label":"Doğal karışık boy"}]},{"key":"protection","label":"Kutu koruması","required":true,"choices":[{"value":"standard","label":"Standart korumalı kutu"},{"value":"extra","label":"Ek darbe koruması"}]}]'::jsonb;
  elsif h like '%horoz%' then
    return '[{"key":"preparation","label":"Hazırlama","required":true,"choices":[{"value":"whole_cleaned","label":"Bütün temizlenmiş"},{"value":"portioned","label":"Parçalanmış"}]},{"key":"offal","label":"Sakatat","required":true,"choices":[{"value":"separate","label":"Ayrı paketle"},{"value":"none","label":"İstemiyorum"}]},{"key":"packaging","label":"Paketleme","required":true,"choices":[{"value":"single","label":"Tek paket"},{"value":"meal_portions","label":"Öğünlük paketler"}]}]'::jsonb;
  elsif h like '%süt%' or h like '%sut%' or h like '%ayran%' then
    return '[{"key":"deliveryPreference","label":"Teslimat tercihi","required":true,"choices":[{"value":"earliest","label":"Mümkün olan en erken teslimat"},{"value":"planned","label":"Planlı teslimat penceresi"}]},{"key":"bottleHandling","label":"Şişe düzeni","required":true,"choices":[{"value":"standard","label":"Standart korumalı taşıma"},{"value":"extra_protected","label":"Ek korumalı taşıma"}]}]'::jsonb;
  elsif h like '%peynir%' or h like '%yoğurt%' or h like '%yogurt%' or h like '%tereyağ%' or h like '%tereyag%' or h like '%kurud%' then
    return '[{"key":"portioning","label":"Porsiyonlama","required":true,"choices":[{"value":"whole","label":"Tek parça"},{"value":"kitchen_portions","label":"Mutfaklık küçük porsiyonlar"}]},{"key":"packaging","label":"Paketleme","required":true,"choices":[{"value":"standard","label":"Standart korumalı paket"},{"value":"vacuum_portions","label":"Porsiyonlu vakum paket"}]}]'::jsonb;
  elsif h like '%mantar%' then
    return '[{"key":"selection","label":"Boy seçimi","required":true,"choices":[{"value":"large_whole","label":"İri ve bütün ağırlıklı"},{"value":"mixed","label":"Karışık boy"}]},{"key":"packaging","label":"Paketleme","required":true,"choices":[{"value":"single_pack","label":"Tek paket"},{"value":"small_portions","label":"Küçük porsiyon paketleri"}]}]'::jsonb;
  elsif h like '%ekmek%' then
    return '[{"key":"slicing","label":"Dilimleme","required":true,"choices":[{"value":"whole","label":"Bütün kalsın"},{"value":"sliced","label":"Dilimlensin"}]},{"key":"packaging","label":"Paketleme","required":true,"choices":[{"value":"paper","label":"Kâğıt ağırlıklı paket"},{"value":"travel_protected","label":"Yolculuk için ek koruma"}]}]'::jsonb;
  elsif h like '%ceviz%' or h like '%badem%' or h like '%çekirdek%' or h like '%tohum%' or h like '%polen%' or h like '%propolis%' then
    return '[{"key":"sorting","label":"Ayıklama tercihi","required":true,"choices":[{"value":"standard","label":"Standart temiz ayıklama"},{"value":"large_first","label":"İri taneler öncelikli"}]},{"key":"packaging","label":"Paket düzeni","required":true,"choices":[{"value":"single","label":"Tek paket"},{"value":"split","label":"İki kullanım paketi"}]}]'::jsonb;
  elsif h like '%bal%' then
    return '[{"key":"presentation","label":"Sunum tercihi","required":true,"choices":[{"value":"natural","label":"Doğal haliyle"},{"value":"gift_ready","label":"Hediyeye uygun dış paket"}]},{"key":"jarProtection","label":"Kavanoz / petek koruması","required":true,"choices":[{"value":"standard","label":"Standart koruma"},{"value":"extra","label":"Ek taşıma koruması"}]}]'::jsonb;
  elsif p_category_slug='meyve-sebze' then
    return '[{"key":"ripeness","label":"Olgunluk tercihi","required":true,"choices":[{"value":"table_ready","label":"Sofraya hazır olgunluk"},{"value":"firm","label":"Biraz daha diri, yola dayanıklı"}]},{"key":"packing","label":"Kasa düzeni","required":true,"choices":[{"value":"standard","label":"Standart seçme ve ayıklama"},{"value":"single_layer","label":"Mümkün olduğunca tek kat koruma"}]}]'::jsonb;
  elsif p_category_slug='kiler' then
    return '[{"key":"texture","label":"Hazırlama tercihi","required":true,"choices":[{"value":"traditional","label":"Geleneksel haliyle"},{"value":"easy_use","label":"Mutfakta kolay kullanım için ayrılmış"}]},{"key":"packaging","label":"Paket düzeni","required":true,"choices":[{"value":"single","label":"Tek paket"},{"value":"split","label":"İki kullanım paketi"}]}]'::jsonb;
  elsif p_category_slug in ('yoresel-icecekler','icecekler-su') then
    return '[{"key":"bottleProtection","label":"Şişe koruması","required":true,"choices":[{"value":"standard","label":"Standart korumalı koli"},{"value":"extra","label":"Ek darbe koruması"}]},{"key":"servingPlan","label":"Kullanım düzeni","required":true,"choices":[{"value":"single_batch","label":"Tek parti"},{"value":"split_pack","label":"Bölünmüş paket düzeni"}]}]'::jsonb;
  elsif p_category_slug='dogal-tas-enerji' then
    return '[{"key":"finish","label":"Yüzey / hazırlama","required":true,"choices":[{"value":"natural","label":"Doğal yüzey mümkün olduğunca korunsun"},{"value":"smoothed","label":"Kullanım yüzeyi daha düzgün hazırlansın"}]},{"key":"packing","label":"Taşıma koruması","required":true,"choices":[{"value":"standard","label":"Standart koruma"},{"value":"reinforced","label":"Güçlendirilmiş taşıma koruması"}]}]'::jsonb;
  else
    return '[{"key":"selection","label":"Ürün seçimi","required":true,"choices":[{"value":"standard","label":"Standart seçme ve ayıklama"},{"value":"premium_condition","label":"Görsel bütünlüğü yüksek parçalar öncelikli"}]},{"key":"packing","label":"Paketleme","required":true,"choices":[{"value":"standard","label":"Standart paket"},{"value":"extra_protected","label":"Ek korumalı paket"}]}]'::jsonb;
  end if;
end;
$$;

with seed(slug,legacy_id,name,category_slug,short_description,story,unit_label,price_minor,stock_mode,weight_grams,is_perishable) as (
 values
 ('yuksekova-sonbahar-armudu-901','901','Yüksekova Sonbahar Armudu','meyve-sebze','Yüksek rakım sonbaharını temsil eden, gerçek üretici doğrulamasına açık demo armut kaydı.','Yüksekova Sonbahar Armudu bu test kataloğunda Yeşiltaş ve Yüksekova coğrafyasının sonbahar meyveciliğini temsil etmek için hazırlanmıştır. Köyde armut toplama günü yalnız takvime bakılarak seçilmez; sapın daldan ayrılma biçimi, meyvenin diriliği, gece serinliği ve yolculuğa dayanım birlikte değerlendirilir. Sofraya hazır isteyen müşteri daha olgun, uzak teslimat isteyen müşteri daha diri seçim isteyebilir. Kasaya girecek meyveler ezik, çatlak ve aşırı yumuşak olanlardan ayrılır; amaç her parçayı aynı biçime sokmak değil doğal farklılığı korurken taşıma kaybını azaltmaktır. Bu hikâye, fiyat ve Eylül-Ekim sezon penceresi tamamen demo verisidir; gerçek bahçe, üretici ve o yılın iklim koşulları doğrulandığında admin panelinden değiştirilmeden ürün yayınlanmamalıdır.','1 kg',16500,'seasonal',1000,true),
 ('hakkari-dag-erigi-902','902','Hakkâri Dağ Eriği','meyve-sebze','Yaz sonunu temsil eden ekşi-tatlı karakterli demo dağ eriği kaydı.','Hakkâri Dağ Eriği küçük ve hassas bir meyve olduğu için toplama ile paketleme arasında gereksiz bekleme bırakılmaması gereken bir demo ürün olarak kurgulandı. Üretici, güneş görmüş fakat ezilmemiş taneleri ayırırken renk kadar kabuk direncine, sap çevresindeki yumuşamaya ve yolculuğa dayanımına bakar. Müşteri sofraya hazır olgunluk ya da biraz daha diri seçim isteyebilir; paketleme sırasında kasaların üst üste baskı oluşturmaması ve meyvelerin savrulmaması gözetilir. Ağustos-Eylül aralığı Hakkâri meyveciliği ve bölgesel iklim üzerinden oluşturulmuş test penceresidir. Gerçek hasat haftası, çeşit, üretici ve bahçe bilgisi doğrulanmadan bu ürün müşteri kataloğunda yayınlanmamalı; bütün alanlar admin çalışma alanından güncellenmelidir.','1 kg',14500,'seasonal',1000,true),
 ('yuksekova-yayla-kayisisi-903','903','Yüksekova Yayla Kayısısı','meyve-sebze','Kısa yüksek rakım yazını temsil eden küçük parti demo kayısı ürünü.','Yüksekova Yayla Kayısısı test kataloğunda kısa yüksek rakım yazının meyveye bıraktığı karakteri anlatmak için yer alır. Kayısı hızlı yumuşadığı için toplama anında çatlak, ezik ve fazla olgun taneler ayrılır; yola çıkacak partide daha diri meyveler tercih edilir. Ürün küçük kasalarda sıkıştırılmadan tutulur ve müşteri sofraya hazır ya da daha dayanıklı olgunluk seçimini sipariş sırasında belirleyebilir. Amaç kusursuz biçimli meyve iddiası üretmek değil, mevsimin doğal farklarını koruyarak taşıma kaybını azaltmaktır. Temmuz-Ağustos penceresi demo tahminidir; gerçek bahçe, rakım, çeşit ve o yılın hava koşulları üretici tarafından doğrulandığında admin panelinden güncellenecek, ürün ancak yayın yönetişim kontrolleri tamamlandıktan sonra müşteriye açılacaktır.','1 kg',18000,'seasonal',1000,true),
 ('yuksekova-yaz-hiyari-904','904','Yüksekova Yaz Hıyarı','meyve-sebze','Yüksekova yaz sebzeciliğini temsil eden çıtır demo hıyar kaydı.','Yüksekova Yaz Hıyarı bölgedeki yaz sebzeciliği verilerine dayanarak test kataloğuna eklenmiştir. Sabah serinliğinde toplanan hıyarın yüzeyi, sapı ve diriliği kontrol edilir; yumuşamış, zedelenmiş veya taşıma sırasında kolay kırılacak olanlar ayrılır. Müşteri daha diri yolculuk seçimi ya da sofraya hazır seçim isteyebilir. Paketleme sırasında ürünün terleme yapmaması, ağır ürünlerin altında ezilmemesi ve kasada gereksiz boşlukla savrulmaması gözetilir. Temmuz-Eylül yoğun sezonu yalnız operasyonel demo verisidir. Gerçek üretici, tarla, çeşit ve haftalık hasat planı kesinleştiğinde admin panelinden güncellenecek; taslak kayıt ürün-sağlık ve yayın onayı tamamlanmadan müşteri satışına çıkmayacaktır.','1 kg',9500,'seasonal',1000,true),
 ('hakkari-yayla-karpuzu-905','905','Hakkâri Yayla Karpuzu','meyve-sebze','Hakkâri tarım profilindeki karpuz üretimini temsil eden yaz sonu demo ürünü.','Hakkâri Yayla Karpuzu il tarım profilinde yer alan karpuz üretimini test kataloğunda temsil eder. Karpuz seçimi yalnız büyüklük üzerinden yapılmaz; kabuk bütünlüğü, sap durumu, taşıma sırasında çatlama riski ve ürünün elde verdiği ağırlık hissi birlikte değerlendirilir. Siparişe ayrılan ürünler darbe almayacak biçimde tek tek yerleştirilir ve ağır ürün olduğu için koli düzeni diğer meyvelerden farklı planlanır. Müşteri sofraya daha yakın olgunluk ya da daha diri yolculuk tercihini seçebilir. Ağustos-Eylül dönemi burada yalnız demo operasyon penceresidir. Gerçek tarla, çeşit, üretici ve yıllık sıcaklık koşulları doğrulanmadan ürün yayınlanmayacak; kesin satış penceresi Super Admin tarafından doğrulandığında hatırlatma akışı devreye girecektir.','adet',26000,'seasonal',5000,true),
 ('yuksekova-yayla-poleni-906','906','Yüksekova Yayla Poleni','bal-sifa','Yüksekova arıcılığını tamamlayan, yeni sezonu ilkbahar-yaz döneminde kurgulanan demo polen kaydı.','Yüksekova Yayla Poleni, Hakkâri arıcılığında bal dışındaki arı ürünlerinin geliştirilmesine yönelik resmi çalışmalar dikkate alınarak oluşturulmuş bir demo katalog ürünüdür. Polen toplama zamanı çiçeklenme, arılığın gücü, hava ve nem durumuna göre değişebildiği için sabit bir gün vaat edilmez. Toplanan ürün yabancı materyal ve nem açısından dikkatle ayrılır, küçük partiler halinde saklanır ve paketlenir. Yeni parti oluşumu ilkbahar-yaz döneminde yoğunlaşabilir; uygun koşullarda saklanan doğrulanmış parti daha sonra da satışta kalabilir. Mayıs-Ağustos notu test amaçlıdır. Gerçek arıcı, analiz, saklama koşulu ve parti kayıtları doğrulanmadan sağlık veya kalite iddiası eklenmeyecek ve ürün yayınlanmayacaktır.','250 g paket',24000,'tracked',250,false),
 ('hakkari-ham-propolisi-907','907','Hakkâri Ham Propolisi','bal-sifa','Hakkâri arıcılığındaki katma değerli arı ürünlerini temsil eden demo ham propolis kaydı.','Hakkâri Ham Propolisi, bölgedeki arıcılık çalışmalarında propolis üretiminin geliştirilmesine verilen önemden hareketle test kataloğuna eklenmiştir. Kovandan gelen ham materyal doğrudan sağlık vaadiyle sunulmaz; yabancı parçaların ayrılması, parti kaydının tutulması, saklama koşulunun belirlenmesi ve müşteriye kullanım bilgisinin açık biçimde verilmesi gerekir. İlkbahar ve yaz arılık faaliyetleri yeni parti oluşumunun yoğun olduğu dönem olarak ele alınabilir; uygun şekilde hazırlanmış mevcut parti stokta daha uzun süre kalabilir. Buradaki Mayıs-Ağustos penceresi, fiyat, paket miktarı ve hikâye demo verisidir. Gerçek arıcı, laboratuvar veya ürün doğrulama kayıtları tamamlanmadan bu taslak müşteri kataloğuna yayınlanmayacaktır.','100 g paket',32000,'tracked',100,false),
 ('tas-degirmen-yuksekova-bulguru-908','908','Taş Değirmen Yüksekova Bulguru','kiler','Hakkâri tahıl üretimini kiler kategorisine bağlayan demo bulgur kaydı.','Taş Değirmen Yüksekova Bulguru, Hakkâri tarım profilinde yer alan buğday üretimini kiler seçkisine bağlamak amacıyla oluşturulmuş demo üründür. Hasat sonrası temizlenen tahılın yabancı materyali ayrılır, kuruluk durumu kontrol edilir ve küçük partiler halinde işlenmesi planlanır. Müşteri geleneksel haliyle tek paket ya da kullanım kolaylığı için iki pakete ayrılmış düzeni seçebilir. Ürün yeni hasat döneminde tazelenebilir ancak kuru kiler ürünü olduğu için uygun stok ve nem yönetimiyle yıl boyunca satışa sunulması mümkündür. Taş değirmen yöntemi, çeşit, üretici, fiyat ve işleme ayrıntıları şu an test anlatısıdır. Gerçek değirmen ve parti verisi geldiğinde admin panelinden doğrulanacak, yayın onayı tamamlanmadan müşteri kataloğuna açılmayacaktır.','1 kg paket',11000,'tracked',1000,false)
), producer as (
 select id from public.producers where store_kind='official' and slug='golden-oremar' and status='active' and is_verified=true and deleted_at is null limit 1
), inserted as (
 insert into public.products(
   legacy_source,legacy_id,producer_id,category_id,slug,name,short_description,description,story,origin,unit_label,
   base_price_minor,currency,tax_rate_basis_points,status,stock_mode,tags,features,specifications,translations,seo,
   is_featured,is_active,published_at,export_status,country_of_origin_code,is_perishable,requires_cold_chain,search_text
 )
 select 'demo-hakkari-50-v1',s.legacy_id,producer.id,c.id,s.slug,s.name,s.short_description,s.short_description,s.story,
   'Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',s.unit_label,s.price_minor,'TRY',0,'draft',s.stock_mode,
   array['Golden Oremar Demo','Hakkâri/Yüksekova'],jsonb_build_array('Demo katalog ürünü','Mevsim ve seçenekler admin tarafından güncellenebilir'),
   jsonb_build_object('catalogSeed','hakkari-50-demo-v1','verificationStatus','demo_pending_real_source'),
   '{}'::jsonb,jsonb_build_object('title',s.name,'description',s.short_description),false,false,null,'not_configured','TR',s.is_perishable,false,
   lower(s.name||' Hakkâri Yüksekova Yeşiltaş')
 from seed s join public.categories c on c.slug=s.category_slug cross join producer
 where not exists(select 1 from public.products p where p.slug=s.slug)
 returning id,slug,legacy_id,base_price_minor,stock_mode
)
insert into public.product_provenance(
  product_id,seller_model,source_mode,source_producer_id,source_display_name,country_code,province,district,village,locality_detail,
  origin_label,origin_verified,organic_claim,public_note
)
select i.id,'official_store','platform_village_catalog',p.id,'Golden Oremar Demo Köy Kataloğu','TR','Hakkâri','Yüksekova','Yeşiltaş','Dağlıca',
  'Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',false,'not_claimed',
  'Test/demo kaynak kaydıdır. Gerçek üretici, koordinat ve parti doğrulaması yayın öncesinde tamamlanmalıdır.'
from inserted i cross join producer p
on conflict(product_id) do nothing;

with rows as (
 select p.id,p.legacy_id,p.base_price_minor,p.stock_mode,
   case p.slug when 'hakkari-yayla-karpuzu-905' then 5000 when 'yuksekova-yayla-poleni-906' then 250 when 'hakkari-ham-propolisi-907' then 100 else 1000 end weight_grams
 from public.products p where p.legacy_source='demo-hakkari-50-v1' and p.deleted_at is null
), inserted_variants as (
 insert into public.product_variants(product_id,sku,name,option_values,price_minor,weight_grams,is_default,is_active,shipping_weight_source,shipping_weight_note)
 select r.id,'GO-DEMO-'||r.legacy_id,'Standart','{}'::jsonb,r.base_price_minor,r.weight_grams,true,true,'estimated','Demo katalog ağırlığı; gerçek paketleme ölçümüyle güncellenecek.'
 from rows r where not exists(select 1 from public.product_variants v where v.product_id=r.id)
 returning id,product_id
)
insert into public.product_inventory(variant_id,available_quantity,reserved_quantity,reorder_level,version)
select v.id,0,0,5,1 from inserted_variants v
on conflict(variant_id) do nothing;

-- Create one canonical preparation/season profile for every existing live product and each of the eight demo drafts.
with candidates as (
 select p.*,c.slug category_slug,
  case
   when p.slug like '%kuzu-gobegi%' then 'seasonal'
   when p.slug like '%cagla%' or p.slug like '%cilek%' or p.slug like '%domates%' or p.slug like '%elmasi%' or p.slug like '%cevizi%' or p.slug like '%armudu%' or p.slug like '%erigi%' or p.slug like '%kayisisi%' or p.slug like '%hiyari%' or p.slug like '%karpuzu%' then 'seasonal'
   when p.stock_mode='preorder' then 'made_to_order'
   else 'year_round' end season_mode,
  case
   when p.slug like '%kuzu-gobegi%' then 4 when p.slug like '%cagla%' then 4 when p.slug like '%cilek%' then 6
   when p.slug like '%domates%' then 7 when p.slug like '%elmasi%' then 10 when p.slug like '%cevizi%' then 10
   when p.slug like '%armudu%' then 9 when p.slug like '%erigi%' then 8 when p.slug like '%kayisisi%' then 7
   when p.slug like '%hiyari%' then 7 when p.slug like '%karpuzu%' then 8 when p.slug like '%otlu-dag-peyniri%' then 6
   when p.slug like '%poleni%' or p.slug like '%propolis%' then 5 when c.slug='bal-sifa' then 6 else null end season_start,
  case
   when p.slug like '%kuzu-gobegi%' then 6 when p.slug like '%cagla%' then 5 when p.slug like '%cilek%' then 8
   when p.slug like '%domates%' then 9 when p.slug like '%elmasi%' then 10 when p.slug like '%cevizi%' then 10
   when p.slug like '%armudu%' then 10 when p.slug like '%erigi%' then 9 when p.slug like '%kayisisi%' then 8
   when p.slug like '%hiyari%' then 9 when p.slug like '%karpuzu%' then 9 when p.slug like '%otlu-dag-peyniri%' then 7
   when p.slug like '%poleni%' or p.slug like '%propolis%' then 8 when c.slug='bal-sifa' then 9 else null end season_end
 from public.products p join public.categories c on c.id=p.category_id
 where p.deleted_at is null and ((p.status='published' and p.is_active=true) or p.legacy_source='demo-hakkari-50-v1')
)
insert into public.product_commerce_profiles(
 product_id,option_schema,seasonality_mode,season_start_month,season_end_month,preorder_enabled,
 preparation_days_min,preparation_days_max,customer_season_note,research_basis,research_source_label
)
select p.id,private.normalize_product_option_schema_v1(private.seed_demo_product_option_schema_v1(p.slug,p.name,p.category_slug)),
 p.season_mode,p.season_start,p.season_end,(p.stock_mode='preorder' or p.season_mode='seasonal'),
 case when p.stock_mode='preorder' or p.season_mode='seasonal' then greatest(1,coalesce(p.preorder_lead_days,2)) else 0 end,
 case when p.stock_mode='preorder' or p.season_mode='seasonal' then greatest(2,coalesce(p.preorder_lead_days,5)) else 2 end,
 case
  when p.slug like '%otlu-dag-peyniri%' then 'Yeni sezon üretimi Haziran-Temmuz döneminde yoğunlaşır; stoktaki olgunlaştırılmış parti ayrıca satışta kalabilir.'
  when p.slug like '%cevizi%' then 'Yüksekova ceviz hasadı sonbaharda yoğunlaşır. Mevcut kuru parti stok durumuna göre yıl içinde satışta kalabilir.'
  when p.slug like '%elmasi%' then 'Yüksekova elma hasadı sonbaharda yoğunlaşır. Kesin hafta bahçe ve yılın hava koşullarına göre güncellenir.'
  when p.slug like '%kuzu-gobegi%' then 'Kısa ilkbahar sezonu olan hassas bir üründür; sipariş penceresi saha koşullarına göre açılır.'
  when p.slug like '%cagla%' then 'İlkbaharda kısa bir taze ürün penceresi vardır.'
  when p.slug like '%cilek%' then 'Yeni sezon yaz aylarında yoğunlaşır; gerçek toplama haftası saha koşullarına bağlıdır.'
  when p.slug like '%domates%' or p.slug like '%hiyari%' then 'Yüksekova yaz sebzeciliği için Temmuz-Eylül demo yoğun sezonudur; gerçek dönem üretici tarafından doğrulanır.'
  when p.slug like '%karpuzu%' then 'Yaz sonu demo sezonu Ağustos-Eylül olarak planlanmıştır; gerçek tarla takvimi doğrulanacaktır.'
  when p.slug like '%armudu%' then 'Sonbahar demo hasat penceresi Eylül-Ekim olarak planlanmıştır.'
  when p.slug like '%erigi%' then 'Yaz sonu demo hasat penceresi Ağustos-Eylül olarak planlanmıştır.'
  when p.slug like '%kayisisi%' then 'Kısa yaz demo hasat penceresi Temmuz-Ağustos olarak planlanmıştır.'
  when p.slug like '%poleni%' or p.slug like '%propolis%' then 'Yeni parti ilkbahar-yaz arıcılık döneminde oluşur; uygun hazırlanmış stok yıl boyunca satışta kalabilir.'
  when p.category_slug='bal-sifa' then 'Arılık ve çiçeklenmeye bağlı yeni sezon yaz döneminde yoğunlaşır; kesin hasat tarihi ürün tipine ve o yıla göre değişir.'
  when p.stock_mode='preorder' then 'Hazır stoktan değil, sipariş ve üretim koşullarına göre hazırlanır. Kesin tarih satış penceresinde gösterilir.'
  else 'Bu ürün yıl boyunca stok durumuna göre satışa sunulabilir; yeni sezon bilgisi varsa ayrıca gösterilir.' end,
 'Hakkâri/Yüksekova için demo operasyon takvimi. Gerçek üretici, saha ve parti verisi geldiğinde admin tarafından güncellenmelidir.',
 case
  when p.slug like '%otlu-dag-peyniri%' then 'Türkiye Geleneksel Peynir Envanteri - Hakkâri Otlu Peyniri'
  when p.slug like '%cevizi%' then 'Yüksekova ceviz hasadı saha/haber kaydı'
  when p.slug like '%elmasi%' then 'Yüksekova elma hasadı ve Hakkâri tarım yatırım rehberi'
  when p.slug like '%poleni%' or p.slug like '%propolis%' or p.category_slug='bal-sifa' then 'Hakkâri İl Tarım ve Orman Müdürlüğü arıcılık çalışmaları'
  else 'Hakkâri İl Tarım ve Orman Müdürlüğü il tarım profili / yatırım rehberi' end
from candidates p
on conflict(product_id) do update set
 option_schema=excluded.option_schema,seasonality_mode=excluded.seasonality_mode,season_start_month=excluded.season_start_month,
 season_end_month=excluded.season_end_month,preorder_enabled=excluded.preorder_enabled,preparation_days_min=excluded.preparation_days_min,
 preparation_days_max=excluded.preparation_days_max,customer_season_note=excluded.customer_season_note,research_basis=excluded.research_basis,
 research_source_label=excluded.research_source_label,updated_at=timezone('utc',now());

-- Planning windows are all unconfirmed. They cannot gate buying or emit notifications until a product.approve user confirms real dates.
insert into public.product_sales_windows(
 product_id,season_year,preorder_opens_at,preorder_closes_at,fulfillment_starts_at,fulfillment_ends_at,status,is_confirmed,public_note,internal_note
)
select p.id,2027,
 make_timestamptz(2027,coalesce(profile.season_start_month,4),1,6,0,0,'Europe/Istanbul')-interval '21 days',
 make_timestamptz(2027,coalesce(profile.season_end_month,10),28,20,0,0,'Europe/Istanbul'),
 make_timestamptz(2027,coalesce(profile.season_start_month,4),1,6,0,0,'Europe/Istanbul'),
 make_timestamptz(2027,coalesce(profile.season_end_month,10),28,20,0,0,'Europe/Istanbul')+make_interval(days=>coalesce(profile.preparation_days_max,5)),
 'scheduled',false,'Tahmini sezon planıdır. Kesin tarih üretici doğrulamasından sonra açılır.',
 'Demo planning window. Must be confirmed by Super Admin before notifications or server-side sales gating.'
from public.products p join public.product_commerce_profiles profile on profile.product_id=p.id
where p.deleted_at is null and profile.preorder_enabled=true
on conflict(product_id,season_year) do nothing;

drop function private.seed_demo_product_option_schema_v1(text,text,text);
