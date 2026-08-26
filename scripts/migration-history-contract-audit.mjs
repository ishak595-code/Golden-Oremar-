import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'supabase','migrations');
const failures=[];

const historicalRequired=[
  '20260820205756_strengthen_golden_oremar_legal_disclosures_2026.sql',
  '20260820211030_invalidate_legal_finalization_on_identity_or_document_change.sql',
  '20260821075933_retire_legacy_producer_account_public_contracts_v1.sql',
  '20260821083330_flatten_producer_read_contracts_and_remove_orphan_storefronts.sql',
  '20260821083551_flatten_producer_onboarding_write_contracts.sql',
  '20260821084346_seal_canonical_producer_entrypoints_v1.sql',
  '20260821084442_restore_linter_safe_producer_wrappers_v1.sql',
  '20260821085226_canonicalize_public_rpc_versions_and_retire_duplicate_aliases.sql',
  '20260821091027_seed_estimated_packaged_shipping_weights_and_track_provenance_v2.sql',
  '20260821094110_seed_provisional_business_identity_and_admin_verification_v1.sql',
  '20260821094518_seed_multilingual_legal_document_drafts_v1.sql',
  '20260821094807_add_super_admin_release_setup_management_v1.sql',
  '20260821095157_preserve_payment_config_when_release_return_url_is_empty_v1.sql',
  '20260821095744_align_legal_copy_with_provisional_registered_identity_v1.sql',
  '20260821095933_bind_existing_golden_oremar_brand_assets_v1.sql',
  '20260821103949_add_private_prelaunch_company_and_release_configuration_v1.sql',
  '20260821104342_retire_legacy_release_setup_v1_entrypoints.sql',
  '20260821105641_add_super_admin_vault_integration_secret_management_v1.sql',
  '20260821105918_simplify_vault_runtime_and_expose_iyzico_environment_v1.sql',
  '20260821111221_fix_integration_secret_validation_v2.sql',
  '20260821113817_verify_real_golden_oremar_business_identity_v1.sql',
  '20260821113858_finalize_verified_golden_oremar_legal_documents_v1.sql',
  '20260821114351_activate_real_public_release_configuration_v1.sql',
  '20260821114535_add_super_admin_release_origin_management_v1.sql',
  '20260821115051_separate_release_configuration_sync_from_activation_v1.sql',
  '20260821115216_backfill_release_activation_flag_v1.sql',
  '20260821141917_harden_public_rpc_security_invoker_boundary_v1.sql',
  '20260821142610_isolate_anonymous_rpc_privileges_in_api_internal_v2.sql',
  '20260822085741_restore_authenticated_account_overview_core_execute_v1.sql',
  '20260822090049_restore_authenticated_invoker_private_dependencies_v1.sql'
];

