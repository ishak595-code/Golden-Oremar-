-- Schema drift closure, final part: storage buckets, standalone sequences and
-- the catalogue view. This completes the drift closure effort.
--
-- Three object classes, each handled on its own terms:
--
-- 1. Storage buckets (10). Emitted as inserts into storage.buckets with
--    ON CONFLICT DO UPDATE, because buckets are rows rather than DDL objects.
--    The MIME allow-lists and size ceilings are the point: they are the outer
--    boundary that stops an oversized or wrong-typed upload before any
--    application code runs. Note catalog-public is the only bucket accepting
--    video, and user-private has the tightest ceiling at 5 MB. Four buckets
--    are public and six are private - getting that flag wrong on
--    producer-documents or accounting-receipts would expose KYC paperwork and
--    financial records, so it is stated explicitly here rather than left to
--    dashboard configuration.
--
-- 2. Sequences. Only two of the fourteen live sequences are emitted. The other
--    twelve are identity-column sequences created implicitly by
--    GENERATED ALWAYS AS IDENTITY and already arrive with their tables;
--    recreating them separately would produce orphans. Verified against
--    pg_depend rather than inferred from naming.
--    order_number_seq deliberately starts at 1001 so the first real order does
--    not read as GO-YYYYMMDD-00000001 - a small dignity choice that would be
--    silently lost in a rebuild that defaulted it to 1.
--
-- 3. The catalogue view, taken verbatim from pg_get_viewdef
--    (fe16a1930f9242858d3c680febf2d764). It encodes the same visibility chain
--    the RLS policies enforce - product published, active, not deleted; its
--    category active; its producer active, verified, not deleted - and picks
--    the primary image via a LATERAL join ordered by is_primary, sort_order,
--    created_at.
--
-- Applying is a no-op against the live project.

-- 1. storage buckets

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('accounting-receipts', 'accounting-receipts', false, 15728640, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('catalog-public',      'catalog-public',      true,  52428800, ARRAY['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime']),
  ('content-public',      'content-public',      true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/avif']),
  ('event-public',        'event-public',        true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/avif']),
  ('message-attachments', 'message-attachments', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/avif','application/pdf']),
  ('producer-documents',  'producer-documents',  false, 20971520, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('product-certificates','product-certificates',false, 20971520, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('return-evidence',     'return-evidence',     false, 15728640, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('review-media',        'review-media',        false, 8388608,  ARRAY['image/jpeg','image/png','image/webp','image/avif']),
  ('user-private',        'user-private',        false, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. standalone sequences

CREATE SEQUENCE IF NOT EXISTS private.store_number_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- 3. catalogue view

CREATE OR REPLACE VIEW public.catalog_product_cards AS
 SELECT product.id,
    product.slug,
    product.name,
    product.short_description,
    product.unit_label,
    product.base_price_minor,
    product.compare_at_price_minor,
    product.currency,
    product.tags,
    product.is_featured,
    product.published_at,
    product.category_id,
    category.slug AS category_slug,
    category.name AS category_name,
    product.producer_id,
    producer.slug AS producer_slug,
    producer.display_name AS producer_name,
    producer.is_verified AS producer_is_verified,
    primary_image.storage_path AS primary_image_path,
    primary_image.alt_text AS primary_image_alt
   FROM products product
     JOIN categories category ON category.id = product.category_id
     JOIN producers producer ON producer.id = product.producer_id
     LEFT JOIN LATERAL ( SELECT image.storage_path,
            image.alt_text
           FROM product_images image
          WHERE image.product_id = product.id
          ORDER BY image.is_primary DESC, image.sort_order, image.created_at
         LIMIT 1) primary_image ON true
  WHERE product.status = 'published'::text AND product.is_active = true AND product.deleted_at IS NULL AND category.is_active = true AND producer.status = 'active'::text AND producer.is_verified = true AND producer.deleted_at IS NULL;

GRANT SELECT ON public.catalog_product_cards TO anon, authenticated;
