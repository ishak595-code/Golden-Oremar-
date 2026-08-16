do $migration$
declare
  trout_id uuid;
  persimmon_id uuid;
  cheese_id uuid;
begin
  select id into trout_id from public.products where slug='avasin-deresi-canli-alabaligi-ozel-hasat-301' and deleted_at is null limit 1;
  select id into persimmon_id from public.products where slug='kislik-kurutulmus-cennet-hurmasi-808' and deleted_at is null limit 1;
  select id into cheese_id from public.products where slug='havahan-in-otlu-dag-peyniri-203' and deleted_at is null limit 1;

  if trout_id is null or persimmon_id is null or cheese_id is null then
    raise exception 'live_catalog_reference_missing';
  end if;

  update public.brand_settings
  set public_config = jsonb_set(
        public_config,
        '{heroCategories}',
        coalesce((
          select jsonb_agg(
            case item->>'targetCategory'
              when 'bal-sifa' then jsonb_set(item,'{image}',to_jsonb('/images/products/101-karakovan-petek-bali.webp'::text),true)
              when 'sut-sarkuteri' then jsonb_set(item,'{image}',to_jsonb('/images/products/203-otlu-dag-peyniri.webp'::text),true)
              when 'dag-mahsulleri' then jsonb_set(item,'{image}',to_jsonb('/images/products/601-kuzu-gobegi-mantari.webp'::text),true)
              when 'kiler' then jsonb_set(item,'{image}',to_jsonb('/images/products/506-isli-kaya-uzumleri.webp'::text),true)
              else item - 'image'
            end
            order by ordinal
          )
          from jsonb_array_elements(coalesce(public_config->'heroCategories','[]'::jsonb)) with ordinality as entries(item,ordinal)
        ),'[]'::jsonb),
        true
      ),
      updated_at = timezone('utc',now())
  where slug='golden-oremar';

  update public.content_entries
  set title='Fırında Limonlu Avaşin Alabalığı',
      summary='Avaşin Deresi Canlı Alabalığı ile hazırlanan, limon ve zeytinyağıyla sade bir fırın tarifi.',
      body_markdown='Malzemeler:\n- 2 adet temizlenmiş Avaşin Deresi alabalığı\n- 3 yemek kaşığı zeytinyağı\n- 1 limonun suyu ve birkaç ince limon dilimi\n- İsteğe göre 1 tatlı kaşığı kuru kekik\n- Tuz ve taze çekilmiş karabiber\n\nHazırlanışı:\n1. Fırını 200 dereceye ısıtın.\n2. Zeytinyağı, limon suyu, kekik, tuz ve karabiberi karıştırın.\n3. Temizlenmiş alabalıkları sosla kaplayıp yağlı kağıt serili tepsiye alın.\n4. Üzerlerine limon dilimlerini yerleştirin.\n5. Balığın kalınlığına göre yaklaşık 18-25 dakika, eti opaklaşıp kolayca ayrılana kadar pişirin.\n6. Fırından aldıktan sonra bekletmeden servis edin.',
      hero_image_path='/images/products/301-avasin-alabaligi.webp',
      related_product_id=trout_id,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('catalogAligned',true,'catalogAlignedAt',timezone('utc',now())),
      updated_at=timezone('utc',now())
  where id='e499e10b-fcbf-46e9-b911-0b74b4604228';

  update public.content_entries
  set title='Cennet Hurmalı, Cevizli ve Karakovan Ballı Enerji Topları',
      summary='Kurutulmuş cennet hurması, ceviz ve Karakovan balıyla hazırlanabilen pişirmesiz bir atıştırmalık.',
      body_markdown='Malzemeler:\n- 1 su bardağı doğranmış Kışlık Kurutulmuş Cennet Hurması\n- Yarım su bardağı ceviz içi\n- 1-2 yemek kaşığı Dağlıca Karakovan Petek Balından süzülen bal\n- 1 çay kaşığı tarçın\n- İsteğe göre bulamak için Hindistan cevizi\n\nHazırlanışı:\n1. Kurutulmuş cennet hurmalarını çok sertse birkaç dakika ılık suda bekletip iyice süzün.\n2. Cevizi mutfak robotunda iri parçalı kalacak şekilde çekin.\n3. Hurma, bal ve tarçını ekleyip şekil verilebilen bir karışım oluşana kadar kısa aralıklarla çekin.\n4. Karışımı 15 dakika buzdolabında dinlendirin.\n5. Küçük parçalar alıp yuvarlayın ve isterseniz Hindistan cevizine bulayın.\n6. Kapalı bir kapta buzdolabında saklayın.',
      hero_image_path='/images/products/808-kurutulmus-cennet-hurmasi.webp',
      related_product_id=persimmon_id,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('catalogAligned',true,'catalogAlignedAt',timezone('utc',now())),
      updated_at=timezone('utc',now())
  where id='a9d8aea9-ed59-4856-a28c-009cbc2a6fec';

  update public.content_entries
  set title='Otlu Dağ Peynirli ve Cevizli Ev Yapımı Pide',
      summary='Havahan''ın Otlu Dağ Peyniri ve cevizle hazırlanan ev tipi kapalı pide tarifi.',
      body_markdown='Malzemeler:\n- Hamur için 3 su bardağı un\n- 1 tatlı kaşığı kuru maya\n- 1 çay kaşığı tuz\n- Yaklaşık 1 su bardağı ılık su\n- İç harcı için 250 g Havahan''ın Otlu Dağ Peyniri\n- Yarım su bardağı iri kırılmış ceviz\n- 1 yumurta\n\nHazırlanışı:\n1. Un, maya, tuz ve ılık suyla yumuşak bir hamur yoğurun. Üzerini kapatıp yaklaşık 45 dakika mayalandırın.\n2. Peyniri ufalayın, ceviz ve yumurtayla karıştırın.\n3. Hamuru bezelere ayırıp uzunlamasına açın. İç harcı ortasına yayın.\n4. Kenarları içe kıvırarak pide biçimi verin.\n5. Önceden ısıtılmış 200 derece fırında hamur kızarıp iç harç tamamen ısınana kadar pişirin.\n6. Fırından çıktıktan sonra birkaç dakika dinlendirip servis edin.',
      hero_image_path='/images/products/203-otlu-dag-peyniri.webp',
      related_product_id=cheese_id,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('catalogAligned',true,'catalogAlignedAt',timezone('utc',now())),
      updated_at=timezone('utc',now())
  where id='e07b00e2-c99d-4dfc-9241-5673a631880b';
end
$migration$;
