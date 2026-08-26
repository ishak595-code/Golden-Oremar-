-- Bind the canonical Golden Oremar official storefront identity to the two
-- public brand assets installed in catalog-public. This migration is
-- idempotent and intentionally resolves by stable business slug instead of a
-- generated producer UUID so fresh environments do not depend on production
-- identifiers.
update public.producers
set logo_path='brand/official-store/golden-oremar-profile.webp',
    cover_path='brand/official-store/golden-oremar-cover.webp',
    updated_at=timezone('utc',now())
where slug='golden-oremar'
  and store_kind='official'
  and deleted_at is null;
