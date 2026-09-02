-- Test/demo catalog expansion requested for the Hakkari / Yüksekova / Yeşiltaş storefront.
-- These eight additions and season months are editable operational seed data, not immutable agricultural claims.
-- Research basis: Hakkari Provincial Agriculture Directorate crop/livestock profile, 2025 agricultural investment guide,
-- official Hakkari herbed-cheese inventory and Yüksekova apple/walnut harvest reporting.

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
  elsif h like '%bal%' then
    return '[{"key":"presentation","label":"Sunum tercihi","required":true,"choices":[{"value":"natural","label":"Doğal haliyle"},{"value":"gift_ready","label":"Hediyeye uygun dış paket"}]},{"key":"jarProtection","label":"Kavanoz / petek koruması","required":true,"choices":[{"value":"standard","label":"Standart koruma"},{"value":"extra","label":"Ek taşıma koruması"}]}]'::jsonb;
  elsif h like '%mantar%' then
    return '[{"key":"selection","label":"Boy seçimi","required":true,"choices":[{"value":"large_whole","label":"İri ve bütün ağırlıklı"},{"value":"mixed","label":"Karışık boy"}]},{"key":"packaging","label":"Paketleme","required":true,"choices":[{"value":"single_pack","label":"Tek paket"},{"value":"small_portions","label":"Küçük porsiyon paketleri"}]}]'::jsonb;
  elsif h like '%ekmek%' then
    return '[{"key":"slicing","label":"Dilimleme","required":true,"choices":[{"value":"whole","label":"Bütün kalsın"},{"value":"sliced","label":"Dilimlensin"}]},{"key":"packaging","label":"Paketleme","required":true,"choices":[{"value":"paper","label":"Kâğıt ağırlıklı paket"},{"value":"travel_protected","label":"Yolculuk için ek koruma"}]}]'::jsonb;
  elsif p_category_slug='meyve-sebze' then
    return '[{"key":"ripeness","label":"Olgunluk tercihi","required":true,"choices":[{"value":"table_ready","label":"Sofraya hazır olgunluk"},{"value":"firm","label":"Biraz daha diri, yola dayanıklı"}]},{"key":"packing","label":"Kasa düzeni","required":true,"choices":[{"value":"standard","label":"Standart seçme ve ayıklama"},{"value":"single_layer","label":"Mümkün olduğunca tek kat koruma"}]}]'::jsonb;
  elsif h like '%ceviz%' or h like '%badem%' or h like '%çekirdek%' or h like '%tohum%' or h like '%polen%' or h like '%propolis%' then
    return '[{"key":"sorting","label":"Ayıklama tercihi","required":true,"choices":[{"value":"standard","label":"Standart temiz ayıklama"},{"value":"large_first","label":"İri taneler öncelikli"}]},{"key":"packaging","label":"Paket düzeni","required":true,"choices":[{"value":"single","label":"Tek paket"},{"value":"split","label":"İki kullanım paketi"}]}]'::jsonb;
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

