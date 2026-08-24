# Golden Oremar Task 3 - Production Media Integrity Closeout

## Certified lineage

- Task 2 certified head: `1edbdb03b85cb8db0f4ae73c96e7a526113695d9`.
- Task 2 PR: `#63 Close staff MFA production security and recovery contract`.
- Task 2 merged to `main` after successful `Mobile Quality Gate` run #1341.
- Task 2 merge SHA: `118dde0acd8d8fdb45a93391da37ebdf4e50f91c`.
- Task 3 forensic baseline remains `docs/task3-product-media-forensic-matrix.md`.

## Root cause

The live catalog had 42 published/active products and 42 `public.product_images` rows, but the `catalog-public` bucket contained zero corresponding objects. Historical inspection established that catalog image metadata had been localized to `/images/products/*.webp` without transferring the binary assets. Historical Unsplash/demo references are not authentic product media and remain disqualified as recovery sources.

No authentic product binary was found in the inspected repository/history or live Storage. No stock, Unsplash, generated, or fabricated image was introduced during remediation.

## Production remediation

Applied live Supabase migration:

`20260824172652_harden_product_media_integrity_lifecycle_v1`

The migration establishes one canonical server-side product-media integrity contract:

1. `private.verified_catalog_product_image_path_v1` accepts only an existing, non-archived, non-delete-marker object in `catalog-public` with approved image MIME, matching extension, and size between 1 byte and 10 MiB.
2. `private.product_media_integrity_ok_v1` requires 1-10 valid images, exactly one primary image, and no invalid gallery reference.
3. `private.enforce_product_image_storage_v1` now validates Storage object integrity for producer, admin, and internal writes. The former admin object-existence bypass is removed.
4. Producer media remains constrained to owned `<producer-id>/products/<random-file>` paths.
5. Deferred constraint triggers protect the final committed state of both `public.products` and `public.product_images`. A published active product cannot commit without valid media, while an atomic old-image/new-image replacement transaction remains possible.
6. Admin Storage update/delete policies no longer allow a referenced `catalog-public` object to be overwritten or deleted.
7. Existing published products with invalid media were quarantined by setting `is_active=false`. Records, moderation state, audit history, prices, inventory, and product identity were preserved.

## Post-migration production evidence

Immediately after migration:

- Published + active products: `0`.
- Published + active products failing media integrity: `0`.
- Published, inactive, quarantined products failing media integrity: `42`.
- Existing `product_images` rows: `42`.
- Existing invalid `product_images` rows: `42`.
- `catalog-public` Storage objects: `0`.

This is intentional fail-closed behavior. The platform no longer publicly exposes products whose media claims cannot be backed by a real Storage object.

## Negative tests executed against production schema

- Reactivating a quarantined published product and forcing the deferred product-media constraint to `IMMEDIATE` raised the expected `check_violation`; the test transaction rolled back.
- Re-writing an invalid legacy product image path triggered the strict product-image Storage guard and raised the expected invalid-parameter error; the test transaction rolled back.

These tests prove that the former broken state cannot be reintroduced through normal product/image writes.

## CI regression protection

Added `scripts/product-media-integrity-contract-audit.mjs` and wired it into `audit:release`. The full `audit:all` runner also discovers it automatically because it executes every `*-audit.mjs` script.

The contract audit locks the following invariants:

- real Storage object existence;
- image MIME and 10 MiB ceiling;
- delete-marker/archive rejection;
- 1-10 image limit and exactly one primary;
- deferred publish and gallery integrity constraints;
- admin referenced-object delete/update protection;
- producer randomized immutable uploads with partial-upload cleanup;
- forensic prohibition on demo/stock media recovery.

## Authentic media recovery procedure

A quarantined product may be reactivated only after genuine product photography is available:

1. Upload the authentic image through the approved producer/admin media flow to `catalog-public`.
2. Use a canonical immutable object path and approved image MIME/size.
3. Replace the product's legacy `product_images` references in one transaction, with exactly one primary image.
4. Let the deferred integrity constraints validate the final state.
5. Complete normal moderation/review checks.
6. Set the product active only after `private.product_media_integrity_ok_v1(product_id)` is true through the controlled server workflow.

Never backfill the 42 products with Unsplash, generated imagery, unrelated stock photography, or invented previous assets.

## Closeout classification

The software/data-integrity defect is remediated and fail-closed. Authentic product photography remains a real content dependency, not something software can truthfully reconstruct. Until genuine binaries are supplied, the affected products correctly remain quarantined from the public catalog.
