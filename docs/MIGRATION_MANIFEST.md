# Golden Oremar Supabase Migration Manifest

Project ref: `rmfcziawxjgcnxexbrvw`

## Authoritative state

The linked live Supabase project is the execution source of truth for the complete applied schema history. The repository `supabase/migrations/` directory is the version-controlled SQL record for the current hardening series plus migration bodies that have been explicitly reconciled back into source control.

Verified on 2026-08-19:

- Applied live migrations: **154**
- Latest live migration: `20260819055617_extend_admin_producer_application_location_snapshot`
- Current application branch: `agent/admin-supabase-retire-node`
- Pull request: `#47`
- Latest Security Advisor check after current DDL changes: **0 security lints**
- Current hardening reconciliation: **all live DDL created during this active hardening continuation is recorded under `supabase/migrations/`**

Do not infer from the 154 live migration count that the repository contains 154 historical SQL files. The live `supabase_migrations.schema_migrations` table is the authoritative complete applied history and stores each migration version/name plus its SQL statement array. The repository contains the current source-controlled hardening history and recovered historical migration bodies, but older live history may predate full repository reconciliation.

This distinction is intentional and truthful. A previous version of this document manually duplicated counts and claimed both 78 and 90 migrations while live history had already advanced. The documentation no longer maintains a third hand-copied full migration list.

## Canonical repository location

All migration SQL that is retained in the working tree now belongs under:

`supabase/migrations/`

The obsolete second path `backend/live-migrations/` has been removed. Its six unique SQL blobs were moved byte-for-byte into the canonical directory before deletion of the duplicate folder:

- `20260816062936_add_my_product_batch_editor_v1.sql`
- `20260816120247_add_atomic_customer_return_evidence_v3.sql`
- `20260816120431_complete_return_options_and_admin_evidence_detail.sql`
- `20260816123842_add_public_producer_product_inventory_truth.sql`
- `20260816125511_add_secure_producer_order_fulfillment_v1.sql`
- `20260816185944_fix_public_storefront_brand_name_v1.sql`

The untimestamped `add_my_product_batch_editor_v1.sql` legacy file was matched against live migration history and stored under its real applied version `20260816062936`.

## Current hardening continuation

Recent production-hardening migrations include:

- `20260818211256_require_explicit_shipping_country_in_order_v4`
- `20260818211654_retire_legacy_customer_order_rpc_entrypoints`
- `20260818220857_harden_social_auth_profile_bootstrap`
- `20260818221203_add_secure_customer_payment_method_vault`
- `20260818221431_extend_persistent_gift_presentation_metadata`
- `20260818221636_add_server_authoritative_gift_checkout_preview`
- `20260818222303_add_international_customer_address_upsert_v2`
- `20260818222835_add_customer_payment_method_management_v2`
- `20260818223433_add_customer_payment_method_nickname_and_metadata`
- `20260818223926_bind_saved_payment_method_to_customer_orders_v5`
- `20260818224110_proxy_customer_payment_method_rpcs_v2`
- `20260818224905_add_provider_card_vault_service_contract`
- `20260818225209_publish_payment_card_enrollment_readiness_v3`
- `20260818225524_add_management_order_gift_and_payment_snapshot_v2`
- `20260818225604_retire_direct_customer_payment_method_removal_rpc`
- `20260818230254_persist_customer_app_theme_and_sound_preferences`
- `20260818231223_fail_closed_missing_catalog_public_assets_v2`
- `20260818231323_route_public_catalog_rpcs_through_verified_assets`
- `20260818231654_require_real_catalog_assets_for_admin_product_readiness`
- `20260818231800_align_admin_product_image_readiness_to_storage`
- `20260818232135_fail_closed_missing_content_public_assets`
- `20260818232416_harden_producer_catalog_public_storage_policies`
- `20260818232517_verify_producer_product_gallery_assets`
- `20260819000204_harden_producer_traceability_country_and_review_status`
- `20260819055042_fix_admin_inventory_variant_filter`
- `20260819055617_extend_admin_producer_application_location_snapshot`

## Migration invariants

- Applied migrations are never deleted from live history to make the working tree look cleaner.
- Obsolete runtime implementations and duplicate migration folders may be removed only after required unique SQL is preserved in the canonical location.
- Any new live DDL migration created during this branch must be recorded under `supabase/migrations/` before that checkpoint is considered reconciled.
- Live migration count must be checked from `supabase_migrations.schema_migrations`; documentation counts are informational snapshots only.
- Client code must not depend on a schema field that is absent from the live project.
- Admin inventory must not reference the nonexistent `product_variants.deleted_at` column.
- Producer application admin snapshots must preserve structured country, province, district and village provenance.
- `backend/live-migrations/` must not return as a second migration source.
