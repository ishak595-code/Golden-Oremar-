-- Customers read "demo" in every published product story (2026-10-01).
--
-- The seed stories said "Golden Oremar bu demo anlatıda ..." and one season
-- note called the summer window a "demo" season. To a shopper that reads as
-- a fake shop. Only published products change; drafts keep their working
-- notes. Each replacement touches one exact phrase, so hand-edited text is
-- never rewritten.

update public.products
   set story = replace(replace(story,
         'Golden Oremar bu demo anlatıda ürünü efsaneleştirmek yerine',
         'Golden Oremar bu anlatıda ürünü efsaneleştirmek yerine'),
         'Bu demo anlatıda Kırklareli Üretim Kooperatifinden',
         'Bu anlatıda Kırklareli Üretim Kooperatifinden'),
       updated_at = now()
 where status = 'published'
   and (story like '%Golden Oremar bu demo anlatıda ürünü efsaneleştirmek yerine%'
     or story like '%Bu demo anlatıda Kırklareli Üretim Kooperatifinden%');

update public.product_commerce_profiles pc
   set customer_season_note = 'Yüksekova yaz sebzeciliğinde yoğun sezon Temmuz-Eylül aylarıdır; kesin dönem üretici tarafından doğrulanır.',
       updated_at = now()
  from public.products p
 where p.id = pc.product_id
   and p.status = 'published'
   and pc.customer_season_note = 'Yüksekova yaz sebzeciliği için Temmuz-Eylül demo yoğun sezonudur; gerçek dönem üretici tarafından doğrulanır.';
