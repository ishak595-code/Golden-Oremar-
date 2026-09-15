-- Batch 2 (part 3/3): 52 trigger bindings (DROP+CREATE, idempotent) for the
-- functions in part 1, pulled via pg_get_triggerdef so the exact live
-- definition is captured (not hand-reconstructed), plus matching GRANT
-- statements confirmed against live information_schema.routine_privileges.
-- Post-apply Security Advisor check: 0 new findings (only pre-existing,
-- unrelated auth_leaked_password_protection warning).


-- ============================================================
-- triggers (exact defs via pg_get_triggerdef; drop-if-exists then create,
-- safe/idempotent whether or not the trigger already exists)
-- ============================================================

DROP TRIGGER IF EXISTS addresses_set_updated_at ON public.addresses;
CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS brand_settings_audit ON public.brand_settings;
CREATE TRIGGER brand_settings_audit AFTER INSERT OR DELETE OR UPDATE ON public.brand_settings FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS brand_settings_set_updated_at ON public.brand_settings;
CREATE TRIGGER brand_settings_set_updated_at BEFORE UPDATE ON public.brand_settings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS campaigns_audit ON public.campaigns;
CREATE TRIGGER campaigns_audit AFTER INSERT OR DELETE OR UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS campaigns_outbox ON public.campaigns;
CREATE TRIGGER campaigns_outbox AFTER INSERT OR UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION private.enqueue_admin_domain_change();

DROP TRIGGER IF EXISTS campaigns_set_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS cart_items_set_updated_at ON public.cart_items;
CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS carts_set_updated_at ON public.carts;
CREATE TRIGGER carts_set_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS categories_audit ON public.categories;
CREATE TRIGGER categories_audit AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS content_entries_audit ON public.content_entries;
CREATE TRIGGER content_entries_audit AFTER INSERT OR DELETE OR UPDATE ON public.content_entries FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS content_entries_claim_policy_guard ON public.content_entries;
CREATE TRIGGER content_entries_claim_policy_guard BEFORE INSERT OR UPDATE OF status, content_type, title, summary, body_markdown, body_html_sanitized, metadata ON public.content_entries FOR EACH ROW EXECUTE FUNCTION private.enforce_content_claim_policy();

DROP TRIGGER IF EXISTS content_entries_set_updated_at ON public.content_entries;
CREATE TRIGGER content_entries_set_updated_at BEFORE UPDATE ON public.content_entries FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS conversations_set_updated_at ON public.conversations;
CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS event_reservations_paid_buyer_name_guard ON public.event_reservations;
CREATE TRIGGER event_reservations_paid_buyer_name_guard BEFORE INSERT OR UPDATE OF event_id, user_id, guest_name ON public.event_reservations FOR EACH ROW EXECUTE FUNCTION private.validate_paid_event_reservation_buyer_name_v1();

DROP TRIGGER IF EXISTS event_reservations_set_updated_at ON public.event_reservations;
CREATE TRIGGER event_reservations_set_updated_at BEFORE UPDATE ON public.event_reservations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS events_audit ON public.events;
CREATE TRIGGER events_audit AFTER INSERT OR DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS queue_notification_push_v1 ON public.notifications;
CREATE TRIGGER queue_notification_push_v1 AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.queue_notification_push_v1();

DROP TRIGGER IF EXISTS snapshot_order_item_commission_v1 ON public.order_items;
CREATE TRIGGER snapshot_order_item_commission_v1 BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.snapshot_order_item_commission_v1();

DROP TRIGGER IF EXISTS orders_audit ON public.orders;
CREATE TRIGGER orders_audit AFTER INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS sync_order_promotion_redemption_v1 ON public.orders;
CREATE TRIGGER sync_order_promotion_redemption_v1 AFTER UPDATE OF status, payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION private.sync_order_promotion_redemption_v1();

DROP TRIGGER IF EXISTS payment_records_audit ON public.payment_records;
CREATE TRIGGER payment_records_audit AFTER INSERT OR DELETE OR UPDATE ON public.payment_records FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS payment_records_set_updated_at ON public.payment_records;
CREATE TRIGGER payment_records_set_updated_at BEFORE UPDATE ON public.payment_records FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS producer_applications_audit ON public.producer_applications;
CREATE TRIGGER producer_applications_audit AFTER INSERT OR DELETE OR UPDATE ON public.producer_applications FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS producer_applications_set_updated_at ON public.producer_applications;
CREATE TRIGGER producer_applications_set_updated_at BEFORE UPDATE ON public.producer_applications FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS producers_audit ON public.producers;
CREATE TRIGGER producers_audit AFTER INSERT OR DELETE OR UPDATE ON public.producers FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS producers_set_updated_at ON public.producers;
CREATE TRIGGER producers_set_updated_at BEFORE UPDATE ON public.producers FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS product_batches_set_updated_at ON public.product_batches;
CREATE TRIGGER product_batches_set_updated_at BEFORE UPDATE ON public.product_batches FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS product_change_requests_audit ON public.product_change_requests;
CREATE TRIGGER product_change_requests_audit AFTER INSERT OR DELETE OR UPDATE ON public.product_change_requests FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS product_change_requests_set_updated_at ON public.product_change_requests;
CREATE TRIGGER product_change_requests_set_updated_at BEFORE UPDATE ON public.product_change_requests FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS validate_product_change_request_v1 ON public.product_change_requests;
CREATE TRIGGER validate_product_change_request_v1 BEFORE INSERT OR UPDATE OF product_id, producer_id, requested_by, proposed_payload ON public.product_change_requests FOR EACH ROW EXECUTE FUNCTION private.validate_product_change_request_v1();

