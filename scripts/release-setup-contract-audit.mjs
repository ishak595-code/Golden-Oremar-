import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function file(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Required release setup file is missing: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(content,re,message){if(!re.test(content))failures.push(message);}
function forbidPattern(content,re,message){if(re.test(content))failures.push(message);}

const api=file('src/admin/releaseSetupAdminApi.ts');
const page=file('src/admin/AdminReleaseSetup.tsx');
const adminPage=file('src/pages/AdminPage.tsx');
const layout=file('src/admin/AdminLayout.tsx');
const business=file('src/admin/AdminBusinessCompliance.tsx');
const runtime=file('supabase/functions/_shared/integration_runtime.ts');
const iyzico=file('supabase/functions/_shared/iyzico.ts');
const push=file('supabase/functions/push-dispatch/index.ts');
const email=file('supabase/functions/transactional-email-worker/index.ts');
const readiness=file('supabase/functions/production-readiness-health/index.ts');

if(api){
 requirePattern(api,/super_admin_get_release_setup_v2/,'Release setup must read through the canonical Super Admin v2 RPC.');
 requirePattern(api,/super_admin_update_release_setup_v2/,'Release setup must write through the canonical Super Admin v2 RPC.');
 requirePattern(api,/super_admin_get_integration_secret_status_v1/,'Release setup must read Vault secret readiness without retrieving secret values.');
 requirePattern(api,/super_admin_set_integration_secret_v1/,'Release setup must update integration secrets through the Super Admin Vault RPC.');
 requirePattern(api,/super_admin_set_iyzico_environment_v1/,'Release setup must manage iyzico sandbox/production environment through the canonical RPC.');
 requirePattern(api,/server_only_never_store_in_public_config/,'Release setup must enforce the server-only secret policy.');
 forbidPattern(api,/service_get_integration_runtime_v1/,'Browser code must never call the service-role integration runtime RPC.');
 forbidPattern(api,/localStorage|sessionStorage/,'Integration secrets must never be persisted in browser storage.');
 forbidPattern(api,/super_admin_(?:get|update)_release_setup_v1/,'Retired release setup v1 RPC must not return to browser runtime code.');
}
if(page){
 requirePattern(page,/Yayın ve Entegrasyon/,'Super Admin release setup page title is missing.');
 requirePattern(page,/Supabase Vault/,'Release setup must explain encrypted Supabase Vault storage.');
 requirePattern(page,/kaydedildikten sonra tarayıcıya geri gönderilmez/,'Release setup must explain that stored secrets are never returned to the browser.');
 requirePattern(page,/Canlı yapılandırmayı etkinleştir/,'Release setup must require explicit production activation.');
 requirePattern(page,/https:\/\/goldenoremar\.com/,'Release setup must load a complete editable Golden Oremar starting configuration.');
 requirePattern(page,/iyzico çalışma ortamı/,'Release setup must expose sandbox/production iyzico environment control.');
}
if(runtime){
 requirePattern(runtime,/service_get_integration_runtime_v1/,'Edge runtime loader must use the service-role-only Vault runtime RPC.');
 requirePattern(runtime,/SUPABASE_SERVICE_ROLE_KEY/,'Vault runtime loader must authenticate with service role on the server.');
 requirePattern(runtime,/integrationReadiness/,'Vault runtime loader must expose shared provider readiness semantics.');
}
if(iyzico)requirePattern(iyzico,/loadIntegrationRuntime/,'iyzico provider core must load credentials from the canonical integration runtime.');
if(push)requirePattern(push,/loadIntegrationRuntime/,'Push dispatch must load FCM/APNs credentials from the canonical integration runtime.');
if(email){requirePattern(email,/loadIntegrationRuntime/,'Transactional email worker must load Resend configuration from the canonical integration runtime.');requirePattern(email,/ku:'ku'/,'Transactional email worker must retain Kurdish locale support.');}
if(readiness)requirePattern(readiness,/integrationReadiness\(runtimeConfig\)/,'Production readiness health must use the same runtime provider readiness contract as live workers.');
if(adminPage){requirePattern(adminPage,/AdminReleaseSetup/,'AdminPage must lazy-load the release setup page.');requirePattern(adminPage,/case'release-setup'/,'AdminPage release-setup route is missing.');}
if(layout)requirePattern(layout,/id: 'release-setup', label: 'Yayın ve Entegrasyon'/,'Super Admin navigation must expose the release setup page.');
if(business){
 requirePattern(business,/Tescilli ticari unvan/,'Business compliance must expose registered legal name management.');
 requirePattern(business,/Vergi \/ kimlik numarası/,'Business compliance must expose tax/identity number management.');
 requirePattern(business,/MERSİS numarası/,'Business compliance must expose MERSIS management.');
 requirePattern(business,/Ticaret sicil numarası/,'Business compliance must expose trade-registry management.');
 requirePattern(business,/Gerçek tescil kimliği girildi ve yasal belgeler son kez onaylandı/,'Business verification confirmation control is missing.');
}

if(failures.length){console.error('Golden Oremar release setup contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar release setup contract audit passed: Super Admin configuration, encrypted Vault secrets, provider runtime wiring and browser secret boundaries are canonical.');
