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

if(api){
  requirePattern(api,/super_admin_get_release_setup_v2/,'Release setup must read through the canonical Super Admin v2 RPC.');
  requirePattern(api,/super_admin_update_release_setup_v2/,'Release setup must write through the canonical Super Admin v2 RPC.');
  requirePattern(api,/p_activate_for_production/,'Release setup must expose explicit production activation rather than publishing configuration implicitly.');
  requirePattern(api,/server_only_never_store_in_public_config/,'Release setup must enforce the server-only secret policy.');
  forbidPattern(api,/super_admin_(?:get|update)_release_setup_v1/,'Retired release setup v1 RPC must not return to browser runtime code.');
  for(const [re,label] of [
    [/p_iyzico_(?:api|secret)_key/i,'iyzico secret'],
    [/p_(?:fcm|apns)_private_key/i,'push private key'],
    [/p_(?:google|facebook)_.*secret/i,'OAuth client secret'],
    [/p_.*signing.*(?:key|password)/i,'store signing secret'],
  ]) forbidPattern(api,re,`Browser release setup API must never accept ${label}.`);
}
if(page){
  requirePattern(page,/Yayın ve Entegrasyon/,'Super Admin release setup page title is missing.');
  requirePattern(page,/Secret güvenliği/,'Release setup must explain the server-only secret boundary.');
  requirePattern(page,/server-side secret store/,'Release setup must explicitly keep high-risk secrets out of the browser form.');
  requirePattern(page,/Canlı yapılandırmayı etkinleştir/,'Release setup must require explicit production activation.');
  requirePattern(page,/https:\/\/goldenoremar\.com/,'Release setup must load a complete editable Golden Oremar starting configuration.');
}
if(adminPage){
  requirePattern(adminPage,/AdminReleaseSetup/,'AdminPage must lazy-load the release setup page.');
  requirePattern(adminPage,/case'release-setup'/,'AdminPage release-setup route is missing.');
}
if(layout)requirePattern(layout,/id: 'release-setup', label: 'Yayın ve Entegrasyon'/,'Super Admin navigation must expose the release setup page.');
if(business){
  requirePattern(business,/Tescilli ticari unvan/,'Business compliance must expose registered legal name management.');
  requirePattern(business,/Vergi \/ kimlik numarası/,'Business compliance must expose tax/identity number management.');
  requirePattern(business,/MERSİS numarası/,'Business compliance must expose MERSIS management.');
  requirePattern(business,/Ticaret sicil numarası/,'Business compliance must expose trade-registry management.');
  requirePattern(business,/Yasal belgeler gerçek işletme kimliğiyle son olarak onaylandı/,'Business verification confirmation control is missing.');
}

if(failures.length){console.error('Golden Oremar release setup contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar release setup contract audit passed: Super Admin v2 configuration is wired, production activation is explicit, and browser-side secrets remain prohibited.');
