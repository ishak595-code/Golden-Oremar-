-- Schema drift closure, indexes part 2: private schema payment tables
-- (18 indexes on payment_events, payment_intents, payment_item_splits,
-- platform_expenses).
--
-- Index DDL taken verbatim from pg_get_indexdef, md5-verified. IF NOT EXISTS
-- injected for replayability. Constraint-backed indexes are excluded; see the
-- previous index migration for why.
--
-- Three partial unique indexes here are correctness guarantees, not tuning,
-- and they close gaps that the table CHECK constraints cannot express:
--   * payment_intents_provider_reference_uidx makes (provider,
--     provider_reference) unique wherever a reference exists, so the same
--     provider transaction cannot be attached to two intents
--   * payment_intents_provider_session_token_uidx does the same for hosted
--     checkout session tokens, so one iyzico checkout form maps to exactly
--     one intent
--   * payment_item_splits_payment_event_reservation_uidx prevents the same
--     payment from being split twice against one event reservation. The
--     order-side equivalent is already covered by the table's UNIQUE
--     (payment_id, order_item_id) constraint; this index is the event-side
--     half, and it has to be an index rather than a constraint because it is
--     conditional on event_reservation_id being present
--
-- Each of these is nullable-column unique enforcement, which PostgreSQL can
-- only express as a partial unique index. Dropping one as 'redundant' would
-- silently reopen a double-charge path.
--
-- Applying is a no-op against the live project.

CREATE INDEX IF NOT EXISTS payment_events_payment_id_idx ON private.payment_events USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_events_pending_idx ON private.payment_events USING btree (received_at) WHERE (processing_status = ANY (ARRAY['pending'::text, 'failed'::text]));
CREATE INDEX IF NOT EXISTS payment_intents_order_created_idx ON private.payment_intents USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_payment_method_idx ON private.payment_intents USING btree (payment_method_id) WHERE (payment_method_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_intents_processing_idx ON private.payment_intents USING btree (updated_at) WHERE (status = ANY (ARRAY['created'::text, 'processing'::text, 'authorized'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_provider_reference_uidx ON private.payment_intents USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_provider_session_token_uidx ON private.payment_intents USING btree (provider, provider_session_token) WHERE (provider_session_token IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_intents_subject_created_idx ON private.payment_intents USING btree (subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_user_created_idx ON private.payment_intents USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_item_splits_approved_by_idx ON private.payment_item_splits USING btree (approved_by) WHERE (approved_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_item_splits_event_reservation_idx ON private.payment_item_splits USING btree (event_reservation_id) WHERE (event_reservation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_item_splits_order_idx ON private.payment_item_splits USING btree (order_id, order_item_id);
CREATE INDEX IF NOT EXISTS payment_item_splits_order_item_idx ON private.payment_item_splits USING btree (order_item_id) WHERE (order_item_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS payment_item_splits_payment_event_reservation_uidx ON private.payment_item_splits USING btree (payment_id, event_reservation_id) WHERE (event_reservation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_item_splits_producer_idx ON private.payment_item_splits USING btree (producer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_expenses_created_by_idx ON private.platform_expenses USING btree (created_by) WHERE (created_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS platform_expenses_period_idx ON private.platform_expenses USING btree (currency, spent_on, status);
CREATE INDEX IF NOT EXISTS platform_expenses_voided_by_idx ON private.platform_expenses USING btree (voided_by) WHERE (voided_by IS NOT NULL);
