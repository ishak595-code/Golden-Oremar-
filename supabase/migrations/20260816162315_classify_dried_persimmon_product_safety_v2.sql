update public.content_entries ce
set metadata=jsonb_set(
      jsonb_set(metadata,'{safetyV2,safetyClass}','"dry_pantry"'::jsonb,true),
      '{safetyV2,storage}','{"title":"Saklama","items":["Ambalajı kapalı, kuru ve doğrudan güneş almayan yerde tutun.","Nem, küf veya ambalaj hasarı varsa ürünü kullanmayın."]}'::jsonb,true),
    updated_at=timezone('utc',now())
from public.products p
where p.id=ce.related_product_id
  and p.slug='kislik-kurutulmus-cennet-hurmasi-808';