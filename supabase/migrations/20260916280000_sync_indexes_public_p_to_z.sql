-- Schema drift closure, indexes part 5: public schema, tables p-z
-- (64 indexes). This completes the index layer.
--
-- Index DDL taken verbatim from pg_get_indexdef, md5-verified
-- (62c52c3a074573cd70b4a2dffbb5f26f). IF NOT EXISTS injected for
-- replayability. Constraint-backed indexes excluded.
--
-- Partial unique indexes in this batch that are rules rather than tuning:
--   * producers_single_official_store_idx - at most one official store can
--     exist across the whole platform. This is a singleton guarantee that no
--     CHECK constraint could express, since it spans rows
--   * product_images_one_primary_idx - one primary image per product, so the
--     card image is never ambiguous
--   * product_variants_one_default_idx - one default variant per product,
--     which is what the checkout relies on when no variant is chosen
--   * product_change_requests_one_pending_idx - one open change request per
--     product, so a producer cannot queue conflicting edits
--   * producer_applications_one_open_per_user_idx - one open application per
--     user across draft, submitted, under_review and needs_information
--   * producer_location_change_one_pending_idx - one pending origin change
--     per producer
--   * return_requests_one_active_per_order_idx - one live return per order
--     across the five in-flight states
--   * refunds_provider_reference_unique_idx - a provider refund reference is
--     unique where present, which is what stops a refund being recorded twice
--   * shipping_zone_single_rest_world_idx - exactly one rest-of-world zone,
--     so the shipping fallback is never ambiguous
--
-- Three trigram indexes back the catalogue search relevance scoring:
-- products_search_text_trgm_idx, producers_display_name_trgm_idx and
-- producers_village_trgm_idx. The village index is what makes searching by a
-- village name work - a first-class feature for this storefront rather than a
-- nice-to-have.
--
-- Applying is a no-op against the live project.