-- Eight local-fit demo additions. Insert only when the slug is absent.
with seed(slug,legacy_id,name,category_slug,short_description,story,unit_label,price_minor,stock_mode,lead_days,weight_grams,is_perishable) as (
 values
 ('yuksekova-sonbahar-armudu-901','901','Yüksekova Sonbahar Armudu','meyve-sebze','Yüksek rakımda sonbahara doğru olgunlaşan, demo katalog için seçilmiş yerel armut ürünü.','Yüksekova Sonbahar Armudu için bu anlatı test kataloğunda Yeşiltaş ve Yüksekova coğrafyasını temsil etmek üzere hazırlanmıştır. Köyde armut toplama günü yalnız takvime bakılarak seçilmez; sapın daldan ayrılma biçimi, meyvenin diriliği ve gece serinliğinin bıraktığı doku birlikte okunur. Yolculukta ezilmeyecek ama sofraya ulaştığında aromasını gösterecek meyveler tek tek ayrılır. Kasaya giren her armut aynı boyda olmak zorunda değildir; önemli olan çürük, darbe ve aşırı yumuşama riskini elemek, doğal farklılığı korumaktır. Bu sezon ve hazırlama bilgileri demo amaçlıdır; gerçek üretici takvimi daha sonra admin panelinden doğrulanıp güncellenecektir.','1 kg',16500,'seasonal',null,1000,true),
 ('hakkari-dag-erigi-902','902','Hakkâri Dağ Eriği','meyve-sebze','Yaz sonuna doğru olgunlaşan, ekşi-tatlı dengesiyle öne çıkan demo dağ eriği seçkisi.','Hakkâri Dağ Eriği küçük ve hassas bir meyve olduğu için toplama ile paketleme arasında uzun bekleme bırakılmaması gereken bir demo ürün olarak kurgulandı. Üretici, güneş görmüş ama ezilmemiş taneleri ayırırken renk kadar kabuk direncine ve sap çevresindeki yumuşamaya da bakar. Sofraya hazır isteyen müşteri daha olgun, yolculuk dayanımı isteyen müşteri daha diri seçim isteyebilir. Kasalar üst üste baskı oluşturmayacak şekilde düzenlenir. Buradaki mevsim penceresi Hakkâri meyveciliği ve bölgesel iklim üzerinden oluşturulmuş test verisidir; gerçek hasat haftaları üretici ve saha doğrulamasıyla admin panelinden değiştirilecektir.','1 kg',14500,'seasonal',null,1000,true),
 ('yuksekova-yayla-kayisisi-903','903','Yüksekova Yayla Kayısısı','meyve-sebze','Kısa yaz döneminde olgunlaşan, küçük parti demo yayla kayısısı.','Yüksekova Yayla Kayısısı demo kataloğunda kısa yüksek rakım yazının meyveye bıraktığı karakteri anlatmak için yer alır. Kayısı hızlı yumuşadığı için toplama anında çatlak, ezik ve fazla olgun taneler ayrılır; yola çıkacak olanların daha diri olması tercih edilir. Ürün küçük kasalarda sıkıştırılmadan tutulur ve müşteri sofraya hazır ya da daha dayanıklı olgunluk seçimini sipariş sırasında belirleyebilir. Amaç kusursuz biçimli meyve üretmek değil, mevsimin doğal farklarını koruyarak taşıma kaybını azaltmaktır. Takvim demo tahminidir ve gerçek bahçe, rakım ve o yılın hava koşullarına göre yönetim panelinden güncellenecektir.','1 kg',18000,'seasonal',null,1000,true),
 ('yuksekova-yaz-hiyari-904','904','Yüksekova Yaz Hıyarı','meyve-sebze','Yüksekova yaz sebzeciliğini temsil eden çıtır demo hıyar ürünü.','Yüksekova Yaz Hıyarı bölgedeki yaz sebzeciliği verilerine dayanarak test kataloğuna eklenmiştir. Sabah serinliğinde toplanan hıyarın yüzeyi, sapı ve diriliği kontrol edilir; yumuşamış veya taşıma sırasında kolayca kırılacak olanlar ayrılır. Müşteri daha diri yolculuk seçimi ya da sofraya hazır seçim isteyebilir. Paketleme sırasında ürünün terleme yapmaması, ağır ürünlerin altında ezilmemesi ve kasada gereksiz boşlukla savrulmaması gözetilir. Bu anlatı ve Temmuz-Eylül yoğun sezonu operasyonel demo verisidir; gerçek üretici kaydı oluşturulduğunda saha takvimi ve çeşit bilgisi admin tarafından değiştirilecektir.','1 kg',9500,'seasonal',null,1000,true),
 ('hakkari-yayla-karpuzu-905','905','Hakkâri Yayla Karpuzu','meyve-sebze','Bölgedeki karpuz üretimini temsil eden yaz sonu demo yayla karpuzu.','Hakkâri Yayla Karpuzu test kataloğunda il tarım profilinde yer alan karpuz üretimini temsil eder. Karpuz seçimi yalnız büyüklükle yapılmaz; kabuk bütünlüğü, sap durumu ve taşıma sırasında çatlama riski birlikte değerlendirilir. Siparişe ayrılan ürünler darbe almayacak biçimde tek tek yerleştirilir ve ağır ürün olduğu için koli düzeni diğer meyvelerden farklı planlanır. Müşteri sofraya daha yakın olgunluk ya da daha diri yolculuk tercihini seçebilir. Ağustos-Eylül dönemi burada demo operasyon penceresidir; gerçek tarla ve yıllık sıcaklık koşullarına göre kesin tarihlerin admin panelinde doğrulanması gerekir.','adet',26000,'seasonal',null,5000,true),
 ('yuksekova-yayla-poleni-906','906','Yüksekova Yayla Poleni','bal-sifa','Yüksekova arıcılığını tamamlayan, yeni sezonu ilkbahar-yaz döneminde toplanan demo polen ürünü.','Yüksekova Yayla Poleni, Hakkâri arıcılığında bal dışındaki arı ürünlerinin de geliştirilmesine yönelik resmi çalışmalardan esinlenen bir demo katalog ürünüdür. Polen toplama dönemi çiçeklenme ve arılığın durumuna göre değiştiği için sabit bir gün vaat edilmez. Toplanan ürün yabancı materyal ve nem açısından dikkatle ayrılır, küçük partilerde saklanır ve paketlenir. Hasat dönemi ilkbahar-yaz yoğun olsa da uygun saklama koşullarındaki parti yıl boyunca satışta kalabilir. Buradaki Mayıs-Ağustos yeni sezon notu test amaçlıdır; gerçek arıcı, analiz, saklama ve parti takvimi doğrulandığında admin panelinden güncellenecektir.','250 g paket',24000,'tracked',null,250,false),
 ('hakkari-ham-propolisi-907','907','Hakkâri Ham Propolisi','bal-sifa','Hakkâri arıcılığındaki katma değerli arı ürünlerini temsil eden demo ham propolis ürünü.','Hakkâri Ham Propolisi, bölgedeki arıcılık projelerinde propolis üretiminin geliştirilmesine verilen önemden hareketle test kataloğuna eklenmiştir. Kovandan gelen ham materyal doğrudan mucize iddiasıyla sunulmaz; yabancı parçaların ayrılması, parti kaydının tutulması ve kullanım bilgisinin açık yazılması esastır. İlkbahar ve yaz arılık faaliyetleri yeni parti oluşumunun yoğun olduğu dönem olarak ele alınır; uygun şekilde hazırlanmış ve saklanmış mevcut partiler ise yıl boyunca satışa açık olabilir. Bu ürün, fiyat ve sağlık iddiaları dahil tüm ayrıntıları gerçek analiz ve üretici verisi geldiğinde yeniden düzenlenecek demo kaydıdır.','100 g paket',32000,'tracked',null,100,false),
 ('tas-degirmen-yuksekova-bulguru-908','908','Taş Değirmen Yüksekova Bulguru','kiler','Hakkâri tahıl üretimini kiler kategorisine bağlayan, taş değirmen anlatılı demo bulgur ürünü.','Taş Değirmen Yüksekova Bulguru, Hakkâri tarım profilinde yer alan buğday üretimini kiler seçkisine bağlamak için oluşturulmuş demo üründür. Hasat sonrası temizlenen tahılın yabancı materyali ayrılır, kuruluk kontrolü yapılır ve küçük partiler halinde işlenir. Müşteri geleneksel haliyle tek paket ya da kullanım kolaylığı için iki pakete ayrılmış düzeni seçebilir. Ürün yeni hasat döneminde tazelenir ancak kuru kiler ürünü olduğu için uygun stok yönetimiyle yıl boyunca satılabilir. Taş değirmen yöntemi ve üretici ayrıntıları şu an test anlatısıdır; gerçek değirmen, çeşit ve işleme verisi geldiğinde admin panelinden doğrulanacaktır.','1 kg paket',11000,'tracked',null,1000,false)
), producer as (
 select id from public.producers where store_kind='official' and slug='golden-oremar' and status='active' and is_verified=true and deleted_at is null limit 1
), inserted as (
 insert into public.products(legacy_source,legacy_id,producer_id,category_id,slug,name,short_description,description,story,origin,unit_label,base_price_minor,currency,tax_rate_basis_points,status,stock_mode,preorder_lead_days,tags,features,specifications,translations,seo,is_featured,is_active,published_at,export_status,country_of_origin_code,is_perishable,requires_cold_chain,search_text)
 select 'demo-hakkari-50-v1',s.legacy_id,producer.id,c.id,s.slug,s.name,s.short_description,s.short_description,s.story,
        'Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',s.unit_label,s.price_minor,'TRY',0,'published',s.stock_mode,s.lead_days,
        array['Golden Oremar Demo','Hakkâri/Yüksekova'],jsonb_build_array('Demo katalog ürünü','Mevsim ve seçenekler admin tarafından güncellenebilir'),
        jsonb_build_object('catalogSeed','hakkari-50-demo-v1','originalWeight',s.weight_grams,'verificationStatus','demo_pending_real_source'),
        '{}'::jsonb,jsonb_build_object('title',s.name,'description',s.short_description),false,true,timezone('utc',now()),'not_configured','TR',s.is_perishable,false,
        lower(s.name||' Hakkâri Yüksekova Yeşiltaş')
 from seed s join public.categories c on c.slug=s.category_slug cross join producer
 where not exists(select 1 from public.products p where p.slug=s.slug)
 returning id,slug,legacy_id,base_price_minor,unit_label,stock_mode
)
insert into public.product_provenance(product_id,seller_model,source_mode,source_producer_id,source_display_name,country_code,province,district,village,locality_detail,origin_label,origin_verified,organic_claim,public_note)
select i.id,'official_store','platform_village_catalog',p.id,'Golden Oremar Demo Köy Kataloğu','TR','Hakkâri','Yüksekova','Yeşiltaş','Dağlıca','Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri',true,'not_claimed','Test/demo kaynak kaydıdır. Gerçek üretici ve parti doğrulaması daha sonra bu kayıt üzerinden güncellenecektir.'
from inserted i cross join producer p
on conflict(product_id) do nothing;

