-- Catalogue copy: remove health and farming claims the store cannot document.
--
-- "şifalı" is a health claim, "ilaçsız" and "organik" need certification.
-- The owner approved the plain wording on 2026-10-03. The same texts are
-- already corrected in the shipped offline catalogue; this brings the
-- database in line so the two never disagree.

update public.categories set description = 'Köyden çıkan doğal taşlar, el işi objeler ve yakacak odun.'
where slug = 'dogal-tas-enerji' and description = 'Köyden çıkan şifalı taşlar, el işi objeler ve yakacak odun.';

update public.categories set description = 'Geleneksel yöntemle yetişen taze sebzeler ve dalından meyveler.'
where slug = 'meyve-sebze' and description = 'İlaçsız tarımla yetişen taze sebzeler ve dalından meyveler.';

update public.categories set description = 'Köy yapımı doğal meyve suları, şalgam ve kefir.'
where slug = 'yoresel-icecekler' and description = 'Köy yapımı doğal meyve suları, şalgam ve organik kefir.';

-- The search-engine texts of the same categories.
update public.categories
set seo = jsonb_set(seo, '{description}', to_jsonb(description))
where slug in ('dogal-tas-enerji', 'meyve-sebze', 'yoresel-icecekler')
  and seo ->> 'description' is distinct from description;

update public.categories
set seo = seo || jsonb_build_object('title', 'Bal & Dağ Bitkileri', 'description', 'Karakovan balı, polen ve dağ bitkisi çayları.')
where slug = 'bal-sifa' and (seo ->> 'title' = 'Bal & Şifalı Bitkiler' or seo ->> 'description' = 'Karakovan balı, polen ve şifalı bitki çayları.');

-- Dağ Elması: "ilaçsız" removed from the text and the tag.
update public.products
set short_description = replace(short_description, 'dağ elması; ilaçsız, bir kiloluk filede.', 'dağ elması; bir kiloluk filede.'),
    description = replace(description, 'dağ elması; ilaçsız, bir kiloluk filede.', 'dağ elması; bir kiloluk filede.'),
    tags = array_replace(tags, 'İlaçsız Tarım', 'Geleneksel Tarım')
where slug = 'hakkari-dag-elmasi-801';

-- The storefront reads product cards from the snapshot.
select private.refresh_catalog_card_snapshot_v1();