CREATE INDEX IF NOT EXISTS producer_applications_location_review_idx ON public.producer_applications USING btree (production_country_code, production_province, production_district, status);
CREATE UNIQUE INDEX IF NOT EXISTS producer_applications_one_open_per_user_idx ON public.producer_applications USING btree (applicant_user_id) WHERE (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'needs_information'::text]));
CREATE INDEX IF NOT EXISTS producer_applications_review_queue_idx ON public.producer_applications USING btree (status, submitted_at) WHERE (status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'needs_information'::text]));
CREATE INDEX IF NOT EXISTS producer_applications_reviewed_by_idx ON public.producer_applications USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS producer_applications_user_idx ON public.producer_applications USING btree (applicant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS producer_location_change_admin_queue_idx ON public.producer_location_change_requests USING btree (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS producer_location_change_one_pending_idx ON public.producer_location_change_requests USING btree (producer_id) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS producer_location_change_requests_requested_by_idx ON public.producer_location_change_requests USING btree (requested_by);
CREATE INDEX IF NOT EXISTS producer_location_change_requests_reviewed_by_idx ON public.producer_location_change_requests USING btree (reviewed_by);
CREATE INDEX IF NOT EXISTS producers_display_name_trgm_idx ON public.producers USING gin (lower(display_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS producers_public_location_idx ON public.producers USING btree (production_country_code, production_province, production_district) WHERE ((status = 'active'::text) AND (is_verified = true) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS producers_public_storefront_idx ON public.producers USING btree (storefront_status, store_kind, status, is_verified) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS producers_single_official_store_idx ON public.producers USING btree (store_kind) WHERE ((store_kind = 'official'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS producers_status_idx ON public.producers USING btree (status, is_verified) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS producers_store_number_key ON public.producers USING btree (store_number);
CREATE INDEX IF NOT EXISTS producers_storefront_published_at_idx ON public.producers USING btree (storefront_published_at DESC) WHERE ((storefront_status = 'published'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS producers_village_trgm_idx ON public.producers USING gin (lower(COALESCE(production_village, ''::text)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_availability_subscriptions_active_idx ON public.product_availability_subscriptions USING btree (product_id, active) WHERE (active = true);
CREATE INDEX IF NOT EXISTS product_batch_certifications_cert_idx ON public.product_batch_certifications USING btree (certification_id);
CREATE INDEX IF NOT EXISTS product_batch_events_batch_time_idx ON public.product_batch_events USING btree (batch_id, event_at, id);
CREATE INDEX IF NOT EXISTS product_batches_producer_status_idx ON public.product_batches USING btree (producer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS product_batches_product_status_idx ON public.product_batches USING btree (product_id, status, released_at DESC);
CREATE INDEX IF NOT EXISTS product_batches_trace_lookup_idx ON public.product_batches USING btree (trace_code) WHERE (status = 'released'::text);
CREATE INDEX IF NOT EXISTS product_batches_variant_idx ON public.product_batches USING btree (variant_id) WHERE (variant_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_certifications_product_idx ON public.product_certifications USING btree (product_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS product_change_requests_one_pending_idx ON public.product_change_requests USING btree (product_id) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS product_change_requests_producer_idx ON public.product_change_requests USING btree (producer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_change_requests_requested_by_idx ON public.product_change_requests USING btree (requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS product_change_requests_review_queue_idx ON public.product_change_requests USING btree (created_at) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS product_change_requests_reviewed_by_idx ON public.product_change_requests USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_commerce_profiles_updated_by_idx ON public.product_commerce_profiles USING btree (updated_by) WHERE (updated_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_idx ON public.product_images USING btree (product_id) WHERE (is_primary = true);
CREATE INDEX IF NOT EXISTS product_images_product_sort_idx ON public.product_images USING btree (product_id, sort_order);
CREATE INDEX IF NOT EXISTS product_provenance_source_producer_idx ON public.product_provenance USING btree (source_producer_id) WHERE (source_producer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_sales_windows_schedule_idx ON public.product_sales_windows USING btree (is_confirmed, status, preorder_opens_at, preorder_closes_at);
CREATE INDEX IF NOT EXISTS product_sales_windows_updated_by_idx ON public.product_sales_windows USING btree (updated_by) WHERE (updated_by IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_one_default_idx ON public.product_variants USING btree (product_id) WHERE (is_default = true);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants USING btree (product_id, is_active);
CREATE INDEX IF NOT EXISTS products_catalog_idx ON public.products USING btree (category_id, published_at DESC) WHERE ((status = 'published'::text) AND (is_active = true) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS products_featured_idx ON public.products USING btree (published_at DESC) WHERE ((status = 'published'::text) AND (is_active = true) AND (is_featured = true) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS products_name_search_idx ON public.products USING gin (to_tsvector('simple'::regconfig, ((name || ' '::text) || COALESCE(description, ''::text))));
CREATE INDEX IF NOT EXISTS products_producer_idx ON public.products USING btree (producer_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS products_search_text_trgm_idx ON public.products USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles USING btree (status) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS refunds_finance_period_idx ON public.refunds USING btree (currency, created_at, status);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refunds_payment_id_idx ON public.refunds USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS refunds_provider_reference_unique_idx ON public.refunds USING btree (provider, provider_reference) WHERE ((provider IS NOT NULL) AND (provider_reference IS NOT NULL));
CREATE INDEX IF NOT EXISTS refunds_return_id_idx ON public.refunds USING btree (return_id) WHERE (return_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS return_items_order_item_idx ON public.return_items USING btree (order_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS return_requests_one_active_per_order_idx ON public.return_requests USING btree (order_id) WHERE (status = ANY (ARRAY['requested'::text, 'under_review'::text, 'approved'::text, 'in_transit'::text, 'received'::text]));
CREATE INDEX IF NOT EXISTS return_requests_order_id_idx ON public.return_requests USING btree (order_id);
CREATE INDEX IF NOT EXISTS return_requests_queue_idx ON public.return_requests USING btree (status, requested_at) WHERE (status = ANY (ARRAY['requested'::text, 'under_review'::text, 'approved'::text, 'in_transit'::text, 'received'::text]));
CREATE INDEX IF NOT EXISTS return_requests_reviewed_by_idx ON public.return_requests USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS return_requests_user_idx ON public.return_requests USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_merchant_reply_by_idx ON public.reviews USING btree (merchant_reply_by) WHERE (merchant_reply_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS reviews_moderated_by_idx ON public.reviews USING btree (moderated_by) WHERE (moderated_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS reviews_product_published_idx ON public.reviews USING btree (product_id, created_at DESC) WHERE (status = 'published'::text);
CREATE INDEX IF NOT EXISTS reviews_user_idx ON public.reviews USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipment_items_order_item_idx ON public.shipment_items USING btree (order_item_id);
CREATE INDEX IF NOT EXISTS shipments_order_idx ON public.shipments USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_tracking_idx ON public.shipments USING btree (tracking_number) WHERE (tracking_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS shipping_zone_countries_country_idx ON public.shipping_zone_countries USING btree (country_code, zone_id);
CREATE UNIQUE INDEX IF NOT EXISTS shipping_zone_single_rest_world_idx ON public.shipping_zones USING btree (is_rest_of_world) WHERE (is_rest_of_world = true);