-- Ensure each of the eight demo products has one server-priced variant and inventory row.
with rows as (
 select p.id,p.slug,p.legacy_id,p.name,p.base_price_minor,
   case p.slug
    when 'hakkari-yayla-karpuzu-905' then 5000
    when 'yuksekova-yayla-poleni-906' then 250
    when 'hakkari-ham-propolisi-907' then 100
    else 1000 end as weight_grams,
   p.stock_mode
 from public.products p where p.legacy_source='demo-hakkari-50-v1' and p.deleted_at is null
), inserted_variants as (
 insert into public.product_variants(product_id,sku,name,option_values,price_minor,weight_grams,is_default,is_active,shipping_weight_source,shipping_weight_note)
 select r.id,'GO-DEMO-'||r.legacy_id,'Standart','{}'::jsonb,r.base_price_minor,r.weight_grams,true,true,'estimated','Demo katalog ağırlığı; gerçek paketleme ölçümüyle güncellenecek.'
 from rows r where not exists(select 1 from public.product_variants v where v.product_id=r.id)
 returning id,product_id
)
insert into public.product_inventory(variant_id,available_quantity,reserved_quantity,reorder_level,version)
select v.id,case when p.stock_mode in ('tracked','seasonal') then 40 else 0 end,0,5,1
from inserted_variants v join public.products p on p.id=v.product_id
on conflict(variant_id) do nothing;