DROP TRIGGER IF EXISTS dispatch_stock_alerts_v1 ON public.product_inventory;
CREATE TRIGGER dispatch_stock_alerts_v1 AFTER UPDATE OF available_quantity, reserved_quantity ON public.product_inventory FOR EACH ROW EXECUTE FUNCTION private.dispatch_stock_alerts_v1();

DROP TRIGGER IF EXISTS product_inventory_set_updated_at ON public.product_inventory;
CREATE TRIGGER product_inventory_set_updated_at BEFORE UPDATE ON public.product_inventory FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS product_variants_set_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_set_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS products_audit ON public.products;
CREATE TRIGGER products_audit AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS products_claim_policy_guard ON public.products;
CREATE TRIGGER products_claim_policy_guard BEFORE INSERT OR UPDATE OF status, name, short_description, description, story, tags, features, specifications ON public.products FOR EACH ROW EXECUTE FUNCTION private.enforce_product_claim_policy();

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS refresh_product_search_text_v1 ON public.products;
CREATE TRIGGER refresh_product_search_text_v1 BEFORE INSERT OR UPDATE OF name, short_description, description, story, origin, tags, translations ON public.products FOR EACH ROW EXECUTE FUNCTION private.refresh_product_search_text_v1();

DROP TRIGGER IF EXISTS profiles_audit ON public.profiles;
CREATE TRIGGER profiles_audit AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS refunds_set_updated_at ON public.refunds;
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS sync_producer_finance_from_refund_v1 ON public.refunds;
CREATE TRIGGER sync_producer_finance_from_refund_v1 AFTER INSERT OR UPDATE OF status ON public.refunds FOR EACH ROW EXECUTE FUNCTION private.sync_producer_finance_from_refund_v1();

DROP TRIGGER IF EXISTS return_requests_audit ON public.return_requests;
CREATE TRIGGER return_requests_audit AFTER INSERT OR DELETE OR UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS return_requests_set_updated_at ON public.return_requests;
CREATE TRIGGER return_requests_set_updated_at BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS reviews_audit ON public.reviews;
CREATE TRIGGER reviews_audit AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS reviews_outbox ON public.reviews;
CREATE TRIGGER reviews_outbox AFTER UPDATE OF status ON public.reviews FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION private.enqueue_admin_domain_change();

DROP TRIGGER IF EXISTS reviews_set_updated_at ON public.reviews;
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS shipments_audit ON public.shipments;
CREATE TRIGGER shipments_audit AFTER INSERT OR DELETE OR UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

DROP TRIGGER IF EXISTS shipments_set_updated_at ON public.shipments;
CREATE TRIGGER shipments_set_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS shipping_zones_set_updated_at ON public.shipping_zones;
CREATE TRIGGER shipping_zones_set_updated_at BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============================================================
-- grants (matching live: authenticated for customer-facing,
-- service_role for *_for_service_v1, anon+authenticated for the
-- public traceability lookup)
-- ============================================================

REVOKE ALL ON FUNCTION public.apply_verified_refund_v1(uuid,uuid,text,text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_verified_refund_v1(uuid,uuid,text,text,bigint,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_my_stock_alert_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_my_stock_alert_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_push_deliveries_v1(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_deliveries_v1(integer,text) TO service_role;

REVOKE ALL ON FUNCTION public.complete_commerce_payment_for_service_v3(uuid,text,text,text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_commerce_payment_for_service_v3(uuid,text,text,text,jsonb,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.complete_event_refund_for_service_v1(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_event_refund_for_service_v1(uuid,text,text,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.complete_push_delivery_v1(bigint,boolean,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_push_delivery_v1(bigint,boolean,text,boolean) TO service_role;

REVOKE ALL ON FUNCTION public.fail_commerce_payment_intent_for_service_v2(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_commerce_payment_intent_for_service_v2(uuid,text,text,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.get_event_reservation_payment_state_for_service_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_reservation_payment_state_for_service_v1(uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_my_account_closure_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_account_closure_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_producer_location_change_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_producer_location_change_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.get_product_traceability_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_traceability_v1(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_customer_returns_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_returns_v1() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_event_refunds_required_for_service_v1(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_event_refunds_required_for_service_v1(integer) TO service_role;

REVOKE ALL ON FUNCTION public.list_my_conversations_v1(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_conversations_v1(integer,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_event_refund_attempt_for_service_v1(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_event_refund_attempt_for_service_v1(uuid,text) TO service_role;

REVOKE ALL ON FUNCTION public.prepare_event_reservation_hosted_payment_for_service_v1(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_event_reservation_hosted_payment_for_service_v1(uuid,uuid,text) TO service_role;

REVOKE ALL ON FUNCTION public.set_review_helpful_vote_v1(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_review_helpful_vote_v1(uuid,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.store_hosted_payment_session_for_service_v2(uuid,text,inet,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_hosted_payment_session_for_service_v2(uuid,text,inet,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.unregister_push_token_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unregister_push_token_v1(text) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_customer_address(uuid,text,text,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_address(uuid,text,text,text,text,text,text,text,text,text,text,boolean) TO authenticated;
