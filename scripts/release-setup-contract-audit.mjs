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
  requirePattern(api,/super_admin_get_release_setup_v1/,'Release setup must read through the Super Admin RPC.');
  requirePattern(api,/super_admin_update_release_setup_v1/,'Release setup must write through the Super Admin RPC.');
  requirePattern(api,/server_only_never_store_in_public_config/,'Release setup must enforce the server-only secret policy.');
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
  requirePattern(page,/API secret, private key ve signing key/,'Release setup must explicitly keep high-risk secrets out of the browser form.');
}
if(adminPage){
  requirePattern(adminPage,/AdminReleaseSetup/,'AdminPage must lazy-load the release setup page.');
  requirePattern(adminPage,/case'release-setup'/,'AdminPage release-setup route is missing.');
}
if(layout)requirePattern(layout,/id: 'release-setup', label: 'Yayın ve Entegrasyon'/,'Super Admin navigation must expose the release setup page.');
if(business){
  requirePattern(business,/Golden Oremar/,'Business compliance must retain the Golden Oremar provisional starting identity.');
  requirePattern(business,/Hakkari, Türkiye/,'Business compliance must retain the editable Hakkari/Türkiye provisional address.');
  requirePattern(business,/Gerçek tescil kimliği girildi ve yasal belgeler son kez onaylandı/,'Business verification confirmation control is missing.');
}

if(failures.length){console.error('Golden Oremar release setup contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar release setup contract audit passed: Super Admin release configuration is wired and browser-side secrets remain prohibited.');
