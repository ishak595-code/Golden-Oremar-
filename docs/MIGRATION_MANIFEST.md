# Golden Oremar Supabase Migration Manifest

Project ref: `rmfcziawxjgcnxexbrvw`

The live Supabase database is the current source of truth. The SQL bodies are retained in `supabase_migrations.schema_migrations` in the live project. The live project currently contains **78 applied migrations**. Full SQL bodies remain retained in `supabase_migrations.schema_migrations`; this manifest is kept in sync with the live project.

## Migrations

- `20260814164554_initial_golden_oremar_foundation.sql`
- `20260814164831_harden_indexes_and_rls.sql`
- `20260814164917_deny_internal_public_tables.sql`
- `20260814165300_support_brand_and_collective_producers.sql`
- `20260814165413_add_lossless_legacy_staging.sql`
- `20260814170120_expose_catalog_inventory_read_only.sql`
- `20260814172931_secure_public_submissions.sql`
- `20260814175418_secure_admin_operations.sql`
- `20260814175604_fix_admin_campaign_upsert.sql`
- `20260814182016_harden_admin_rpc_invoker.sql`
- `20260814183239_secure_customer_checkout.sql`
- `20260814185240_secure_customer_profile_features.sql`
- `20260814185934_fix_profile_update_privileges.sql`
- `20260814194538_refresh_public_catalog_and_content.sql`
- `20260814194559_enforce_truthful_public_content.sql`
- `20260814194820_archive_orphan_product_information.sql`
- `20260814195701_update_verified_product_assets.sql`
- `20260814195706_consolidate_authenticated_rls_policies.sql`
- `20260814205939_localize_all_product_images.sql`
- `20260814211557_secure_producer_onboarding.sql`
- `20260814213608_extend_producer_compliance_and_location.sql`
- `20260814215631_resume_producer_application_and_accept_pending_compliance.sql`
- `20260814215713_add_truthful_village_product_plan.sql`
- `20260814215751_harden_v3_producer_review.sql`
- `20260815004656_proxy_privileged_producer_rpcs.sql`
- `20260815010331_secure_producer_profile_and_directory.sql`
- `20260815035910_secure_platform_configuration_and_users.sql`
- `20260815040625_secure_catalog_content_and_event_management.sql`
- `20260815041010_secure_order_return_and_fulfillment_management.sql`
- `20260815214757_structure_producer_village_location.sql`
- `20260815215221_add_product_batch_traceability.sql`
- `20260815215314_harden_product_batch_traceability_rpcs.sql`
- `20260815215705_harden_payment_confirmation_and_inventory_sale.sql`
- `20260815215747_add_global_shipping_zone_foundation.sql`
- `20260815215838_guard_checkout_with_shipping_availability.sql`
- `20260815215921_complete_item_level_return_and_refund_flow.sql`
- `20260815220041_add_global_variant_checkout_v2.sql`
- `20260815220542_confirm_orders_only_after_captured_payment.sql`
- `20260815220651_add_secure_promotion_engine_foundation.sql`
- `20260815220713_secure_campaign_and_coupon_management.sql`
- `20260815220802_apply_promotions_atomically_in_checkout.sql`
- `20260815221004_add_producer_financial_ledger_and_payouts.sql`
- `20260815221021_snapshot_producer_commission_at_order_time.sql`
- `20260815221051_add_producer_balance_and_payout_workflows.sql`
- `20260815221241_add_international_product_export_gates.sql`
- `20260815221412_secure_verified_review_and_trust_workflow.sql`
- `20260815221605_complete_secure_mobile_messaging.sql`
- `20260815221748_add_secure_mobile_push_notification_pipeline.sql`
- `20260815221849_add_review_and_message_storage_buckets.sql`
- `20260815222011_add_mobile_catalog_search_and_autocomplete.sql`
- `20260815222137_fix_catalog_search_category_slug_collision.sql`
- `20260815222243_enforce_verified_producer_catalog_visibility.sql`
- `20260815222559_complete_producer_product_moderation_and_inventory.sql`
- `20260815222858_secure_customer_cart_rpc.sql`
- `20260815222948_harden_customer_profile_addresses_and_favorites.sql`
- `20260815223058_add_customer_account_closure_requests.sql`
- `20260815223125_add_missing_foreign_key_indexes.sql`
- `20260815223322_harden_public_forms_and_event_capacity.sql`
- `20260815223411_add_stock_alerts_and_double_opt_in_newsletter.sql`
- `20260815224144_add_admin_operations_overview.sql`
- `20260815224207_fix_admin_operations_refund_status.sql`
- `20260815224336_complete_customer_profile_account_overview.sql`
- `20260815224413_harden_verified_producer_profile_edits.sql`
- `20260815224432_add_producer_location_change_requests.sql`
- `20260815224505_add_public_producer_profile_directory.sql`
- `20260815224543_preserve_legacy_producer_location_labels.sql`
- `20260815225604_add_explicit_producer_origin_verification.sql`
- `20260815225839_complete_producer_onboarding_resume_v4.sql`
- `20260815225849_add_customer_review_dashboard_v1.sql`

## Latest verified continuation

- `20260815230208_add_public_product_detail_v1.sql`
- `20260815230244_sanitize_public_product_detail_legacy_metadata.sql`
- `20260815230829_complete_customer_account_shopping_hub.sql`
- `20260815230843_explicitly_deny_private_account_social_tables.sql`
- `20260815230920_complete_account_overview_and_payment_activity.sql`
- `20260815231151_add_account_help_content_v1.sql`
- `20260815231309_add_my_producer_dashboard_v1.sql`
- `20260816041742_add_secure_checkout_preview_v1.sql`
- `20260816042124_normalize_customer_cart_variant_options.sql`

## 2026-08-16 cumulative continuation

- `20260816043338_add_public_category_directory_v1.sql`
- `20260816043557_add_public_home_catalog_v1.sql`
- `20260816044558_add_public_engagement_catalog_v1.sql`
- `20260816044834_add_my_newsletter_status_v1.sql`
- `20260816045025_add_public_content_library_v1.sql`
- `20260816045057_add_customer_content_favorites_v1.sql`
- `20260816045422_add_public_storefront_config_v1.sql`
- `20260816045729_remove_placeholder_content_images.sql`
- `20260816050055_add_public_production_location_suggestions_v1.sql`
- `20260816050148_add_my_producer_products_v1.sql`
- `20260816050346_add_my_producer_location_change_status_v1.sql`
- `20260816050443_minimize_public_storefront_readiness_v1.sql`

Current live Supabase migration count verified: **90**.
The authoritative SQL bodies are retained in `supabase_migrations.schema_migrations` in the linked Golden Oremar Supabase project.
