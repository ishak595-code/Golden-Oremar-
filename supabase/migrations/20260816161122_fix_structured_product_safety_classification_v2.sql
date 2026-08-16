update public.content_entries ce
set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"dry_pantry"'::jsonb,true),updated_at=timezone('utc',now())
from public.products p join public.categories c on c.id=p.category_id
where p.id=ce.related_product_id and c.slug='kiler';

update public.content_entries ce
set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"dry_pantry"'::jsonb,true),updated_at=timezone('utc',now())
from public.products p
where p.id=ce.related_product_id and p.slug='buyuk-iskender-corek-otu-tohumu-705';

update public.content_entries ce
set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"distillate"'::jsonb,true),updated_at=timezone('utc',now())
from public.products p
where p.id=ce.related_product_id and p.slug='ata-tohumu-dag-kekigi-suyu-distile-807';

update public.content_entries ce
set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"processed_beverage"'::jsonb,true),updated_at=timezone('utc',now())
from public.products p join public.categories c on c.id=p.category_id
where p.id=ce.related_product_id and c.slug='yoresel-icecekler'
  and p.slug not in ('taze-yayik-ayrani-canli-kultur-205','ata-tohumu-dag-kekigi-suyu-distile-807');