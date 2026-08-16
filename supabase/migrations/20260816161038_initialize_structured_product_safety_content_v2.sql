create table if not exists private.content_entry_public_archives (
  content_entry_id uuid not null references public.content_entries(id) on delete cascade,
  migration_key text not null,
  archived_at timestamptz not null default timezone('utc',now()),
  summary text not null,
  body_markdown text not null,
  body_html_sanitized text not null,
  tags text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  primary key(content_entry_id,migration_key)
);
alter table private.content_entry_public_archives enable row level security;
drop policy if exists content_entry_public_archives_deny_all on private.content_entry_public_archives;
create policy content_entry_public_archives_deny_all on private.content_entry_public_archives for all using(false) with check(false);
revoke all on private.content_entry_public_archives from public,anon,authenticated;

insert into private.content_entry_public_archives(content_entry_id,migration_key,summary,body_markdown,body_html_sanitized,tags,metadata)
select id,'initialize_structured_product_safety_content_v2',summary,body_markdown,body_html_sanitized,tags,metadata
from public.content_entries
where content_type='product_health' and status='published' and deleted_at is null
on conflict(content_entry_id,migration_key) do nothing;

update public.content_entries ce
set metadata=jsonb_set(coalesce(ce.metadata,'{}'::jsonb),'{safetyV2}',
  '{"schemaVersion":2,"guidanceKind":"food_safety","safetyClass":"general_food","storage":{"title":"Saklama","items":["Ürün etiketindeki saklama koşullarını ve tavsiye edilen tüketim tarihini izleyin.","Ambalaj hasarı, küf, olağandışı koku veya görünüm varsa ürünü kullanmayın."]},"preparation":{"title":"Kullanım","items":["Ambalaj veya ürün bilgi kartındaki kullanım talimatını izleyin.","Ürüne özel içerik ve porsiyon bilgisi doğrulanmadıysa sağlık amacıyla doz önerisi yapılmaz."]},"warnings":[{"code":"label_first","severity":"info","text":"Ürüne özel içerik, alerjen, lot, son tüketim veya tavsiye edilen tüketim ve saklama bilgileri varsa ambalaj etiketi esas alınır."}],"allergens":{"known":[],"verifyLabel":true,"text":"İçindekiler ve olası alerjenler ürün etiketinden doğrulanmalıdır; doğrulanmamış alerjen bilgisi varsayılmaz."},"verificationNeeded":["Lot/etiket ve saklama bilgisi","Ürüne özel içerik/alerjen bilgisi"],"claimPolicy":"İçerik genel gıda veya ürün güvenliği bilgisidir; hastalık tanısı, tedavisi veya önlenmesi iddiası değildir.","sources":[]}'::jsonb,true),
    updated_at=timezone('utc',now())
where ce.content_type='product_health' and ce.status='published' and ce.deleted_at is null;

update public.content_entries ce set metadata=jsonb_set(jsonb_set(metadata,'{safetyV2,safetyClass}','"non_food_safety"'::jsonb,true),'{safetyV2,guidanceKind}','"non_food_safety"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug in ('el-islemesi-tahta-kasik-ve-yayik-tokmagi-704','koyun-efsanevi-beyaz-isitma-pres-tasi-402','sobalik-mese-yarigi-403');
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"honey"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug in ('avasin-mese-bali-103','bercelan-yaylasi-bahar-cicek-bali-102','daglica-karakovan-petek-bali-101');
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"raw_milk"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='gunluk-taze-civik-sut-sagimdan-kapiya-204';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"dairy"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug in ('havahan-in-otlu-dag-peyniri-203','merez-hatun-un-magara-tulum-peyniri-201','naciye-nin-yayik-tereyagi-202','taze-yayik-ayrani-canli-kultur-205','kekik-aromali-kesik-yogurt-kurud-703');
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"lamb"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='abidin-in-yayla-kuzusu-302';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"goat"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='fahrettin-in-sutten-kesilmis-oglagi-303';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"poultry"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='salih-in-meralik-ozgur-horozu-304';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"fish"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='avasin-deresi-canli-alabaligi-ozel-hasat-301';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"egg"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='amine-nin-cifte-sari-koy-yumurtasi-305';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"animal_fat"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='gunes-sirri-guzu-yagi-ic-yag-701';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"wild_mushroom"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='sessiz-orman-kuzu-gobegi-mantari-601';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"fresh_produce"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug in ('dag-cilegi-yabani-803','hakkari-dag-elmasi-801','kitir-taze-cagla-badem-806','yuksekova-yayla-domatesi-802');
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"water"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='avasin-cam-damacana-suyu-401';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"salt"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='kirik-tas-kaya-tuzu-blogu-kristal-603';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"distillate"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p where p.id=ce.related_product_id and p.slug='ata-tohumu-dag-kekigi-suyu-distile-807';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"processed_beverage"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p join public.categories c on c.id=p.category_id where p.id=ce.related_product_id and c.slug='yoresel-icecekler' and p.slug<>'taze-yayik-ayrani-canli-kultur-205';
update public.content_entries ce set metadata=jsonb_set(metadata,'{safetyV2,safetyClass}','"dry_pantry"'::jsonb,true),updated_at=timezone('utc',now()) from public.products p join public.categories c on c.id=p.category_id where p.id=ce.related_product_id and c.slug='kurutulmus-gida-kiler';

update public.content_entries ce set summary=case ce.metadata#>>'{safetyV2,safetyClass}'
 when 'honey' then 'Balın saklama, çocuklarda kullanım uyarısı ve lot/analiz doğrulama bilgileri.'
 when 'raw_milk' then 'Çiğ sütün soğuk zincir, pastörizasyon riski, süt alerjeni ve güvenli kullanım bilgileri.'
 when 'dairy' then 'Süt ürününün saklama veya soğuk zincir, alerjen ve etiket doğrulama bilgileri.'
 when 'lamb' then 'Kuzu etinin soğuk zincir, çapraz bulaşma ve güvenli iç sıcaklık bilgileri.'
 when 'goat' then 'Oğlak etinin soğuk zincir, çapraz bulaşma ve güvenli iç sıcaklık bilgileri.'
 when 'poultry' then 'Kümes hayvanı etinin soğuk zincir ve güvenli pişirme sıcaklığı bilgileri.'
 when 'fish' then 'Balığın soğuk zincir, balık alerjeni ve güvenli pişirme sıcaklığı bilgileri.'
 when 'egg' then 'Yumurtanın soğuk saklama, yumurta alerjeni ve güvenli pişirme bilgileri.'
 when 'wild_mushroom' then 'Yabani mantarda tür doğrulaması, soğuk saklama ve toksin riski bilgileri.'
 when 'fresh_produce' then 'Taze ürünün yıkama, çapraz bulaşmadan koruma ve uygun saklama bilgileri.'
 when 'water' then 'İçme suyunda kaynak, dolum, mühür ve analiz doğrulama bilgileri.'
 when 'non_food_safety' then 'Gıda dışı ürün için güvenli kullanım ve ürün doğrulama bilgileri.'
 else 'Ürünün saklama, kullanım, alerjen ve etiket doğrulama bilgileri.' end,
 updated_at=timezone('utc',now())
where ce.content_type='product_health' and ce.status='published' and ce.deleted_at is null and btrim(coalesce(ce.summary,''))='';