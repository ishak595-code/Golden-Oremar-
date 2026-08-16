-- Tree-nut allergens by product identity.
update public.content_entries ce
set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,allergens}','{"known":["Ceviz (sert kabuklu yemiş)"],"verifyLabel":true,"text":"Ceviz önemli bir gıda alerjenidir; etiket ve çapraz bulaşma bilgisini kontrol edin."}'::jsonb,true),'{safetyV2,sources}','[{"authority":"FDA","title":"Food Allergies","url":"https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies","topic":"Sert kabuklu yemiş alerjenleri","accessedAt":"2026-08-16"}]'::jsonb,true),updated_at=timezone('utc',now())
from public.products p where p.id=ce.related_product_id and p.slug='husnu-dayi-nin-kagit-kabuklu-cevizi-504';

update public.content_entries ce
set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,allergens}','{"known":["Badem (sert kabuklu yemiş)"],"verifyLabel":true,"text":"Badem önemli bir gıda alerjenidir; etiket ve çapraz bulaşma bilgisini kontrol edin."}'::jsonb,true),'{safetyV2,sources}','[{"authority":"FDA","title":"Food Allergies","url":"https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies","topic":"Sert kabuklu yemiş alerjenleri","accessedAt":"2026-08-16"}]'::jsonb,true),updated_at=timezone('utc',now())
from public.products p where p.id=ce.related_product_id and p.slug='kitir-taze-cagla-badem-806';

-- Pantry.
update public.content_entries
set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,storage}','{"title":"Saklama","items":["Ambalajı kapalı, kuru ve doğrudan güneş almayan yerde tutun.","Nem, ambalaj hasarı veya ürün etiketindeki özel talimatlar varsa bunları dikkate alın."]}'::jsonb,true),'{safetyV2,verificationNeeded}','["İçindekiler ve alerjen etiketi","Raf ömrü ve lot","Ambalaj ve nem kontrolü"]'::jsonb,true),updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='dry_pantry';

-- Processed beverages.
update public.content_entries
set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,storage}','{"title":"Saklama","items":["Açılmadan ve açıldıktan sonraki saklama koşulunu ürün etiketi veya lot kaydından doğrulayın.","Kapak veya mühür hasarlıysa tüketmeyin."]}'::jsonb,true),'{safetyV2,verificationNeeded}','["İçindekiler ve ilave şeker bilgisi","Alerjen bilgisi","Açılmadan ve açıldıktan sonra saklama koşulu ile raf ömrü"]'::jsonb,true),updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='processed_beverage';

-- Water.
update public.content_entries
set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,storage}','{"title":"Saklama","items":["Kapak veya mühür bütünlüğünü kontrol edin.","Doğrudan güneş ve aşırı ısıdan uzak tutun; açıldıktan sonra üretici talimatını izleyin."]}'::jsonb,true),'{safetyV2,verificationNeeded}','["Kaynak veya dolum tesisi bilgisi","Güncel mikrobiyolojik ve kimyasal analiz","Mühür, lot ve ambalaj uygunluğu"]'::jsonb,true),updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='water';

-- Salt.
update public.content_entries
set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,storage}','{"title":"Saklama","items":["Nemden uzak, kapalı ambalajda saklayın.","Gıda amaçlı kullanılacaksa analiz ve etiket bilgisini kontrol edin."]}'::jsonb,true),'{safetyV2,verificationNeeded}','["Gıda amaçlı uygunluk","Mineral veya iyot iddiası varsa analiz raporu","Lot ve ambalaj etiketi"]'::jsonb,true),updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='salt';

-- Distillate.
update public.content_entries
set metadata=jsonb_set(jsonb_set(jsonb_set(metadata,'{safetyV2,storage}','{"title":"Saklama","items":["Kapalı ve temiz ambalajda, doğrudan güneşten uzakta saklayın.","Açıldıktan sonraki saklama süresi ve sıcaklığı lot veya ürün etiketinden doğrulanmalıdır."]}'::jsonb,true),'{safetyV2,warnings}','[{"code":"no_therapeutic_claim","severity":"info","text":"Bu ürün tıbbi, antiseptik veya tedavi edici etki iddiasıyla sunulmaz."}]'::jsonb,true),'{safetyV2,verificationNeeded}','["Gıda amaçlı kullanım statüsü","İçerik ve üretim veya hijyen belgeleri","Lot ve açıldıktan sonra saklama koşulu"]'::jsonb,true),updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='distillate';

-- Non-food products.
update public.content_entries
set metadata=jsonb_set(jsonb_set(jsonb_set(metadata,'{safetyV2,storage}','{"title":"Saklama","items":["Ürünü kuru, çocukların erişemeyeceği ve üretici talimatına uygun yerde saklayın.","Isı veya ateşle kullanılan ürünlerde yanıcı yüzeylerden uzak tutun."]}'::jsonb,true),'{safetyV2,preparation}','{"title":"Güvenli kullanım","items":["Üretici kullanım ve bakım talimatlarını izleyin.","Isıtılan taş veya ahşap ürünlerde sıcak yüzey ve yangın riskine karşı dikkatli olun."]}'::jsonb,true),'{safetyV2,warnings}','[{"code":"not_medical_device","severity":"info","text":"Bu ürün tıbbi cihaz veya tedavi ürünü olarak sunulmaz."}]'::jsonb,true),updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='non_food_safety';