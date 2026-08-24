import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
const read=file=>{const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing owner governance contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');};
const req=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};
const forbid=(source,pattern,message)=>{if(pattern.test(source))failures.push(message);};

const permissions=read('src/features/auth/permissions.ts');
req(permissions,/'product\.publish'/,'Canonical product.publish permission is missing.');
req(permissions,/'product\.health_manage'/,'Canonical product.health_manage permission is missing.');

const tabs=read('src/admin/adminCapabilities.ts');
req(tabs,/'product-health'\s*:\s*'product\.health_manage'/,'Product health admin tab must require owner-only product.health_manage.');
req(tabs,/'product-approvals'\s*:\s*'product\.moderate'/,'Product moderation queue must remain available to authorized moderators for inspection/rejection.');

const products=read('src/admin/AdminProducts.tsx');
req(products,/can\('product\.publish'\)/,'Product approval UI must derive final publication authority from product.publish.');
req(products,/!autoApproveReady\|\|!canPublish/,'Final publication action must be disabled without product.publish.');
req(products,/Public yayın için Super Admin owner onayı gerekir/,'Non-owner moderation UI must explain the owner publication boundary.');
req(products,/Ürün İçerik ve Sağlık Kontrolü/,'Product approval UI must surface the mandatory health-package prerequisite.');

const migration=read('supabase/migrations/20260824190311_require_super_admin_product_publication_v1.sql');
req(migration,/\('super_admin','product\.publish'\)/,'product.publish must be granted to Super Admin.');
req(migration,/\('super_admin','product\.health_manage'\)/,'product.health_manage must be granted to Super Admin.');
req(migration,/role<>'super_admin'/,'Owner-only capabilities must be removed from every non-owner role.');
req(migration,/permission_required:product\.publish/,'Backend final publication must require product.publish.');
req(migration,/published_product_health_required/,'Public product exposure must require a published health package.');
req(migration,/enforce_super_admin_product_publication_v1/,'Database publication trigger is missing.');
req(migration,/protect_active_product_health_content_v1/,'Published product health lifecycle protection is missing.');
req(migration,/product\.health_manage[\s\S]*super_admin_required/,'Product health mutation APIs must require the owner capability.');
for(const legacy of['admin_review_product_v1','admin_review_product_v2','admin_review_product_v3','admin_review_product_change_v1','admin_review_product_change_v2'])req(migration,new RegExp(`revoke all on function private\\.${legacy}`),`Direct authenticated execution must be revoked from ${legacy}.`);
req(migration,/product_health\.publish/,'Product health publication must write an audit event.');
req(migration,/product_health\.reject/,'Product health rejection must write an audit event.');
forbid(migration,/grant\s+execute[\s\S]*product\.publish[\s\S]*(?:admin|moderator|operations)/i,'Owner publication capability must never be granted to normal staff roles.');

const mfaE2E=read('scripts/staff-mfa-e2e.mjs');
req(mfaE2E,/moderator AAL2 leaked \$\{p\}/,'Moderator AAL2 capability negatives must remain explicit.');
req(mfaE2E,/product\.publish','Staff MFA E2E must exercise product.publish.');
req(mfaE2E,/product\.health_manage/,'Staff MFA E2E must exercise product.health_manage.');
req(mfaE2E,/moderator owner publication attack/,'Moderator direct approval attack must be tested.');
req(mfaE2E,/admin owner publication attack/,'Admin direct approval attack must be tested.');
req(mfaE2E,/Super Admin product publication endpoint/,'Super Admin AAL2 positive publication permission probe is missing.');
req(mfaE2E,/permissions\.length>=79/,'Super Admin must retain the complete active capability set after owner governance expansion.');

if(failures.length){console.error('Golden Oremar product owner governance contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar product owner governance contract audit passed.');
