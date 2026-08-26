update public.producers
set logo_path='brand/official-store/golden-oremar-profile.webp',
    cover_path='brand/official-store/golden-oremar-cover.webp',
    updated_at=timezone('utc',now())
where slug='golden-oremar'
  and store_kind='official'
  and deleted_at is null;
