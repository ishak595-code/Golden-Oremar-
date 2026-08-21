update public.brand_settings
set public_config=jsonb_set(
      coalesce(public_config,'{}'::jsonb),
      '{appSettings}',
      coalesce(public_config->'appSettings','{}'::jsonb)||jsonb_build_object(
        'logoUrl','/logo.svg',
        'icon192Url','/icon-192.png',
        'icon512Url','/icon-512.png',
        'maskableIcon512Url','/icon-maskable-512.png',
        'assetSource','repository_public_assets'
      ),
      true
    ),
    updated_at=timezone('utc',now())
where slug='golden-oremar';
