# Golden Oremar Supabase Migration Manifest

Project ref: `rmfcziawxjgcnxexbrvw`

## Authoritative state

The linked live Supabase project is the execution source of truth for applied schema history. Repository SQL files under `supabase/migrations/` are the version-controlled implementation record and must remain aligned with the live history for every migration created during this hardening branch.

Verified on 2026-08-19:

- Applied live migrations: **154**
- Latest live migration: `20260819055617_extend_admin_producer_application_location_snapshot`
- Current application branch: `agent/admin-supabase-retire-node`
- Pull request: `#47`
- Migration reconciliation state: **live history and current feature-branch hardening files aligned**

The manifest intentionally does not duplicate all 154 migration filenames. The complete ordered history already exists in two canonical locations:

1. Live `supabase_migrations.schema_migrations`
2. Repository `supabase/migrations/`

Keeping a third manually copied full list here previously caused this document to claim both 78 and 90 migrations while the live project had already advanced much further. That duplicate list is retired rather than allowed to become another stale source of truth.

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

## Current migration invariants

- Applied migrations are never deleted from live history to make the working tree look cleaner.
- Obsolete runtime implementations are removed from active code, but schema history is retained for reproducibility and auditability.
- A new live DDL migration created during this branch must also be recorded under `supabase/migrations/` before the checkpoint is considered reconciled.
- Client code must not depend on a schema field that is absent from the live project.
- Admin inventory must not reference the nonexistent `product_variants.deleted_at` column.
- Producer application admin snapshots must preserve structured country, province, district and village provenance.
- No migration count in documentation may be treated as authoritative without checking `supabase_migrations.schema_migrations`.
