do $$
declare
  current_interface jsonb;
begin
  update public.brand_settings
  set public_config = jsonb_set(
    jsonb_set(
      coalesce(public_config,'{}'::jsonb),
      '{homeSections}',
      '[{"id":"featured","title":"En Çok Tercih Edilenler","active":true},{"id":"pre_order","title":"Kişiye Özel Ön Siparişler","active":true},{"id":"natural","title":"Doğal Seçimler","active":true},{"id":"seasonal","title":"Mevsimin Hasadı","active":true},{"id":"best_sellers","title":"En Çok Satanlar","active":true},{"id":"new_arrivals","title":"Yeni Keşifler","active":true},{"id":"offers","title":"Günün Fırsatları","active":true}]'::jsonb,
      true
    ),
    '{appearance}',
    '{"defaultTheme":"custom","colorScheme":"dark","tokens":{"background":"#07100D","card":"#0B1B15","text":"#F4F3EE","muted":"#AAB9B1","border":"#1E3A2F","brandGold":"#D9B85C","brandGreen":"#1F9D63","brandEarth":"#B7663A","onGold":"#182015","onGreen":"#05120D"}}'::jsonb,
    true
  )
  where slug='golden-oremar';
  if not found then raise exception 'brand_configuration_missing'; end if;

  select body_markdown::jsonb into current_interface
  from public.content_entries
  where deleted_at is null
    and status='published'
    and legacy_source='repository-static-content-v1'
    and legacy_id='interface'
    and locale='tr'
  order by published_at desc nulls last, updated_at desc
  limit 1;

  update public.content_entries
  set body_markdown = jsonb_build_object(
    'heroTitle','Bugünün Önerisi',
    'heroSubtitle','Golden Oremar’ın seçkin ürünlerinden bugün sizin için özel olarak öne çıkan fırsat.',
    'heroButtonText','Öneriyi Keşfet',
    'featuredTitle','En Çok Tercih Edilenler',
    'seasonalTitle','Mevsimin Hasadı',
    'categoriesTitle','Kategoriler',
    'footerText',coalesce(current_interface->>'footerText','© 2026 Golden Oremar.')
  )::text,
  updated_at=now()
  where id=(
    select id from public.content_entries
    where deleted_at is null
      and status='published'
      and legacy_source='repository-static-content-v1'
      and legacy_id='interface'
      and locale='tr'
    order by published_at desc nulls last, updated_at desc
    limit 1
  );
  if not found then raise exception 'storefront_interface_missing'; end if;
end $$;
