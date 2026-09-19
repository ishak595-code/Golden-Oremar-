-- Schema drift closure, indexes part 3: private schema, tables p-z
-- (86 indexes).
--
-- Index DDL taken verbatim from pg_get_indexdef, md5-verified
-- (c379a2239174806f2c5b8dfd51a8336d). IF NOT EXISTS injected for
-- replayability. Constraint-backed indexes excluded.
--
-- Partial unique indexes carrying business rules in this batch:
--   * producer_payouts_provider_order_producer_uidx - one marketplace payout
--     per (order, producer), so a provider settlement cannot be raised twice
--     for the same order line
--   * producer_payout_provider_reference_uidx - a provider payout reference is
--     unique where present
--   * product_export_country_product_uidx / _category_uidx - one export rule
--     per country per product, and per country per category
--   * product_health_change_requests_open_proposer_uq - one open health-claim
--     change request per (product, locale, proposer)
--   * user_content_reports_active_unique - a user cannot file the same report
--     twice while an earlier one is still new or under review
--   * super_admin_release_origins_one_primary_v1 - exactly one primary release
--     origin can exist
--
-- Recorded finding, not corrected in this file: stock_alert_subscriptions
-- carries four unique indexes that are two pairs of duplicates. Within each
-- pair the columns are the same and the WHERE clause is identical, only the
-- column order is reversed:
--   stock_alert_active_email_variant_uidx (email_normalized, variant_id)
--   stock_alert_email_variant_idx         (variant_id, email_normalized)
--   stock_alert_active_user_variant_uidx  (user_id, variant_id)
--   stock_alert_user_variant_idx          (variant_id, user_id)
-- For uniqueness enforcement, column order is irrelevant, so each pair
-- enforces exactly the same rule twice. This file reproduces live faithfully
-- rather than quietly diverging from it; the redundancy is addressed in a
-- separate, deliberate migration so the change is reviewable on its own.

