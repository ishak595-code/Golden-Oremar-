update public.brand_settings
set public_config=jsonb_set(
  jsonb_set(
    jsonb_set(
      public_config,
      '{homeSections}',
      coalesce((
        select jsonb_agg(
          case item->>'id'
            when 'featured' then jsonb_set(item,'{title}',to_jsonb('Golden Oremar Seçkisi'::text),true)
            when 'pre_order' then jsonb_set(item,'{title}',to_jsonb('Öncelikli Erişim'::text),true)
            when 'natural' then jsonb_set(item,'{title}',to_jsonb('Köyün İmzası'::text),true)
            when 'seasonal' then jsonb_set(item,'{title}',to_jsonb('Mevsimin Seçkisi'::text),true)
            when 'best_sellers' then jsonb_set(item,'{title}',to_jsonb('En Çok Tercih Edilenler'::text),true)
            when 'new_arrivals' then jsonb_set(item,'{title}',to_jsonb('Yeni Keşifler'::text),true)
            when 'offers' then jsonb_set(item,'{title}',to_jsonb('Golden Oremar Ayrıcalıkları'::text),true)
            else item
          end
          order by ordinality
        )
        from jsonb_array_elements(coalesce(public_config->'homeSections','[]'::jsonb)) with ordinality as rows(item,ordinality)
      ),'[]'::jsonb),
      true
    ),
    '{heroCategories}',
    coalesce((
      select jsonb_agg(
        case when item->>'id'='kiler-enerji' then jsonb_set(jsonb_set(item,'{title}',to_jsonb('Kiler Seçkisi'::text),true),'{subtitle}',to_jsonb('Kuru gıda ve köy kileri'::text),true) else item end
        order by ordinality
      )
      from jsonb_array_elements(coalesce(public_config->'heroCategories','[]'::jsonb)) with ordinality as rows(item,ordinality)
    ),'[]'::jsonb),
    true
  ),
  '{eventSpotlight}',
  coalesce(public_config->'eventSpotlight','{}'::jsonb)||jsonb_build_object(
    'title','Golden Oremar Davetleri',
    'subtitle','Golden Oremar’ın seçilmiş buluşmalarını keşfedin ve katılımınızı ayırın.'
  ),
  true
),updated_at=timezone('utc',now())
where slug='golden-oremar';

update public.content_entries
set body_markdown=jsonb_build_object(
  'heroTitle','Doğallığın seçkin hali.',
  'heroSubtitle','Kaynağı, üreticisi ve üretim bilgileri doğrulanmış yöresel ürünler. Her ürünü değil, doğru ürünü seçiyoruz.',
  'heroButtonText','Seçkiyi Keşfet',
  'featuredTitle','Golden Oremar Seçkisi',
  'seasonalTitle','Mevsimin Seçkisi',
  'categoriesTitle','Koleksiyonlar',
  'footerText','© 2026 Golden Oremar. Ürün bilgileri belge doğrulama durumuyla birlikte yayımlanır.'
)::text,
updated_at=timezone('utc',now())
where legacy_source='repository-static-content-v1' and legacy_id='interface' and locale='tr' and deleted_at is null;