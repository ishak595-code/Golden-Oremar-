import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const v1Path=path.join(root,'supabase','migrations','20260821141917_harden_public_rpc_security_invoker_boundary_v1.sql');
const v2Path=path.join(root,'supabase','migrations','20260821142610_isolate_anonymous_rpc_privileges_in_api_internal_v2.sql');
const accountOverviewFixPath=path.join(root,'supabase','migrations','20260822085741_restore_authenticated_account_overview_core_execute_v1.sql');
const dependencyRepairPath=path.join(root,'supabase','migrations','20260822090049_restore_authenticated_invoker_private_dependencies_v1.sql');
const failures=[];
const publicFunctions=[
  'cancel_stock_alert_by_token_v1','catalog_search_suggestions_v1','check_product_export_eligibility_v1','confirm_newsletter_v1',
  'get_account_help_content_v1','get_checkout_payment_capabilities_v2','get_checkout_payment_readiness_v3','get_product_reviews_v1',
  'get_public_brand_appearance_v1','get_public_contact_config_v1','get_public_content_entry_v3','get_public_home_catalog_v3',
  'get_public_producer_follow_metrics_v1','get_public_producer_profile_v3','get_public_product_detail_v6','get_public_product_handling_profiles_v1',
  'get_public_product_safety_v3','get_public_storefront_config_v2','list_public_categories_v2','list_public_content_v1','list_public_events_v1',
  'list_public_faq_v1','list_public_producers_v1','list_public_production_locations_v1','report_client_error_v1','search_catalog_v3',
  'submit_contact_message','submit_event_reservation','subscribe_newsletter_v1','subscribe_stock_alert_v1','unsubscribe_newsletter_v1'
];
const authenticatedPrivateDependencies=[
  'admin_get_product_certifications_v1(uuid)',
  'admin_get_return_detail_v1(uuid)',
  'admin_list_product_editorial_reviews_v1()',
  'admin_record_product_organic_certificate_v1(uuid,text,text,date,date,text,boolean,text)',
  'admin_review_producer_location_change_v1(uuid,boolean,text)',
  'admin_review_product_change_v3(uuid,boolean,text,boolean,boolean,boolean,boolean)',
  'admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean)',
  'admin_revoke_product_certification_v1(uuid,text)',
  'get_my_order_return_options_v1(uuid)',
  'get_my_producer_order_detail_v1(uuid)',
  'get_my_return_detail_v1(uuid)',
  'get_product_editorial_editor_v1(text)',
  'list_my_producer_orders_v1(text,integer,integer)',
  'publish_product_editorial_v1(uuid,jsonb,uuid)',
  'resolve_product_id_v1(text)',
  'save_product_editorial_v1(text,jsonb,text,text)',
  'verified_product_video_path_v1(text)',
  'commercial_checkout_legal_readiness_v1()',
  'producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamptz)',
  'producer_mark_order_items_processing_v1(uuid,uuid[])',
  'request_customer_return_v3(uuid,jsonb,text,text)',
  'request_producer_location_change_v1(text,text,text,text,boolean,numeric,numeric,text)',
  'super_admin_get_business_identity_v2()',
  'super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean)',
  'update_customer_avatar_v1(text)',
  'update_my_producer_profile_v2(text,text,text,text,text)'
];
if(!fs.existsSync(v1Path)) failures.push('Public RPC SECURITY INVOKER migration is missing.');
else {
  const sql=fs.readFileSync(v1Path,'utf8').toLowerCase();
  for(const name of publicFunctions){if(!sql.includes(name.toLowerCase()))failures.push(`V1 boundary migration is missing RPC: ${name}`);}
  if(!sql.includes('security invoker')) failures.push('V1 boundary migration must establish SECURITY INVOKER public wrappers.');
}
if(!fs.existsSync(v2Path)) failures.push('Anonymous RPC isolation migration is missing.');
else {
  const sql=fs.readFileSync(v2Path,'utf8').toLowerCase();
  for(const name of publicFunctions){if(!sql.includes(`'${name.toLowerCase()}'`))failures.push(`api_internal allowlist is missing RPC: ${name}`);}
  const requirements=[
    ['create schema if not exists api_internal','api_internal schema must be created.'],
    ['revoke all on schema api_internal from public','api_internal schema must deny generic PUBLIC access.'],
    ['alter function api_internal.%i(%s) security definer','api_internal functions must be elevated only inside the isolated schema.'],
    ['security invoker set search_path','public wrappers must be regenerated as SECURITY INVOKER.'],
    ['revoke execute on all functions in schema private from anon','anon direct private function grants must be revoked.'],
    ['revoke usage on schema private from anon','anon must not have private schema USAGE.'],
    ['revoke all on all functions in schema api_internal from public','api_internal functions must deny generic PUBLIC execute.'],
    ['grant execute on all functions in schema api_internal to anon,authenticated,service_role','only runtime roles may execute the isolated API cores.']
  ];
  for(const [needle,message] of requirements){if(!sql.includes(needle))failures.push(message);}
}
if(!fs.existsSync(accountOverviewFixPath)) failures.push('Authenticated account overview privilege repair migration is missing.');
else {
  const sql=fs.readFileSync(accountOverviewFixPath,'utf8').toLowerCase().replace(/\s+/g,' ');
  if(!sql.includes('revoke all on function private.get_my_account_overview_v1() from public, anon')) failures.push('Account overview private core must remain denied to PUBLIC and anon.');
  if(!sql.includes('grant execute on function private.get_my_account_overview_v1() to authenticated')) failures.push('SECURITY INVOKER account overview wrapper requires authenticated execute on its private SECURITY DEFINER core.');
}
if(!fs.existsSync(dependencyRepairPath)) failures.push('Authenticated invoker dependency repair migration is missing.');
else {
  const sql=fs.readFileSync(dependencyRepairPath,'utf8').toLowerCase().replace(/\s+/g,' ');
  for(const signature of authenticatedPrivateDependencies){
    const normalized=signature.toLowerCase();
    if(!sql.includes(`revoke all on function private.${normalized} from public, anon`)) failures.push(`Authenticated invoker dependency must deny PUBLIC/anon: private.${signature}`);
    if(!sql.includes(`grant execute on function private.${normalized} to authenticated`)) failures.push(`Authenticated invoker dependency execute grant is missing: private.${signature}`);
  }
}
if(failures.length){console.error('Public RPC security boundary audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Public RPC security boundary audit passed: public wrappers are invoker-only, anonymous private-schema access is blocked, public-safe elevated cores are isolated in api_internal, and authenticated invoker wrappers retain only their required private SECURITY DEFINER dependency grants.');
