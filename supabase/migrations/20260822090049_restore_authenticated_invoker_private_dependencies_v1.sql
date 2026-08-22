revoke all on function private.admin_get_product_certifications_v1(uuid) from public, anon;
grant execute on function private.admin_get_product_certifications_v1(uuid) to authenticated;

revoke all on function private.admin_get_return_detail_v1(uuid) from public, anon;
grant execute on function private.admin_get_return_detail_v1(uuid) to authenticated;

revoke all on function private.admin_list_product_editorial_reviews_v1() from public, anon;
grant execute on function private.admin_list_product_editorial_reviews_v1() to authenticated;

revoke all on function private.admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text) from public, anon;
grant execute on function private.admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text) to authenticated;

revoke all on function private.admin_review_producer_location_change_v1(uuid,boolean,text) from public, anon;
grant execute on function private.admin_review_producer_location_change_v1(uuid,boolean,text) to authenticated;

revoke all on function private.admin_review_product_change_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function private.admin_review_product_change_v3(uuid,boolean,text,boolean,boolean,boolean,boolean) to authenticated;

revoke all on function private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean) to authenticated;

revoke all on function private.admin_revoke_product_certification_v1(uuid,text) from public, anon;
grant execute on function private.admin_revoke_product_certification_v1(uuid,text) to authenticated;

revoke all on function private.get_my_order_return_options_v1(uuid) from public, anon;
grant execute on function private.get_my_order_return_options_v1(uuid) to authenticated;

revoke all on function private.get_my_producer_order_detail_v1(uuid) from public, anon;
grant execute on function private.get_my_producer_order_detail_v1(uuid) to authenticated;

revoke all on function private.get_my_return_detail_v1(uuid) from public, anon;
grant execute on function private.get_my_return_detail_v1(uuid) to authenticated;

revoke all on function private.get_product_editorial_editor_v1(text) from public, anon;
grant execute on function private.get_product_editorial_editor_v1(text) to authenticated;

revoke all on function private.list_my_producer_orders_v1(text,integer,integer) from public, anon;
grant execute on function private.list_my_producer_orders_v1(text,integer,integer) to authenticated;

revoke all on function private.publish_product_editorial_v1(uuid,jsonb,uuid) from public, anon;
grant execute on function private.publish_product_editorial_v1(uuid,jsonb,uuid) to authenticated;

revoke all on function private.resolve_product_id_v1(text) from public, anon;
grant execute on function private.resolve_product_id_v1(text) to authenticated;

revoke all on function private.save_product_editorial_v1(text,jsonb,text,text) from public, anon;
grant execute on function private.save_product_editorial_v1(text,jsonb,text,text) to authenticated;

revoke all on function private.verified_product_video_path_v1(text) from public, anon;
grant execute on function private.verified_product_video_path_v1(text) to authenticated;

revoke all on function private.commercial_checkout_legal_readiness_v1() from public, anon;
grant execute on function private.commercial_checkout_legal_readiness_v1() to authenticated;

revoke all on function private.producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamptz) from public, anon;
grant execute on function private.producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamptz) to authenticated;

revoke all on function private.producer_mark_order_items_processing_v1(uuid,uuid[]) from public, anon;
grant execute on function private.producer_mark_order_items_processing_v1(uuid,uuid[]) to authenticated;

revoke all on function private.request_customer_return_v3(uuid,jsonb,text,text) from public, anon;
grant execute on function private.request_customer_return_v3(uuid,jsonb,text,text) to authenticated;

revoke all on function private.request_producer_location_change_v1(text,text,text,text,boolean,numeric,numeric,text) from public, anon;
grant execute on function private.request_producer_location_change_v1(text,text,text,text,boolean,numeric,numeric,text) to authenticated;

revoke all on function private.super_admin_get_business_identity_v2() from public, anon;
grant execute on function private.super_admin_get_business_identity_v2() to authenticated;

revoke all on function private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

revoke all on function private.update_customer_avatar_v1(text) from public, anon;
grant execute on function private.update_customer_avatar_v1(text) to authenticated;

revoke all on function private.update_my_producer_profile_v2(text,text,text,text,text) from public, anon;
grant execute on function private.update_my_producer_profile_v2(text,text,text,text,text) to authenticated;
