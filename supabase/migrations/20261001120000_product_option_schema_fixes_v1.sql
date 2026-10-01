-- Wrong order options on six products (found 2026-10-01).
--
-- The 2026-09-02 seed picked option schemas by name keywords, so the egg,
-- the rooster, the kid goat, the suet and the oak firewood were offered the
-- trout's "Av planı / Temizleme: Fileto" choices, and the "Kuzu Göbeği"
-- mushroom got lamb butchery options because of the word "kuzu". Each row is
-- updated only while it still holds the wrong schema, so a later manual edit
-- is never overwritten.

with fixes(legacy_id, wrong_key, schema) as (values
  -- Egg: protection and delivery, nothing to catch or fillet.
  ('305', 'catchPlan', '[
    {"key":"packing","label":"Viyol koruması","choices":[{"label":"Standart viyol koli","value":"standard"},{"label":"Ek darbe korumalı koli","value":"extra"}],"required":true},
    {"key":"deliveryPreference","label":"Teslimat tercihi","choices":[{"label":"Mümkün olan en erken teslimat","value":"earliest"},{"label":"Planlı teslimat penceresi","value":"planned"}],"required":true}
  ]'::jsonb),
  -- Kid goat: the same butchery choices as the lamb.
  ('303', 'catchPlan', '[
    {"key":"preparation","label":"Hazırlama şekli","choices":[{"label":"Bütün karkas","value":"whole"},{"label":"Kasap usulü parçalanmış","value":"butchered"}],"required":true},
    {"key":"cutStyle","label":"Parçalama stili","choices":[{"label":"Dengeli kasap kesimi","value":"balanced"},{"label":"Izgaralık ağırlıklı","value":"grill"},{"label":"Tencerelik ağırlıklı","value":"stew"}],"required":true,"visibleWhen":{"key":"preparation","equals":"butchered"}},
    {"key":"offal","label":"Sakatat tercihi","choices":[{"label":"Dahil et","value":"included"},{"label":"Ayrı paketle","value":"separate"},{"label":"İstemiyorum","value":"none"}],"required":true},
    {"key":"packaging","label":"Paket düzeni","choices":[{"label":"Parça bazlı paket","value":"by_cut"},{"label":"Yaklaşık 1 kg aile paketleri","value":"family_1kg"},{"label":"Yaklaşık 2 kg büyük paketler","value":"large_2kg"}],"required":true}
  ]'::jsonb),
  -- Rooster: whole or portioned, one pack or several.
  ('304', 'catchPlan', '[
    {"key":"preparation","label":"Hazırlama şekli","choices":[{"label":"Bütün","value":"whole"},{"label":"Parçalanmış","value":"portioned"}],"required":true},
    {"key":"packaging","label":"Paket düzeni","choices":[{"label":"Tek paket","value":"single"},{"label":"Porsiyonlu paketler","value":"split"}],"required":true}
  ]'::jsonb),
  -- Suet: the pantry preparation choices it shares with similar products.
  ('701', 'catchPlan', '[
    {"key":"texture","label":"Hazırlama tercihi","choices":[{"label":"Geleneksel haliyle","value":"traditional"},{"label":"Mutfakta kolay kullanım için ayrılmış","value":"easy_use"}],"required":true},
    {"key":"packaging","label":"Paket düzeni","choices":[{"label":"Tek paket","value":"single"},{"label":"İki kullanım paketi","value":"split"}],"required":true}
  ]'::jsonb),
  -- Wild mushroom: size and portioning, as its own story describes.
  ('601', 'cutStyle', '[
    {"key":"selection","label":"Boy seçimi","choices":[{"label":"İri ve bütün ağırlıklı","value":"large_whole"},{"label":"Karışık boy","value":"mixed"}],"required":true},
    {"key":"packaging","label":"Paketleme","choices":[{"label":"Tek paket","value":"single_pack"},{"label":"Küçük porsiyon paketleri","value":"small_portions"}],"required":true}
  ]'::jsonb),
  -- Firewood: no order options; it ships as listed.
  ('403', 'catchPlan', '[]'::jsonb)
)
update public.product_commerce_profiles pc
   set option_schema = fixes.schema,
       updated_at = now()
  from fixes
  join public.products p on p.legacy_id = fixes.legacy_id
 where pc.product_id = p.id
   and pc.option_schema::text like '%"' || fixes.wrong_key || '"%';
