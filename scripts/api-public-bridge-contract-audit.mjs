import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migrationPath=path.join(root,'supabase','migrations','20260822101148_create_api_public_bridge_v1.sql');
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
if(!fs.existsSync(migrationPath))failures.push('Final api_public_bridge migration is missing.');
else{
 const sql=fs.readFileSync(migrationPath,'utf8').toLowerCase().replace(/\s+/g,' ');
 for(const name of publicFunctions)if(!sql.includes(`'${name}'`))failures.push(`api_public_bridge allowlist is missing RPC: ${name}`);
 const requirements=[
  ['create schema if not exists api_public_bridge','api_public_bridge schema must be created.'],
  ['revoke all on schema api_public_bridge from public','Generic PUBLIC must have no api_public_bridge schema rights.'],
  ['grant usage on schema api_public_bridge to anon,authenticated,service_role','Only runtime roles may use api_public_bridge.'],
  ['alter function api_public_bridge.%i(%s) security definer','Only bridge cores may retain SECURITY DEFINER.'],
  ["replace(definition,'api_internal.','api_public_bridge.')",'Public wrappers must be rewritten from api_internal to api_public_bridge.'],
  ['alter function public.%i(%s) security invoker','Public wrappers must remain SECURITY INVOKER.'],
  ['revoke all on all functions in schema api_internal from anon,authenticated','Application roles must lose direct api_internal function access.'],
  ['revoke usage on schema api_internal from anon,authenticated','Application roles must lose api_internal schema USAGE.'],
  ['grant usage on schema api_internal to service_role','Service role compatibility must remain explicit.']
 ];
 for(const[needle,message]of requirements)if(!sql.includes(needle))failures.push(message);
}
if(failures.length){console.error('api_public_bridge contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('api_public_bridge contract audit passed: 31 public-safe RPCs remain SECURITY INVOKER at public.*, elevated cores live in the dedicated bridge, and anon/authenticated can no longer enter api_internal directly.');