CREATE INDEX IF NOT EXISTS producer_application_kyc_phone_verified_by_idx ON private.producer_application_kyc USING btree (phone_verified_by) WHERE (phone_verified_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_documents_application_idx ON private.producer_documents USING btree (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS producer_documents_verified_by_idx ON private.producer_documents USING btree (verified_by) WHERE (verified_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_event_submissions_event_idx ON private.producer_event_submissions USING btree (event_id) WHERE (event_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_event_submissions_producer_created_idx ON private.producer_event_submissions USING btree (producer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS producer_event_submissions_reviewed_by_idx ON private.producer_event_submissions USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_event_submissions_status_created_idx ON private.producer_event_submissions USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS producer_event_submissions_submitted_by_idx ON private.producer_event_submissions USING btree (submitted_by);
CREATE INDEX IF NOT EXISTS producer_follows_producer_id_idx ON private.producer_follows USING btree (producer_id);
CREATE INDEX IF NOT EXISTS producer_ledger_event_reservation_idx ON private.producer_ledger_entries USING btree (event_reservation_id) WHERE (event_reservation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_ledger_finance_period_idx ON private.producer_ledger_entries USING btree (currency, created_at, producer_id);
CREATE INDEX IF NOT EXISTS producer_ledger_order_idx ON private.producer_ledger_entries USING btree (order_id, order_item_id);
CREATE INDEX IF NOT EXISTS producer_ledger_order_item_idx ON private.producer_ledger_entries USING btree (order_item_id) WHERE (order_item_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_ledger_producer_currency_idx ON private.producer_ledger_entries USING btree (producer_id, currency, availability_status, created_at);
CREATE INDEX IF NOT EXISTS producer_ledger_refund_idx ON private.producer_ledger_entries USING btree (refund_id) WHERE (refund_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_ledger_return_idx ON private.producer_ledger_entries USING btree (return_id) WHERE (return_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_payout_balance_idx ON private.producer_payouts USING btree (producer_id, currency, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS producer_payout_provider_reference_uidx ON private.producer_payouts USING btree (provider, provider_reference) WHERE ((provider IS NOT NULL) AND (provider_reference IS NOT NULL));
CREATE INDEX IF NOT EXISTS producer_payouts_channel_idx ON private.producer_payouts USING btree (channel, status, created_at DESC);
CREATE INDEX IF NOT EXISTS producer_payouts_created_by_idx ON private.producer_payouts USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_payouts_destination_application_idx ON private.producer_payouts USING btree (destination_application_id) WHERE (destination_application_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_payouts_finance_period_idx ON private.producer_payouts USING btree (currency, COALESCE(processed_at, scheduled_at, created_at), status);
CREATE INDEX IF NOT EXISTS producer_payouts_processed_by_idx ON private.producer_payouts USING btree (processed_by) WHERE (processed_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS producer_payouts_provider_order_producer_uidx ON private.producer_payouts USING btree (source_order_id, producer_id, channel) WHERE ((source_order_id IS NOT NULL) AND (channel = 'provider_marketplace'::text));
CREATE INDEX IF NOT EXISTS producer_payouts_queue_idx ON private.producer_payouts USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS producer_payouts_source_order_idx ON private.producer_payouts USING btree (source_order_id) WHERE (source_order_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_trust_badge_events_actor_idx ON private.producer_trust_badge_events USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_trust_badge_events_producer_created_idx ON private.producer_trust_badge_events USING btree (producer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_availability_delivery_log_sales_window_idx ON private.product_availability_delivery_log USING btree (sales_window_id);
CREATE INDEX IF NOT EXISTS product_certification_documents_reviewed_by_idx ON private.product_certification_documents USING btree (reviewed_by);
CREATE INDEX IF NOT EXISTS product_certification_documents_submitted_by_idx ON private.product_certification_documents USING btree (submitted_by);
CREATE INDEX IF NOT EXISTS product_editorial_drafts_producer_idx ON private.product_editorial_drafts USING btree (producer_id);
CREATE INDEX IF NOT EXISTS product_editorial_drafts_reviewed_by_idx ON private.product_editorial_drafts USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_editorial_drafts_status_idx ON private.product_editorial_drafts USING btree (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS product_editorial_drafts_submitted_by_idx ON private.product_editorial_drafts USING btree (submitted_by);
CREATE UNIQUE INDEX IF NOT EXISTS product_export_country_category_uidx ON private.product_export_country_rules USING btree (category_id, country_code) WHERE (category_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_export_country_lookup_idx ON private.product_export_country_rules USING btree (country_code, decision);
CREATE UNIQUE INDEX IF NOT EXISTS product_export_country_product_uidx ON private.product_export_country_rules USING btree (product_id, country_code) WHERE (product_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_export_rules_created_by_idx ON private.product_export_country_rules USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_export_rules_updated_by_idx ON private.product_export_country_rules USING btree (updated_by) WHERE (updated_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS product_health_change_requests_open_proposer_uq ON private.product_health_change_requests USING btree (product_id, locale, proposed_by) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS product_health_change_requests_proposed_by_idx ON private.product_health_change_requests USING btree (proposed_by);
CREATE INDEX IF NOT EXISTS product_health_change_requests_queue_idx ON private.product_health_change_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_health_change_requests_reviewed_by_idx ON private.product_health_change_requests USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_moderation_events_actor_idx ON private.product_moderation_events USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_moderation_events_change_request_idx ON private.product_moderation_events USING btree (change_request_id) WHERE (change_request_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_moderation_events_producer_created_idx ON private.product_moderation_events USING btree (producer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_moderation_events_product_created_idx ON private.product_moderation_events USING btree (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS promotion_redemptions_campaign_status_idx ON private.promotion_redemptions USING btree (campaign_id, status, expires_at);
CREATE INDEX IF NOT EXISTS promotion_redemptions_coupon_status_idx ON private.promotion_redemptions USING btree (coupon_id, status, expires_at) WHERE (coupon_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS promotion_redemptions_user_campaign_idx ON private.promotion_redemptions USING btree (user_id, campaign_id, status);
CREATE INDEX IF NOT EXISTS promotion_redemptions_user_coupon_idx ON private.promotion_redemptions USING btree (user_id, coupon_id, status) WHERE (coupon_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS push_deliveries_device_token_idx ON private.push_deliveries USING btree (device_token_id);
CREATE INDEX IF NOT EXISTS push_deliveries_queue_idx ON private.push_deliveries USING btree (status, available_at, id) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS push_deliveries_user_idx ON private.push_deliveries USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_helpful_votes_user_idx ON private.review_helpful_votes USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS role_permissions_granted_by_idx ON private.role_permissions USING btree (granted_by);
CREATE INDEX IF NOT EXISTS role_permissions_permission_key_idx ON private.role_permissions USING btree (permission_key);
CREATE INDEX IF NOT EXISTS security_block_rules_created_by_idx ON private.security_block_rules USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS security_block_rules_device_active_idx ON private.security_block_rules USING btree (device_id) WHERE ((active = true) AND (subject_type = 'device'::text));
CREATE INDEX IF NOT EXISTS security_block_rules_ip_active_idx ON private.security_block_rules USING btree (ip_network) WHERE ((active = true) AND (subject_type = 'ip'::text));
CREATE INDEX IF NOT EXISTS security_block_rules_revoked_by_idx ON private.security_block_rules USING btree (revoked_by) WHERE (revoked_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS security_block_rules_source_user_idx ON private.security_block_rules USING btree (source_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_block_rules_user_active_idx ON private.security_block_rules USING btree (user_id) WHERE ((active = true) AND (subject_type = 'user'::text));
CREATE INDEX IF NOT EXISTS sensitive_access_log_actor_idx ON private.sensitive_access_log USING btree (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS sensitive_access_log_resource_idx ON private.sensitive_access_log USING btree (resource_type, resource_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS stock_alert_active_email_variant_uidx ON private.stock_alert_subscriptions USING btree (email_normalized, variant_id) WHERE ((email_normalized IS NOT NULL) AND (status = 'active'::text));
CREATE UNIQUE INDEX IF NOT EXISTS stock_alert_active_user_variant_uidx ON private.stock_alert_subscriptions USING btree (user_id, variant_id) WHERE ((user_id IS NOT NULL) AND (status = 'active'::text));
CREATE UNIQUE INDEX IF NOT EXISTS stock_alert_email_variant_idx ON private.stock_alert_subscriptions USING btree (variant_id, email_normalized) WHERE ((email_normalized IS NOT NULL) AND (status = 'active'::text));
CREATE INDEX IF NOT EXISTS stock_alert_subscriptions_user_id_idx ON private.stock_alert_subscriptions USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS stock_alert_user_variant_idx ON private.stock_alert_subscriptions USING btree (variant_id, user_id) WHERE ((user_id IS NOT NULL) AND (status = 'active'::text));
CREATE INDEX IF NOT EXISTS store_follow_simulation_allocations_updated_by_idx ON private.store_follow_simulation_allocations USING btree (updated_by) WHERE (updated_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS submission_attempts_rate_limit_idx ON private.submission_attempts USING btree (scope, ip_hash, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS super_admin_release_origins_one_primary_v1 ON private.super_admin_release_origins_v1 USING btree (is_primary) WHERE (is_primary = true);
CREATE INDEX IF NOT EXISTS system_error_daily_last_seen_idx ON private.system_error_daily USING btree (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS system_error_daily_last_user_idx ON private.system_error_daily USING btree (last_user_id) WHERE (last_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS transactional_email_jobs_queue_idx ON private.transactional_email_jobs USING btree (available_at, id) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text, 'processing'::text]));
CREATE INDEX IF NOT EXISTS transactional_email_jobs_user_idx ON private.transactional_email_jobs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_blocks_active_blocked_idx ON private.user_blocks USING btree (blocked_user_id, blocker_user_id) WHERE (removed_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS user_content_reports_active_unique ON private.user_content_reports USING btree (reporter_user_id, target_type, target_id) WHERE (status = ANY (ARRAY['new'::text, 'reviewing'::text]));
CREATE INDEX IF NOT EXISTS user_content_reports_queue_idx ON private.user_content_reports USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_content_reports_reported_user_idx ON private.user_content_reports USING btree (reported_user_id);
CREATE INDEX IF NOT EXISTS user_roles_granted_by_idx ON private.user_roles USING btree (granted_by) WHERE (granted_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS user_security_contexts_device_idx ON private.user_security_contexts USING btree (device_id) WHERE (device_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS user_security_contexts_ip_idx ON private.user_security_contexts USING btree (ip_address) WHERE (ip_address IS NOT NULL);
CREATE INDEX IF NOT EXISTS user_security_contexts_user_last_seen_idx ON private.user_security_contexts USING btree (user_id, last_seen_at DESC);
