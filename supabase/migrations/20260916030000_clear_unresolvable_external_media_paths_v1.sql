-- Data fix: clear media paths that can never resolve.
--
-- Problem observed in production: category cards, some content entries and
-- some events rendered a broken-image icon instead of artwork. Root cause was
-- not code - it was seed data. Those rows stored full external URLs
-- (https://images.unsplash.com/...) in columns the application treats as
-- object keys inside the 'catalog-public' storage bucket. The read path runs
-- every such value through verified_public_storage_path_v1, which correctly
-- refuses to vouch for a path with no matching storage object, so the UI fell
-- through to its error state.
--
-- Fix: null out any media path that is an absolute URL or has no
-- corresponding object in catalog-public. With a null path the UI renders its
-- intended placeholder rather than a broken image. Real photographs will
-- replace these once uploaded.
--
-- Archived and soft-deleted rows are included. They are not user-visible, but
-- a CHECK constraint applies to every row in the table, so leaving them would
-- block the constraint below.
--
-- Secondary reason this is right: the values were third-party stock
-- photographs, not the operator's own images, so serving them from a
-- commercial storefront carried licensing risk regardless of rendering.
--
-- Idempotent: re-running affects nothing once the rows are clean.

UPDATE public.categories
SET image_path = NULL
WHERE image_path IS NOT NULL
  AND (
    image_path ~* '^[a-z][a-z0-9+.-]*:'
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'catalog-public' AND o.name = public.categories.image_path
    )
  );

UPDATE public.content_entries
SET hero_image_path = NULL
WHERE hero_image_path IS NOT NULL
  AND (
    hero_image_path ~* '^[a-z][a-z0-9+.-]*:'
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'catalog-public' AND o.name = public.content_entries.hero_image_path
    )
  );

UPDATE public.events
SET image_path = NULL
WHERE image_path IS NOT NULL
  AND (
    image_path ~* '^[a-z][a-z0-9+.-]*:'
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'catalog-public' AND o.name = public.events.image_path
    )
  );

-- Prevention: stop absolute URLs from being written into these columns again.
-- The upsert functions already reject blob: and data: URIs but accepted
-- http(s), which is how this data arrived. A storage object key is never an
-- absolute URL, so this constraint cannot reject a legitimate value.

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_image_path_not_absolute_url;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_image_path_not_absolute_url
  CHECK (image_path IS NULL OR image_path !~* '^[a-z][a-z0-9+.-]*:');

ALTER TABLE public.content_entries
  DROP CONSTRAINT IF EXISTS content_entries_hero_image_path_not_absolute_url;
ALTER TABLE public.content_entries
  ADD CONSTRAINT content_entries_hero_image_path_not_absolute_url
  CHECK (hero_image_path IS NULL OR hero_image_path !~* '^[a-z][a-z0-9+.-]*:');

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_image_path_not_absolute_url;
ALTER TABLE public.events
  ADD CONSTRAINT events_image_path_not_absolute_url
  CHECK (image_path IS NULL OR image_path !~* '^[a-z][a-z0-9+.-]*:');
