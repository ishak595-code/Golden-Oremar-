import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=(file)=>{const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing owner-governance contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');};
const requirePattern=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};
const forbidPattern=(source,pattern,message)=>{if(pattern.test(source))failures.push(message);};

const permissions=read('src/features/auth/permissions.ts');
const tabs=read('src/admin/adminCapabilities.ts');
const products=read('src/admin/AdminProducts.tsx');
const productApi=read('src/admin/productAdminApi.ts');
const staffMfa=read('scripts/staff-mfa-e2e.mjs');
const migration=read('supabase/migrations/20260824190311_require_super_admin_product_publication_v1.sql');

requirePattern(permissions,/'product\.publish'/,'Canonical product.publish permission is missing.');
requirePattern(permissions,/'product\.health_manage'/,'Canonical product.health_manage permission is missing.');
requirePattern(tabs,/'official-store-products'\s*:\s*'product\.publish'/,'Official-store product workspace must require product.publish.');
requirePattern(tabs,/'product-health'\s*:\s*'product\.health_manage'/,'Product-health workspace must require product.health_manage.');
requirePattern(tabs,/'product-approvals'\s*:\s*'product\.moderate'/,'Moderation queue must remain independently available through product.moderate.');

requirePattern(products,/authorization_has_permission_v1[\s\S]*p_permission_key:'product\.publish'/,'Product approval UI must resolve final publication authority from the server capability contract.');
requirePattern(products,/setCanPublish\(!permission\.error&&permission\.data===true\)/,'Product approval UI must fail closed when product.publish cannot be verified.');
requirePattern(products,/autoApproveReady=selectedProduct\?Boolean\(canPublish/,'Product approval readiness must remain gated by verified product.publish authority.');
forbidPattern(products,/sessionRoles\.includes\('super_admin'\)|isSuperAdmin/,'Product approval UI must not reintroduce role-name authorization shortcuts.');
requirePattern(productApi,/admin_review_product_v3/,'Product moderation must use the canonical public review wrapper.');
requirePattern(productApi,/admin_review_product_change_v2/,'Product-change moderation must use the canonical public review wrapper.');

requirePattern(migration,/\('super_admin','product\.publish'\)/,'product.publish must remain granted to Super Admin.');
requirePattern(migration,/\('super_admin','product\.health_manage'\)/,'product.health_manage must remain granted to Super Admin.');
requirePattern(migration,/permission_key in \('product\.publish','product\.health_manage'\) and role<>'super_admin'/,'Owner-only product capabilities must be removed from every non-owner role.');
requirePattern(migration,/permission_required:product\.publish/,'Backend publication must require product.publish.');
requirePattern(migration,/published_product_health_required/,'Public product exposure must require a published product-health package.');
requirePattern(migration,/enforce_super_admin_product_publication_v1/,'Database publication trigger must remain installed.');
requirePattern(migration,/protect_active_product_health_content_v1/,'Published product-health lifecycle protection must remain installed.');
requirePattern(migration,/product\.health_manage[\s\S]*super_admin_required/,'Product-health mutation APIs must remain owner-capability gated.');
for(const legacy of ['admin_review_product_v1','admin_review_product_v2','admin_review_product_v3','admin_review_product_change_v1','admin_review_product_change_v2']){
  requirePattern(migration,new RegExp(`revoke all on function private\\.${legacy}`),`Legacy direct private review execution must remain revoked: ${legacy}.`);
}
requirePattern(migration,/product_health\.publish/,'Product-health publication must remain audit logged.');
requirePattern(migration,/product_health\.reject/,'Product-health rejection must remain audit logged.');

requirePattern(staffMfa,/\['admin\.access','product\.moderate','product\.publish','product\.health_manage'/,'AAL1 staff denial must cover owner-only product capabilities.');
requirePattern(staffMfa,/for\(const p of \['product\.publish','product\.health_manage'/,'Moderator AAL2 must explicitly deny owner-only product capabilities.');
requirePattern(staffMfa,/roleScenario\('admin'[\s\S]*\['product\.publish','product\.health_manage'/,'Admin AAL2 must explicitly deny owner-only product capabilities.');
requirePattern(staffMfa,/roleScenario\('super_admin'[\s\S]*'product\.publish','product\.health_manage'/,'Super Admin AAL2 must explicitly receive owner-only product capabilities.');

if(failures.length){
  console.error('Golden Oremar product owner governance contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Golden Oremar product owner governance contract audit passed: final publication and product-health authority remain Super Admin capability-gated, health-package dependent, server-enforced and MFA-regressed.');
