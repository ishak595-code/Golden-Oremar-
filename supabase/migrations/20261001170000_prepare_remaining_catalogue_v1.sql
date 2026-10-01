-- Prepares the last 8 catalogue products (50 in total) for publication.
--
-- They were seeded as drafts with placeholder text ("demo kaydı", "Demo
-- katalog ürünü", tag "Golden Oremar Demo", SKU GO-DEMO-*) and no stock. This
-- gives each one real customer copy in the same voice and shape as the
-- published products (no health or certification claims), regular SKUs,
-- option names, the same specification keys, a home section, a starting
-- stock, a published Turkish safety package (cloned from the matching
-- published product type) and de-demoed provenance text, then moves them to
-- 'review'.
--
-- Publication itself is NOT done here, on purpose: products go live only
-- through the Super Admin AAL2 approval in the panel
-- (enforce_super_admin_product_publication_v1, super_admin_bulk_publish_*).
-- Origin verification also stays a human decision (origin_verified untouched).

with copy(slug, short_text, story, features, tags, home_section, product_type, stock) as (values
 ('yuksekova-sonbahar-armudu-901',
  'Yüksekova bahçelerinde sonbaharın serin gecelerinde olgunlaşan, sulu ve kokulu yerli armut.',
  'Sonbahar Yüksekova''ya erken gelir. Gündüz güneşi, gece serinliği armudun şekerini yavaş yavaş toplar; bu yüzden yayla armudu acele etmez. Dağlıca - Yeşiltaş çevresindeki bahçelerde meyve dalda tam kıvamına gelmeden toplanmaz, toplandıktan sonra da serin bir odada birkaç gün dinlendirilir. Ezik ve yolculuğa dayanmayacak taneler ayrılır, kalanlar katlar arasında sıkıştırılmadan kutulanır. Her kasada aynı boy ve aynı renk yoktur; bahçenin o yılki gerçek hali neyse kutuda da odur. Kabuğuyla yenebilen, kendi kokusunu taşıyan bir meyve: kahvaltıda, ikramda ya da kış öncesi komposto için.',
  '["Yayla bahçesi","Elle toplama","Küçük parti"]'::jsonb, array['Sonbahar Hasadı','Yerel Cins'], 'seasonal', 'produce', 60),
 ('hakkari-dag-erigi-902',
  'Ekşisiyle tatlısı dengede, ince kabuklu ve sulu Hakkâri dağ eriği.',
  'Dağ eriği yaz sonunda, yamaçtaki ağaçların en güneşli dallarında olgunlaşır. Tadı şehir erikleri gibi tek düze değildir: ilk ısırıkta ekşi, sonra tatlı. Köyde erik ağaçtan silkelenmez, tek tek toplanır; çünkü ince kabuk düştüğü yerde zedelenir. Toplanan erikler aynı gün ayıklanır, sapı kopmuş ya da çatlamış taneler ayrılır. Taze yemek için olduğu kadar ekşili yemekler, komposto ve kış için kurutmak üzere de alınır. Her partinin boyu ve rengi mevsime göre değişebilir; bu, meyvenin doğal halidir.',
  '["Elle toplama","İnce kabuk","Mevsiminde"]'::jsonb, array['Yaz Sonu Hasadı','Yerel Cins'], 'seasonal', 'produce', 40),
 ('yuksekova-yayla-kayisisi-903',
  'Kısa yayla yazında olgunlaşan, küçük taneli ve yoğun aromalı kayısı.',
  'Yüksek rakımda yaz kısa sürer, kayısı da o kısa sürede acele etmeden olgunlaşır. Yayla kayısısı ova kayısısından küçüktür ama aroması daha yoğundur. Ağaçtan tam olgunlukta toplanır, aynı gün ayıklanır ve ezilmemesi için sığ kasalara tek kat dizilir. Taze tüketim için olduğu kadar reçel ve kurutmalık olarak da tercih edilir. Hasat dönemi kısa olduğundan küçük partiler halinde hazırlanır; renk ve boy her partide biraz farklı olabilir.',
  '["Yayla meyvesi","Tek kat kasa","Küçük parti"]'::jsonb, array['Yaz Hasadı','Yerel Cins'], 'regular', 'produce', 40),
 ('yuksekova-yaz-hiyari-904',
  'Sabah serinliğinde toplanan, ince kabuklu ve çıtır Yüksekova yaz hıyarı.',
  'Yüksekova''nın yaz bahçelerinde hıyar sabah erken, güneş toprağı ısıtmadan toplanır; çıtırlığını o saatte korur. İnce kabuklu, çekirdeği küçük yerli hıyarlar boylarına göre ayrılır, yumuşamış ya da sararmış olanlar kasaya girmez. Salata, cacık ve turşuluk için uygundur. Bahçe hıyarı fabrika gibi tek boy çıkmaz; kasada küçük ve iri taneler birlikte olabilir.',
  '["Sabah hasadı","İnce kabuk","Turşuluk ve salatalık"]'::jsonb, array['Yaz Hasadı','Bahçe Ürünü'], 'regular', 'produce', 60),
 ('hakkari-yayla-karpuzu-905',
  'Gece serinliğiyle şekerini toplayan, kırmızı içli yayla karpuzu.',
  'Yayla karpuzu sıcak ova karpuzlarından daha geç olgunlaşır; gece serinliği meyvenin içini sıkı ve kıtır tutar. Toplamadan önce sapın kuruması, kabuğa vurulduğunda gelen tok ses ve toprağa değen yerin sararması kontrol edilir. Çatlak ya da yumuşak noktası olan karpuz gönderilmez. Her karpuz tek tek seçildiği için ağırlıklar birbirinden farklıdır; ortalama ağırlık ürün seçeneğinde belirtilir.',
  '["Tek tek seçim","Yayla yetiştiriciliği","Mevsiminde"]'::jsonb, array['Yaz Sonu Hasadı','Bahçe Ürünü'], 'regular', 'produce', 25),
 ('yuksekova-yayla-poleni-906',
  'Yayla çiçeklerinden arıların topladığı, renkli taneli kuru polen.',
  'Polen, arıların çiçekten kovana taşıdığı küçük renkli tanelerdir. Yüksekova yaylalarında ilkbahar ve yaz boyunca açan çiçekler polene renk renk taneler verir; bu yüzden her paketin rengi biraz farklıdır. Kovan girişindeki polen tuzaklarından toplanan taneler yabancı maddelerden ayıklanır, serin ve gölgede kurutulur, nemi alındıktan sonra paketlenir. Kahvaltıda yoğurt ya da bal ile tüketilebilir. Arı ürünlerine alerjisi olanların tüketmeden önce hekime danışması önerilir.',
  '["Yayla çiçekleri","Gölgede kurutma","Ayıklanmış tane"]'::jsonb, array['Arı Ürünü','Yayla'], 'natural', 'pantry', 25),
 ('hakkari-ham-propolisi-907',
  'Kovan çerçevelerinden kazınarak toplanan, işlenmemiş ham propolis.',
  'Propolis, arıların ağaç tomurcuklarından topladığı reçineli maddeyle kovanlarını kapattıkları doğal bir yapıştırıcıdır. Hakkâri''deki kovanlardan hasat sonunda çerçeve ve kapak aralarından elle kazınarak toplanır. Ham propolis olduğu için içinde doğal olarak küçük balmumu parçaları bulunabilir; rengi kovandan kovana koyu kahveden kızıla değişir. Serin ve kuru yerde, ışıktan uzak saklanmalıdır. Arı ürünlerine alerjisi olanların kullanmadan önce hekime danışması önerilir.',
  '["El ile kazıma","İşlenmemiş","Küçük parti"]'::jsonb, array['Arı Ürünü','Ham Ürün'], 'natural', 'pantry', 20),
 ('tas-degirmen-yuksekova-bulguru-908',
  'Yerel buğdaydan kaynatılıp güneşte kurutulan, taş değirmende kırılmış köy bulguru.',
  'Köyde bulgur yaz sonunda yapılır: buğday büyük kazanlarda kaynatılır, damlarda güneşte kurutulur, sonra taş değirmende kırılır. Taş değirmen buğdayı ezmeden kırdığı için tanenin kokusu ve dokusu korunur. Kırılan bulgur elenir, kepeği ve tozu ayrılır, pilavlık ve köftelik olarak ayrılarak paketlenir. Pişirildiğinde tane tane dağılan, kendine has buğday kokusu olan bir kiler ürünüdür. Serin ve kuru yerde saklanmalıdır.',
  '["Taş değirmen","Güneşte kurutma","Elenmiş tane"]'::jsonb, array['Kiler','Köy Usulü'], 'regular', 'pantry', 50)
), updated as (
  update public.products p set
    short_description = c.short_text,
    description = c.short_text,
    story = c.story,
    features = c.features,
    tags = c.tags,
    seo = jsonb_build_object('title', p.name, 'description', c.short_text),
    specifications = jsonb_strip_nulls(jsonb_build_object(
      'video', null, 'section', null, 'cutOptions', '[]'::jsonb, 'homeSection', c.home_section,
      'pricePrefix', null, 'preOrderTime', null, 'weightOptions', '[]'::jsonb, 'productType', c.product_type,
      'originalRating', 0, 'originalWeight', null, 'claimReviewStatus', 'not_verified',
      'verificationStatus', 'pending_documents', 'originalReviewCount', 0)),
    legacy_source = 'golden-oremar-catalog-v1',
    stock_mode = 'tracked',
    status = 'review',
    updated_at = timezone('utc', now())
  from copy c
  where p.slug = c.slug and p.deleted_at is null and p.status = 'draft'
  returning p.id, c.stock, p.legacy_id
), skus as (
  update public.product_variants v set sku = 'GO-' || u.legacy_id
  from updated u where v.product_id = u.id and v.sku like 'GO-DEMO-%'
  returning v.id
)
update public.product_inventory i set available_quantity = u.stock
from updated u join public.product_variants v on v.product_id = u.id
where i.variant_id = v.id;

-- Option names the customer reads in the cart ("Standart" said nothing).
update public.product_variants v set name = n.variant_name
from (values
  ('yuksekova-sonbahar-armudu-901','1 kg Kasa'),
  ('hakkari-dag-erigi-902','1 kg Kasa'),
  ('yuksekova-yayla-kayisisi-903','1 kg Kasa'),
  ('yuksekova-yaz-hiyari-904','1 kg Kasa'),
  ('hakkari-yayla-karpuzu-905','1 Adet (ort. 5 kg)'),
  ('yuksekova-yayla-poleni-906','250 g Paket'),
  ('hakkari-ham-propolisi-907','100 g Paket'),
  ('tas-degirmen-yuksekova-bulguru-908','1 kg Paket')
) as n(slug, variant_name)
join public.products p on p.slug = n.slug
where v.product_id = p.id and v.name = 'Standart';

-- Provenance text without "Test/demo"; the verification flag is left as is.
update public.product_provenance pp set
  public_note = 'Golden Oremar resmi mağazası tarafından yönetilen Yeşiltaş köy kataloğu.',
  source_display_name = 'Golden Oremar Resmi Mağazası',
  updated_at = timezone('utc', now())
from public.products p
where pp.product_id = p.id and p.legacy_source = 'golden-oremar-catalog-v1'
  and (pp.public_note ilike '%demo%' or pp.source_display_name ilike '%demo%');

-- A published Turkish safety package per product, cloned from a published
-- product of the same kind (fresh produce from Hakkari Dağ Elması, dry pantry
-- from the tarhana). Pollen and propolis get a bee-product package built on
-- the honey template, without the honey-only infant warning and source.
with target as (
  select p.id, p.slug, p.name, p.legacy_id,
    case when p.slug in ('yuksekova-yayla-poleni-906','hakkari-ham-propolisi-907') then 'avasin-mese-bali-103'
         when p.slug = 'tas-degirmen-yuksekova-bulguru-908' then 'hatun-ana-nin-eksi-maya-gunesi-tarhana-501'
         else 'hakkari-dag-elmasi-801' end as template_slug,
    p.slug in ('yuksekova-yayla-poleni-906','hakkari-ham-propolisi-907') as bee
  from public.products p
  where p.legacy_source = 'golden-oremar-catalog-v1' and p.status = 'review' and p.deleted_at is null
    and not exists (
      select 1 from public.content_entries e
      where e.related_product_id = p.id and e.content_type = 'product_health' and e.deleted_at is null)
), src as (
  select target.*, t.summary as t_summary, t.body_markdown as t_body, t.body_html_sanitized as t_html,
    t.metadata as t_meta, t.related_producer_id, t.tags
  from target
  join lateral (
    select e.* from public.content_entries e join public.products tp on tp.id = e.related_product_id
    where tp.slug = target.template_slug and e.content_type = 'product_health' and e.locale = 'tr'
      and e.status = 'published' and e.deleted_at is null and e.metadata ? 'safetyV2'
    order by e.updated_at desc limit 1
  ) t on true
), shaped as (
  select src.*,
    src.name || ' | Saklama ve Kullanım' as title,
    case when bee then 'Arı ürününün saklama, alerji uyarısı ve lot doğrulama bilgileri.' else t_summary end as summary,
    case when bee then 'Hasat bölgesi, lot ve etiket bilgisi sipariş öncesinde doğrulanmalıdır. Arı ürünlerine alerjisi olanlar tüketmeden önce hekime danışmalıdır. Hastalığa yönelik fayda beyanı yayımlanmaz.' else t_body end as body,
    case when bee then '<p>Hasat bölgesi, lot ve etiket bilgisi sipariş öncesinde doğrulanmalıdır. Arı ürünlerine alerjisi olanlar tüketmeden önce hekime danışmalıdır. Hastalığa yönelik fayda beyanı yayımlanmaz.</p>' else t_html end as html,
    case when bee then jsonb_build_array(
        jsonb_build_object('code','editorial_note','text','Arı ürünlerine (bal, polen, propolis) alerjisi olanlar tüketmeden önce hekime danışmalıdır.','severity','info'),
        jsonb_build_object('code','editorial_note','text','Arı ürünleri gıdadır; hastalık tedavisi veya önlenmesi iddiasıyla sunulmaz.','severity','info'))
      else t_meta #> '{safetyV2,warnings}' end as warnings
  from src
)
insert into public.content_entries (
  legacy_source, legacy_id, content_type, slug, title, summary, body_markdown, body_html_sanitized,
  related_product_id, related_producer_id, status, locale, tags, metadata, seo, published_at)
select
  'golden-oremar-catalog-v1', s.legacy_id, 'product_health',
  s.slug || '-saklama-ve-kullanim', s.title, s.summary, s.body, s.html,
  s.id, s.related_producer_id, 'published', 'tr', s.tags,
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(s.t_meta,
    '{editorialV1,title}', to_jsonb(s.title)),
    '{editorialV1,summary}', to_jsonb(s.summary)),
    '{safetyV2,warnings}', s.warnings),
    '{editorialV1,safety,warnings}', (select coalesce(jsonb_agg(w->'text'), '[]'::jsonb) from jsonb_array_elements(s.warnings) w)),
    '{safetyV2,sources}', case when s.bee then '[]'::jsonb else coalesce(s.t_meta #> '{safetyV2,sources}', '[]'::jsonb) end),
  jsonb_build_object('title', s.title, 'description', ''),
  timezone('utc', now())
from shaped s;
