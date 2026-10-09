-- Home page as a short, chosen selection instead of a long list. Under
-- "Bugünün Önerisi" and the text strip Bugün | Mevsim | Yeni | Hediye:
--
--   1. featured      Seçilmiş olanlar  · Sofrada iz bırakanlar
--   2. seasonal      Şu anın hasadı    · Zamanı gelmiş lezzetler
--   3. new_arrivals  Vitrine yeni      · Henüz az bilinenler
--   4. natural       Özenle ayrıldı    · Verilmeye değer olanlar  (strip: Hediye)
--   5. pre_order     Sakin seçki       · Acele etmeyen tatlar
--
-- "offers" stays in the list, switched off, so the super admin can turn it
-- back on in Ayarlar > Ana Sayfa Vitrini. Every section keeps its source and
-- other fields; only order, active, displayLimit (at most 8) and the titles
-- and subtitles below change, so the panel shows exactly what the page says.
-- Sections the admin added are kept after these, in their order. Re-running
-- restores this selection.

update public.brand_settings bs
set public_config = jsonb_set(bs.public_config, '{homeSections}', (
  select jsonb_agg(
    item
    || case when item->>'id' = 'offers' then '{"active": false}'::jsonb
            when item->>'id' in ('featured', 'seasonal', 'new_arrivals', 'natural', 'pre_order') then '{"active": true}'::jsonb
            else '{}'::jsonb end
    || case item->>'id'
         when 'featured' then '{"title": "Sofrada iz bırakanlar", "subtitle": "Az bulunur, kökeni net, karakteri güçlü. Sofranı sıradanlıktan ayıranlar."}'::jsonb
         when 'seasonal' then '{"title": "Zamanı gelmiş lezzetler", "subtitle": "Bu mevsimde toplanan, beklemeye değen, taze karakterli ürünler."}'::jsonb
         when 'new_arrivals' then '{"title": "Henüz az bilinenler", "subtitle": "Raflara yeni düşen, keşfedilmeyi bekleyen sakin seçimler."}'::jsonb
         when 'natural' then '{"title": "Verilmeye değer olanlar", "subtitle": "Bir sofraya veya birine bırakıldığında anlamı artan ürünler."}'::jsonb
         when 'pre_order' then '{"title": "Acele etmeyen tatlar", "subtitle": "Yavaş üretilmiş, hikâyesi olan, uzun süre hatırlananlar."}'::jsonb
         else '{}'::jsonb
       end
    || jsonb_build_object('displayLimit', least(8, greatest(1, coalesce(case when item->>'displayLimit' ~ '^[0-9]+$' then (item->>'displayLimit')::integer end, 6))))
    order by case item->>'id' when 'featured' then 1 when 'seasonal' then 2 when 'new_arrivals' then 3 when 'natural' then 4 when 'pre_order' then 5 when 'offers' then 6 else 7 end, position)
  from jsonb_array_elements(bs.public_config->'homeSections') with ordinality as sections(item, position)
), true),
    updated_at = timezone('utc', now())
where bs.slug = 'golden-oremar'
  and jsonb_typeof(bs.public_config->'homeSections') = 'array'
  and jsonb_array_length(bs.public_config->'homeSections') > 0;
