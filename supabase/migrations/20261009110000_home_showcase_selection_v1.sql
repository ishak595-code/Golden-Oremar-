-- Home page as a short, chosen selection instead of a long list: four
-- showcases under "Bugünün Önerisi", each at most eight products.
--
--   1. Sofranın imza parçaları   (featured)
--   2. Mevsim                    (seasonal; its title follows the season
--                                 in the app while left at the default)
--   3. Vitrine yeni düşenler     (new_arrivals)
--   4. Beklemeye değen lezzetler (pre_order)
--
-- "offers" and "natural" stay in the list, switched off, so the super admin
-- can turn them back on in Ayarlar > Ana Sayfa Vitrini. Every section keeps
-- its source, subtitle and other fields; only order, active, displayLimit
-- and the three titles/subtitles below change. Sections the admin added are
-- kept after these, in their order. Safe to re-run.

update public.brand_settings bs
set public_config = jsonb_set(bs.public_config, '{homeSections}', (
  select jsonb_agg(
    item
    || case when item->>'id' in ('offers', 'natural') then '{"active": false}'::jsonb else '{}'::jsonb end
    || case item->>'id'
         when 'featured' then '{"title": "Sofranın imza parçaları", "subtitle": "Kökeni belli, karakteri güçlü ürünler. Her biri sofrada fark yaratması için seçildi."}'::jsonb
         when 'new_arrivals' then '{"title": "Vitrine yeni düşenler", "subtitle": "Yeni üreticiler, yeni tatlar, yeni favoriler. İlk keşfedenlerden biri olun."}'::jsonb
         when 'pre_order' then '{"title": "Beklemeye değen lezzetler", "subtitle": "Siparişinizle hazırlanmaya başlayan, emeği ve zamanı ürüne dönüşen özel seçimler."}'::jsonb
         else '{}'::jsonb
       end
    || jsonb_build_object('displayLimit', least(8, greatest(1, coalesce(case when item->>'displayLimit' ~ '^[0-9]+$' then (item->>'displayLimit')::integer end, 6))))
    order by case item->>'id' when 'featured' then 1 when 'seasonal' then 2 when 'new_arrivals' then 3 when 'pre_order' then 4 when 'offers' then 5 when 'natural' then 6 else 7 end, position)
  from jsonb_array_elements(bs.public_config->'homeSections') with ordinality as sections(item, position)
), true),
    updated_at = timezone('utc', now())
where bs.slug = 'golden-oremar'
  and jsonb_typeof(bs.public_config->'homeSections') = 'array'
  and jsonb_array_length(bs.public_config->'homeSections') > 0;