-- Every active catalog product receives a stored option schema. No customer preference may alter the variant price.
insert into public.product_commerce_profiles(product_id,option_schema,seasonality_mode,season_start_month,season_end_month,preorder_enabled,preparation_days_min,preparation_days_max,customer_season_note,research_basis,research_source_label)
select p.id,
 private.normalize_product_option_schema_v1(private.seed_demo_product_option_schema_v1(p.slug,p.name,c.slug)),
 case
  when p.slug like '%kuzu-gobegi%' then 'seasonal'
  when p.slug like '%cagla%' or p.slug like '%cilek%' or p.slug like '%domates%' or p.slug like '%elmasi%' or p.slug like '%cevizi%' or p.slug like '%armudu%' or p.slug like '%erigi%' or p.slug like '%kayisisi%' or p.slug like '%hiyari%' or p.slug like '%karpuzu%' then 'seasonal'
  when p.stock_mode='preorder' then 'made_to_order'
  else 'year_round' end,
 case
  when p.slug like '%kuzu-gobegi%' then 4 when p.slug like '%cagla%' then 4 when p.slug like '%cilek%' then 6
  when p.slug like '%domates%' then 7 when p.slug like '%elmasi%' then 10 when p.slug like '%cevizi%' then 10
  when p.slug like '%armudu%' then 9 when p.slug like '%erigi%' then 8 when p.slug like '%kayisisi%' then 7
  when p.slug like '%hiyari%' then 7 when p.slug like '%karpuzu%' then 8 when p.slug like '%otlu-dag-peyniri%' then 6
  when p.slug like '%poleni%' or p.slug like '%propolis%' then 5 when c.slug='bal-sifa' then 6 else null end,
 case
  when p.slug like '%kuzu-gobegi%' then 6 when p.slug like '%cagla%' then 5 when p.slug like '%cilek%' then 8
  when p.slug like '%domates%' then 9 when p.slug like '%elmasi%' then 10 when p.slug like '%cevizi%' then 10
  when p.slug like '%armudu%' then 10 when p.slug like '%erigi%' then 9 when p.slug like '%kayisisi%' then 8
  when p.slug like '%hiyari%' then 9 when p.slug like '%karpuzu%' then 9 when p.slug like '%otlu-dag-peyniri%' then 7
  when p.slug like '%poleni%' or p.slug like '%propolis%' then 8 when c.slug='bal-sifa' then 9 else null end,
 p.stock_mode='preorder',
 case when p.stock_mode='preorder' then greatest(1,coalesce(p.preorder_lead_days,2)) else 0 end,
 case when p.stock_mode='preorder' then greatest(2,coalesce(p.preorder_lead_days,5)) else 2 end,
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
  when c.slug='bal-sifa' then 'Arılık ve çiçeklenmeye bağlı yeni sezon yaz döneminde yoğunlaşır; kesin hasat tarihi ürün tipine ve o yıla göre değişir.'
  when p.stock_mode='preorder' then 'Hazır stoktan değil, sipariş ve üretim koşullarına göre hazırlanır. Kesin tarih satış penceresinde gösterilir.'
  else 'Bu ürün yıl boyunca stok durumuna göre satışa sunulabilir; yeni sezon bilgisi varsa ayrıca gösterilir.' end,
 'Hakkâri/Yüksekova için demo operasyon takvimi. Gerçek üretici, saha ve parti verisi geldiğinde admin tarafından güncellenmelidir.',
 case
  when p.slug like '%otlu-dag-peyniri%' then 'Türkiye Geleneksel Peynir Envanteri - Hakkâri Otlu Peyniri'
  when p.slug like '%cevizi%' then 'Tarım TV - Yüksekova ceviz hasadı'
  when p.slug like '%elmasi%' then 'Yüksekova elma hasadı ve Hakkâri tarım yatırım rehberi'
  when p.slug like '%poleni%' or p.slug like '%propolis%' or c.slug='bal-sifa' then 'Hakkâri İl Tarım ve Orman Müdürlüğü arıcılık çalışmaları'
  else 'Hakkâri İl Tarım ve Orman Müdürlüğü il tarım profili / 2025 yatırım rehberi' end
