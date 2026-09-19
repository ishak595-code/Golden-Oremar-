-- Schema drift closure, indexes part 4: public schema, tables a-p
-- (59 indexes).
--
-- Index DDL taken verbatim from pg_get_indexdef, md5-verified
-- (c1483024fd801624f096c36c78ef1eac). IF NOT EXISTS injected for
-- replayability. Constraint-backed indexes excluded.
--
-- Partial unique indexes here that enforce business rules rather than tune
-- queries, and would break behaviour if dropped as redundant:
--   * addresses_one_default_per_user_idx - one default address per user among
--     non-deleted rows, so "default address" is never ambiguous
--   * carts_one_active_per_user_idx - one active cart per user, which is what
--     makes get_or_create_customer_cart_v1 safe under concurrency
--   * orders_checkout_idempotency_idx - (user_id, checkout_idempotency_key)
--     unique where the key is present. This is the database-level half of
--     checkout idempotency; the application check in create_customer_order is
--     the first line, this index is the one that holds under a race
--   * event_reservations_active_email_idx - one live reservation per email
--     per event, computed on lower(guest_email) so casing cannot be used to
--     book twice
--   * conversations_context_key_uidx - one conversation per context key,
--     which prevents duplicate support threads for the same subject
--
-- Two full-text and trigram indexes are also captured: content_entries_search_idx
-- (gin over title, summary and body) and categories_name_trgm_idx (gin trigram
-- over lower(name)). These back the search and typeahead functions; without
-- them those queries still return correct results but degrade to sequential
-- scans, which is the kind of regression that is invisible until the catalogue
-- grows.
--
-- Applying is a no-op against the live project.

CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user_idx ON public.addresses USING btree (user_id) WHERE ((is_default = true) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS addresses_user_active_idx ON public.addresses USING btree (user_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS campaign_categories_category_idx ON public.campaign_categories USING btree (category_id);
CREATE INDEX IF NOT EXISTS campaign_products_product_idx ON public.campaign_products USING btree (product_id);
CREATE INDEX IF NOT EXISTS campaigns_active_window_idx ON public.campaigns USING btree (starts_at, ends_at) WHERE (status = ANY (ARRAY['scheduled'::text, 'active'::text]));
CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON public.cart_items USING btree (cart_id);
CREATE INDEX IF NOT EXISTS cart_items_variant_idx ON public.cart_items USING btree (variant_id);
CREATE INDEX IF NOT EXISTS carts_expiry_idx ON public.carts USING btree (expires_at) WHERE ((status = 'active'::text) AND (expires_at IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS carts_one_active_per_user_idx ON public.carts USING btree (user_id) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS categories_name_trgm_idx ON public.categories USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS categories_parent_sort_idx ON public.categories USING btree (parent_id, sort_order) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS content_entries_author_user_id_idx ON public.content_entries USING btree (author_user_id) WHERE (author_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS content_entries_public_idx ON public.content_entries USING btree (content_type, locale, published_at DESC) WHERE ((status = 'published'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS content_entries_related_producer_id_idx ON public.content_entries USING btree (related_producer_id) WHERE (related_producer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS content_entries_related_product_id_idx ON public.content_entries USING btree (related_product_id) WHERE (related_product_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS content_entries_search_idx ON public.content_entries USING gin (to_tsvector('simple'::regconfig, ((((title || ' '::text) || summary) || ' '::text) || body_markdown)));
CREATE INDEX IF NOT EXISTS content_entries_tags_idx ON public.content_entries USING gin (tags);
CREATE INDEX IF NOT EXISTS conversation_participants_user_idx ON public.conversation_participants USING btree (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS conversations_closed_by_idx ON public.conversations USING btree (closed_by) WHERE (closed_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_context_key_uidx ON public.conversations USING btree (context_key) WHERE (context_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversations_created_by_idx ON public.conversations USING btree (created_by);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON public.conversations USING btree (last_message_at DESC NULLS LAST, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_order_idx ON public.conversations USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversations_producer_idx ON public.conversations USING btree (producer_id) WHERE (producer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversations_product_idx ON public.conversations USING btree (product_id) WHERE (product_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS coupons_campaign_id_idx ON public.coupons USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS event_reservations_active_email_idx ON public.event_reservations USING btree (event_id, lower(guest_email)) WHERE (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'waitlisted'::text, 'attended'::text]));
CREATE INDEX IF NOT EXISTS event_reservations_event_idx ON public.event_reservations USING btree (event_id, status, created_at);
CREATE INDEX IF NOT EXISTS event_reservations_user_idx ON public.event_reservations USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS events_producer_starts_idx ON public.events USING btree (producer_id, starts_at DESC) WHERE (producer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS events_public_idx ON public.events USING btree (starts_at) WHERE (status = ANY (ARRAY['published'::text, 'sold_out'::text]));
CREATE INDEX IF NOT EXISTS favorites_product_idx ON public.favorites USING btree (product_id);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages USING btree (conversation_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS messages_sender_user_id_idx ON public.messages USING btree (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS order_item_preparation_events_actor_idx ON public.order_item_preparation_events USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_item_preparation_events_item_idx ON public.order_item_preparation_events USING btree (order_item_id, created_at);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS order_items_producer_idx ON public.order_items USING btree (producer_id, created_at DESC) WHERE (producer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON public.order_items USING btree (product_id) WHERE (product_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_items_variant_id_idx ON public.order_items USING btree (variant_id) WHERE (variant_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_promotions_campaign_idx ON public.order_promotions USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS order_promotions_coupon_idx ON public.order_promotions USING btree (coupon_id) WHERE (coupon_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_status_history_actor_user_id_idx ON public.order_status_history USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON public.order_status_history USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_accounting_active_idx ON public.orders USING btree (accounting_archived_at, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_accounting_period_idx ON public.orders USING btree (accounting_period_id) WHERE (accounting_period_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS orders_cart_id_idx ON public.orders USING btree (cart_id) WHERE (cart_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_idempotency_idx ON public.orders USING btree (user_id, checkout_idempotency_key) WHERE (checkout_idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS orders_expiring_reservations_idx ON public.orders USING btree (reservation_expires_at, id) WHERE ((status = 'pending_payment'::text) AND (payment_status = 'unpaid'::text) AND (reservation_expires_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS orders_finance_period_idx ON public.orders USING btree (currency, COALESCE(placed_at, created_at), payment_status, status);
CREATE INDEX IF NOT EXISTS orders_operations_queue_idx ON public.orders USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'preparing'::text, 'partially_shipped'::text, 'shipped'::text]));
CREATE INDEX IF NOT EXISTS orders_payment_queue_idx ON public.orders USING btree (payment_status, created_at) WHERE (payment_status = ANY (ARRAY['unpaid'::text, 'authorized'::text, 'failed'::text, 'disputed'::text]));
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_records_finance_period_idx ON public.payment_records USING btree (currency, COALESCE(captured_at, created_at), status);
CREATE INDEX IF NOT EXISTS payment_records_order_idx ON public.payment_records USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_records_pending_idx ON public.payment_records USING btree (status, created_at) WHERE (status = ANY (ARRAY['created'::text, 'pending'::text, 'authorized'::text, 'disputed'::text]));
CREATE INDEX IF NOT EXISTS payment_records_subject_idx ON public.payment_records USING btree (subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_records_user_idx ON public.payment_records USING btree (user_id, created_at DESC);
