-- Schema drift closure, indexes part 1: private schema, tables a-o
-- (38 indexes).
--
-- Index DDL taken verbatim from pg_get_indexdef, which is canonical output in
-- the same way pg_get_functiondef is, then md5-verified. IF NOT EXISTS is
-- injected so the file is replayable.
--
-- Scope note: only indexes that are not backed by a constraint are emitted
-- here. Of the 432 indexes live, 167 exist because a PRIMARY KEY, UNIQUE or
-- EXCLUDE constraint created them, and those already arrive with the table
-- definitions in the earlier batches. Emitting them again would attempt to
-- create a duplicate index under a different name. Only the 265 standalone
-- indexes are captured across these files.
--
-- Several entries here are partial unique indexes doing real correctness work
-- rather than pure optimisation, and would be easy to mistake for tuning and
-- drop:
--   * account_closure_one_open_per_user_idx permits only one open closure
--     request per user, across the requested / processing /
--     ready_for_auth_deletion states
--   * customer_payment_methods_one_default_idx permits exactly one default
--     card per user among active cards, so 'default' can never be ambiguous
--   * event_reservation_finance_provider_ref_uidx makes a provider payment
--     reference unique where present, blocking double-recording of an event
--     payment
--
-- Applying is a no-op against the live project.

CREATE UNIQUE INDEX IF NOT EXISTS account_closure_one_open_per_user_idx ON private.account_closure_requests USING btree (user_id) WHERE (status = ANY (ARRAY['requested'::text, 'processing'::text, 'ready_for_auth_deletion'::text]));
CREATE INDEX IF NOT EXISTS account_closure_queue_idx ON private.account_closure_requests USING btree (status, requested_at);
CREATE INDEX IF NOT EXISTS account_closure_requests_processed_by_idx ON private.account_closure_requests USING btree (processed_by) WHERE (processed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS account_enforcement_events_actor_idx ON private.account_enforcement_events USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS account_enforcement_events_user_created_idx ON private.account_enforcement_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS accounting_periods_closed_by_idx ON private.accounting_periods USING btree (closed_by) WHERE (closed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_created_idx ON private.admin_audit_logs USING btree (action, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_created_idx ON private.admin_audit_logs USING btree (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_created_idx ON private.admin_audit_logs USING btree (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON private.audit_log USING btree (actor_user_id, occurred_at DESC) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON private.audit_log USING btree (table_schema, table_name, record_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS catalog_media_binary_verifications_v2_path_idx ON private.catalog_media_binary_verifications_v2 USING btree (bucket_id, object_path);
CREATE INDEX IF NOT EXISTS contact_messages_assigned_to_idx ON private.contact_messages USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);
CREATE INDEX IF NOT EXISTS contact_messages_ip_rate_limit_idx ON private.contact_messages USING btree (ip_hash, created_at DESC) WHERE (ip_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS contact_messages_queue_idx ON private.contact_messages USING btree (status, created_at) WHERE (status <> 'resolved'::text);
CREATE INDEX IF NOT EXISTS contact_messages_user_id_idx ON private.contact_messages USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS content_favorites_content_id_idx ON private.content_favorites USING btree (content_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_payment_methods_one_default_idx ON private.customer_payment_methods USING btree (user_id) WHERE (is_default AND (status = 'active'::text));
CREATE INDEX IF NOT EXISTS customer_payment_methods_user_status_idx ON private.customer_payment_methods USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS device_push_tokens_user_active_idx ON private.device_push_tokens USING btree (user_id, provider, platform) WHERE (disabled_at IS NULL);
CREATE INDEX IF NOT EXISTS event_reservation_finance_event_idx ON private.event_reservation_finance USING btree (event_id, payment_status, payment_expires_at);
CREATE INDEX IF NOT EXISTS event_reservation_finance_producer_idx ON private.event_reservation_finance USING btree (producer_id, currency, payment_status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS event_reservation_finance_provider_ref_uidx ON private.event_reservation_finance USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);
CREATE INDEX IF NOT EXISTS event_reservation_finance_user_idx ON private.event_reservation_finance USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idempotency_keys_expiry_idx ON private.idempotency_keys USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idempotency_keys_user_id_idx ON private.idempotency_keys USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS inventory_movements_actor_user_id_idx ON private.inventory_movements USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS inventory_movements_variant_idx ON private.inventory_movements USING btree (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS legacy_records_pending_idx ON private.legacy_records USING btree (entity_type, imported_at) WHERE (migration_status = ANY (ARRAY['pending'::text, 'failed'::text]));
CREATE INDEX IF NOT EXISTS newsletter_subscriptions_active_idx ON private.newsletter_subscriptions USING btree (created_at) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS newsletter_subscriptions_user_id_idx ON private.newsletter_subscriptions USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_gifts_user_created_idx ON private.order_gifts USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_payment_preferences_payment_method_id_idx ON private.order_payment_preferences USING btree (payment_method_id);
CREATE INDEX IF NOT EXISTS order_payment_preferences_user_id_idx ON private.order_payment_preferences USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_settlement_releases_released_by_idx ON private.order_settlement_releases USING btree (released_by) WHERE (released_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_settlement_releases_requested_by_idx ON private.order_settlement_releases USING btree (requested_by) WHERE (requested_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_settlement_releases_status_idx ON private.order_settlement_releases USING btree (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS outbox_events_queue_idx ON private.outbox_events USING btree (available_at, id) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));