from public.products p join public.categories c on c.id=p.category_id
where p.is_active=true and p.deleted_at is null
on conflict(product_id) do update set
 option_schema=excluded.option_schema,
 seasonality_mode=excluded.seasonality_mode,
 season_start_month=excluded.season_start_month,
 season_end_month=excluded.season_end_month,
 preorder_enabled=excluded.preorder_enabled,
 preparation_days_min=excluded.preparation_days_min,
 preparation_days_max=excluded.preparation_days_max,
 customer_season_note=excluded.customer_season_note,
 research_basis=excluded.research_basis,
 research_source_label=excluded.research_source_label,
 updated_at=timezone('utc',now());

-- Unconfirmed 2027 planning windows create no customer notifications. Super Admin must confirm real dates first.
insert into public.product_sales_windows(product_id,season_year,preorder_opens_at,preorder_closes_at,fulfillment_starts_at,fulfillment_ends_at,status,is_confirmed,public_note,internal_note)
select p.id,2027,
 make_timestamptz(2027,coalesce(profile.season_start_month,4),1,6,0,0,'Europe/Istanbul')-interval '21 days',
 make_timestamptz(2027,coalesce(profile.season_end_month,10),28,20,0,0,'Europe/Istanbul'),
 make_timestamptz(2027,coalesce(profile.season_start_month,4),1,6,0,0,'Europe/Istanbul'),
 make_timestamptz(2027,coalesce(profile.season_end_month,10),28,20,0,0,'Europe/Istanbul')+make_interval(days=>coalesce(profile.preparation_days_max,5)),
 'scheduled',false,
 'Tahmini sezon planıdır. Kesin tarih üretici doğrulamasından sonra açılır.',
 'Demo planning window. Must be confirmed by Super Admin before notifications or server-side sales gating.'
from public.products p join public.product_commerce_profiles profile on profile.product_id=p.id
where p.is_active=true and p.deleted_at is null and profile.preorder_enabled=true
on conflict(product_id,season_year) do nothing;

drop function private.seed_demo_product_option_schema_v1(text,text,text);