const pinnedProductionTail=[
  '20260823211142_align_reference_storefront_v1.sql',
  '20260823221038_add_store_follow_simulation_pool_v1.sql',
  '20260823221436_index_store_follow_simulation_updated_by_v1.sql',
  '20260824101926_add_capability_authorization_core_v1.sql',
  '20260824102300_enforce_capability_guards_generic_v1.sql',
  '20260824102400_enforce_product_seller_capabilities_v1.sql',
  '20260824102413_enforce_review_capabilities_v1.sql',
  '20260824102454_enforce_refund_payout_capabilities_v1.sql',
  '20260824102532_harden_role_governance_v1.sql',
  '20260824102543_enforce_user_security_capabilities_v1.sql',
  '20260824102628_map_super_admin_operations_to_capabilities_v1.sql',
  '20260824102831_enforce_service_actor_capabilities_v1.sql',
  '20260824102940_enforce_producer_capability_and_ownership_v1.sql',
  '20260824102955_enforce_producer_traceability_capability_v1.sql',
  '20260824103018_add_super_admin_break_glass_bootstrap_v1.sql',
  '20260824103133_close_remaining_management_role_gates_v1.sql',
  '20260824103227_remove_legacy_role_authority_leaks_v1.sql',
  '20260824103347_capability_admin_session_compatibility_v1.sql',
  '20260824104610_capability_admin_shell_compatibility_v2.sql',
  '20260824105316_align_admin_dashboard_with_analytics_capability_v1.sql',
  '20260824105823_fix_producer_archive_ownership_variable_collision_v1.sql',
  '20260824105922_add_authorization_enforcement_self_test_v1.sql',
  '20260824105954_fix_authorization_enforcement_self_test_v2.sql',
  '20260824114642_close_final_coarse_authorization_gates_v1.sql',
  '20260824115302_add_stale_ci_e2e_user_garbage_collection_v1.sql',
  '20260824120406_harden_authorization_public_invoker_boundaries_v1.sql',
  '20260824120541_index_role_permission_foreign_keys_v1.sql',
  '20260824124542_add_staff_totp_mfa_transition_v1.sql',
  '20260824132703_harden_staff_mfa_closeout_v1.sql',
  '20260824132826_add_ci_staff_security_state_controls_v1.sql',
  '20260824133240_harden_ci_staff_user_cleanup_v1.sql',
  '20260824133655_add_super_admin_mfa_break_glass_recovery_v1.sql',
  '20260824134013_add_ci_mfa_audit_summary_v1.sql',
  '20260824142118_harden_mfa_client_audit_integrity_v1.sql',
  '20260824142244_complete_super_admin_mfa_recovery_controls_v1.sql',
  '20260824144122_tighten_ci_e2e_user_garbage_collection_v2.sql',
  '20260824150902_fix_ci_e2e_gc_email_regex_v3.sql',
  '20260824172652_harden_product_media_integrity_lifecycle_v1.sql',
  '20260824173453_add_product_media_drift_quarantine_v1.sql',
  '20260824182143_harden_payment_provider_settlement_evidence_v1.sql',
  '20260824190311_require_super_admin_product_publication_v1.sql',
  '20260824194626_add_catalog_media_binary_verification_v1.sql',
  '20260824195156_simplify_catalog_media_to_manual_review_v1.sql',
  '20260824201700_enforce_catalog_media_binary_verification_v2.sql',
  '20260826094433_harden_super_admin_product_publish_state_v2.sql',
  '20260826101337_require_super_admin_official_catalog_media_v1.sql',
  '20260826105451_harden_rls_role_helper_recursion_v1.sql',
  '20260826110113_harden_storage_certificate_delete_private_boundary_v1.sql',
  '20260826111335_add_catalog_facets_and_publish_readiness_v1.sql',
  '20260826114508_allow_official_store_brand_fallback_publication_v1.sql',
  '20260826115042_add_super_admin_bulk_product_moderation_v1.sql',
  '20260826120207_align_product_review_media_with_canonical_integrity_v1.sql',
  '20260826122833_canonicalize_publish_readiness_media_contract_v2.sql',
  '20260826123321_canonicalize_publish_readiness_media_block_semantics_v3.sql',
  '20260826123459_isolate_super_admin_catalog_media_health_definer_v3.sql',
  '20260826124146_support_exact_product_id_publish_readiness_v4.sql',
  '20260826124438_make_exact_product_id_readiness_exclusive_v5.sql',
  '20260826132532_fix_product_editorial_text_array_ambiguity_v2.sql',
  '20260826132653_prepare_official_catalog_editorial_review_v1.sql',
  '20260826132722_add_dynamic_product_recommendations_v1.sql',
  '20260826132835_strengthen_product_recommendation_context_v2.sql',
  '20260826133559_expose_ci_orphan_catalog_media_cleanup_candidates_v1.sql',
  '20260826150338_bind_official_store_brand_assets_v1.sql',
  '20260826150702_expose_ci_orphan_catalog_media_cleanup_service_wrapper_v2.sql',
  '20260826150846_canonicalize_catalog_public_asset_references_v4.sql',
  '20260826154938_harden_store_branding_asset_ownership_v1.sql',
  '20260826155021_separate_official_and_owner_store_branding_authority_v2.sql',
  '20260826160122_minimize_store_branding_helper_execute_boundary_v3.sql',
  '20260826160616_allow_super_admin_store_branding_override_v4.sql',
  '20260826164750_add_unified_storefront_setup_v1.sql',
  '20260826165034_enforce_storefront_setup_before_seller_activation_v2.sql',
  '20260826165148_restore_official_only_super_admin_branding_scope_v3.sql',
  '20260826171720_add_super_admin_store_directory_and_lifecycle_v1.sql',
  '20260826173456_fix_super_admin_store_detail_website_v2.sql',
  '20260826223600_seal_direct_product_write_and_enforce_producer_scope_v1.sql',
  '20260826223915_separate_official_store_admin_review_scope_v1.sql',
  '20260826224032_repair_catalog_brand_delete_policy_boundary_v1.sql',
  '20260826233501_add_atomic_super_admin_bulk_product_publication_v1.sql',
  '20260826233642_align_atomic_bulk_publication_response_v2.sql',
  '20260826234521_separate_official_store_moderation_notifications_v1.sql'
];

const retiredMisTimestamped=[
  '20260820211030_strengthen_golden_oremar_legal_disclosures_2026.sql',
  '20260823210300_align_reference_storefront_v1.sql',
  '20260824173500_add_product_media_drift_quarantine_v1.sql',
  '20260827013000_add_atomic_super_admin_bulk_product_publication_v1.sql'
];

if(!fs.existsSync(dir)){
  failures.push('Supabase migrations directory is missing.');
}else{
  const files=fs.readdirSync(dir).filter(name=>name.endsWith('.sql')).sort();
  const byVersion=new Map();
  for(const file of files){
    const match=file.match(/^(\d{14})_(.+)\.sql$/);
    if(!match){failures.push(`Migration filename is not canonical: ${file}`);continue;}
    const version=match[1];
    const existing=byVersion.get(version)||[];
    existing.push(file);
    byVersion.set(version,existing);
  }
  for(const [version,names] of byVersion){if(names.length>1)failures.push(`Duplicate migration timestamp ${version}: ${names.join(', ')}`);}
  for(const file of [...historicalRequired,...pinnedProductionTail]){if(!files.includes(file))failures.push(`Required canonical migration is missing: ${file}`);}
  for(const file of retiredMisTimestamped){if(files.includes(file))failures.push(`Retired or mis-timestamped migration must stay absent: ${file}`);}

  const pinnedVersions=pinnedProductionTail.map(name=>name.slice(0,14));
  if(new Set(pinnedVersions).size!==pinnedVersions.length)failures.push('Pinned production migration tail contains duplicate versions.');
  const localPinned=files.filter(name=>pinnedVersions.includes(name.slice(0,14)));
  if(localPinned.length!==pinnedProductionTail.length)failures.push(`Pinned production migration tail is incomplete: expected ${pinnedProductionTail.length}, found ${localPinned.length}.`);
}

if(failures.length){
  console.error('Golden Oremar migration history contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Golden Oremar migration history contract audit passed: canonical filenames are unique, retired mis-timestamped copies are absent, and ${pinnedProductionTail.length} production-tail migration identities are pinned to the live chain.`);
