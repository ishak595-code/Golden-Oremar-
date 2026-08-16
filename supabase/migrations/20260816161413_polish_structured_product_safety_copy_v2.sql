update public.content_entries
set metadata=jsonb_set(
      jsonb_set(metadata,'{safetyV2,allergens}','{"known":[],"verifyLabel":false,"text":"Gıda alerjeni alanı bu gıda dışı ürün için uygulanmaz."}'::jsonb,true),
      '{safetyV2,verificationNeeded}','["Üretici kullanım ve bakım talimatı","Malzeme veya ürün bileşimi","Isı veya ateşle kullanım varsa güvenlik talimatı"]'::jsonb,true),
    updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='non_food_safety';

update public.content_entries
set metadata=jsonb_set(metadata,'{safetyV2,preparation}','{"title":"Güvenli kullanım","items":["Çiğ sütü pastörize sütle eşdeğer güvenli kabul etmeyin.","Ürün etiketini, soğuk zincir bilgisini ve bulunduğunuz yerdeki gıda güvenliği veya mevzuat talimatlarını izleyin.","Bu bilgi evde pastörizasyon veya tedavi talimatı yerine geçmez."]}'::jsonb,true),
    updated_at=timezone('utc',now())
where metadata#>>'{safetyV2,safetyClass}'='raw_milk';