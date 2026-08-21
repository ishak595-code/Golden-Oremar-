import fs from 'node:fs';
import path from 'node:path';

const migrationPath=path.join(process.cwd(),'supabase','migrations','20260821141917_harden_public_rpc_security_invoker_boundary_v1.sql');
const failures=[];
if(!fs.existsSync(migrationPath)) failures.push('Public RPC security boundary migration is missing.');
else {
  const sql=fs.readFileSync(migrationPath,'utf8').toLowerCase();
  const invokerFunctions=[
    'cancel_stock_alert_by_token_v1','catalog_search_suggestions_v1','check_product_export_eligibility_v1','confirm_newsletter_v1',
    'get_account_help_content_v1','get_checkout_payment_capabilities_v2','get_checkout_payment_readiness_v3','get_product_reviews_v1',
    'get_public_brand_appearance_v1','get_public_contact_config_v1','get_public_content_entry_v3','get_public_home_catalog_v3',
    'get_public_producer_follow_metrics_v1','get_public_producer_profile_v3','get_public_product_detail_v6','get_public_product_handling_profiles_v1',
    'get_public_product_safety_v3','get_public_storefront_config_v2','list_public_categories_v2','list_public_content_v1','list_public_events_v1',
    'list_public_faq_v1','list_public_producers_v1','list_public_production_locations_v1','report_client_error_v1','search_catalog_v3',
    'submit_contact_message','submit_event_reservation','subscribe_newsletter_v1','subscribe_stock_alert_v1','unsubscribe_newsletter_v1'
  ];
  for(const name of invokerFunctions){
    const altered=new RegExp(`alter\\s+function\\s+public\\.${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*\\([^;]*?\\)\\s+security\\s+invoker\\s*;`,'i');
    const created=new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*\\([^)]*\\)[\\s\\S]{0,220}?security\\s+invoker`,'i');
    if(!altered.test(sql)&&!created.test(sql)) failures.push(`Public RPC must be SECURITY INVOKER: ${name}`);
  }
  if(!/create\s+or\s+replace\s+function\s+private\.get_checkout_payment_capabilities_v2\s*\(\)[\s\S]{0,220}?security\s+definer/i.test(sql)) failures.push('Payment capabilities privileged core must stay private SECURITY DEFINER.');
  if(!/create\s+or\s+replace\s+function\s+private\.get_checkout_payment_readiness_v3\s*\(\)[\s\S]{0,220}?security\s+definer/i.test(sql)) failures.push('Payment readiness privileged core must stay private SECURITY DEFINER.');
  if(!/revoke\s+all\s+on\s+function\s+private\./i.test(sql)) failures.push('Private public-safe cores must explicitly revoke generic PUBLIC execute privileges.');
}
if(failures.length){console.error('Public RPC security boundary audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Public RPC security boundary audit passed: exposed wrappers are SECURITY INVOKER and privileged payment cores remain private.');
