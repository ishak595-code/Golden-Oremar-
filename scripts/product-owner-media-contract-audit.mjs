import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Required owner/media file is missing: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function requireText(source,text,message){if(!source.includes(text))failures.push(message);}
function requirePattern(source,pattern,message){if(!pattern.test(source))failures.push(message);}
function forbidText(source,text,message){if(source.includes(text))failures.push(message);}

const ownerMigration=read('supabase/migrations/20260824190311_require_super_admin_product_publication_v1.sql');
const binaryMigration=read('supabase/migrations/20260824201700_enforce_catalog_media_binary_verification_v2.sql');
const publishStateMigration=read('supabase/migrations/20260826094433_harden_super_admin_product_publish_state_v2.sql');
const officialMediaMigration=read('supabase/migrations/20260826101337_require_super_admin_official_catalog_media_v1.sql');
const historicalBinaryV1=read('supabase/migrations/20260824194626_add_catalog_media_binary_verification_v1.sql');
const historicalManualV1=read('supabase/migrations/20260824195156_simplify_catalog_media_to_manual_review_v1.sql');
const verifier=read('supabase/functions/catalog-media-verify/index.ts');
const retiredVerifier=read('supabase/functions/verify-catalog-media/index.ts');
const producerApi=read('src/features/producer-products/api.ts');
const officialApi=read('src/admin/officialStoreProductApi.ts');
const capabilities=read('src/admin/adminCapabilities.ts');
const permissions=read('src/features/auth/permissions.ts');
const healthApi=read('src/admin/catalogMediaHealthApi.ts');
const healthScreen=read('src/admin/AdminProductHealth.tsx');
const staffE2E=read('scripts/staff-mfa-e2e.mjs');
const staffWorkflow=read('.github/workflows/staff-owner-security-e2e.yml');

requireText(ownerMigration,"('product.publish'",'Owner publication permission must exist.');
requireText(ownerMigration,"('product.health_manage'",'Owner product-health permission must exist.');
requirePattern(ownerMigration,/delete from private\.role_permissions[\s\S]*role<>'super_admin'/,'Owner capabilities must be removed from non-Super-Admin roles.');
requireText(ownerMigration,"values ('super_admin','product.publish'),('super_admin','product.health_manage')",'Both owner capabilities must be assigned to Super Admin.');
requireText(ownerMigration,"permission_required:product.publish",'Final publication RPC/trigger must require product.publish.');
requireText(ownerMigration,"published_product_health_required",'Final publication must require the published health package.');

requirePattern(publishStateMigration,/if new\.status='published'[\s\S]*publication_requested:=true/,'Every first transition into published state must become an owner publication request.');
requireText(publishStateMigration,"private.has_permission('product.publish')",'Published-state trigger must enforce the owner publication capability.');
requirePattern(publishStateMigration,/content_type='product_health'[\s\S]*locale='tr'[\s\S]*status='published'/,'Published-state trigger must require the Turkish published health package.');
requireText(publishStateMigration,'published_product_health_content_cannot_be_removed','Published product health content must fail closed against removal or invalidation.');
requirePattern(publishStateMigration,/where p\.id=p_product_id[\s\S]*p\.status='published'[\s\S]*not private\.product_media_integrity_ok_v1/,'Media integrity must cover every published product, not only active products.');

requireText(binaryMigration,'private.catalog_media_binary_verifications_v2','Canonical binary verification ledger v2 is missing.');
requirePattern(binaryMigration,/object_id uuid primary key references storage\.objects\(id\) on delete cascade/,'Binary verification must bind to the real Storage object and clean up on delete.');
requireText(binaryMigration,'object_version','Binary verification must bind to Storage object version.');
requireText(binaryMigration,'object_updated_at','Binary verification must bind to Storage update time.');
requireText(binaryMigration,'sha256','Binary verification must persist a SHA-256 digest.');
requireText(binaryMigration,'private.catalog_media_binary_verified_path_v2','Published image verification must route through the canonical binary ledger.');
requireText(binaryMigration,'public.super_admin_catalog_media_health_v2','Super Admin media health RPC v2 is missing.');
requireText(binaryMigration,"private.has_permission('product.health_manage')",'Media health RPC must require product.health_manage.');

requireText(historicalBinaryV1,'Historical production migration archive.','Superseded binary verification v1 production version must be explicitly archived in source control.');
requireText(historicalBinaryV1,'20260824195156_simplify_catalog_media_to_manual_review_v1','Archived v1 migration must document its immediate superseding migration.');
requireText(historicalManualV1,'drop table if exists private.catalog_media_verifications','Manual-review migration must preserve production retirement of transient v1 verification storage.');
requireText(historicalManualV1,'private.verified_product_video_path_v1','Manual-review migration must preserve the production video helper state before canonical image v2.');

requireText(officialMediaMigration,"coalesce(private.has_permission('product.publish'),false)",'Official catalog Storage policy must require product.publish.');
requireText(officialMediaMigration,"'official-products'",'Official catalog Storage policy must be scoped to the official-products namespace.');
requireText(officialMediaMigration,'storage_admin_public_assets_insert_v2','Hardened official catalog INSERT policy is missing.');
requireText(officialMediaMigration,'storage_admin_public_assets_update_v3','Hardened official catalog UPDATE policy is missing.');
requireText(officialMediaMigration,'storage_admin_public_assets_delete_v3','Hardened official catalog DELETE policy is missing.');

requireText(verifier,"p_permission_key:'product.publish'",'Official catalog binary verification must require product.publish.');
requireText(verifier,"p_permission_key:'admin.access'",'Official catalog binary verification must also require an active admin shell.');
for(const token of ["'image/jpeg'","'image/png'","'image/webp'","'image/avif'"])requireText(verifier,token,`Canonical verifier is missing ${token}.`);
requireText(verifier,"crypto.subtle.digest('SHA-256'",'Canonical verifier must calculate SHA-256 from binary bytes.');
requireText(verifier,".eq('owner_user_id',userId)",'Producer media verification must bind to the authenticated producer owner.');
requireText(verifier,".eq('status','active')",'Producer media verification must require an active producer.');
requireText(verifier,".eq('is_verified',true)",'Producer media verification must require producer verification.');
requireText(verifier,".eq('origin_verified',true)",'Producer media verification must require origin verification.');
requireText(verifier,'ADMIN_PATH_RE','Canonical verifier must enforce the official admin namespace.');
forbidText(verifier,"p_permission_key:'product.update'",'Official catalog verification must not fall back to generic product.update authority.');
requireText(retiredVerifier,'410','Retired duplicate media verifier must return HTTP 410.');
requireText(retiredVerifier,'catalog-media-verify','Retired verifier must point callers to the canonical endpoint.');

for(const api of [producerApi,officialApi]){
 requireText(api,"functions.invoke('catalog-media-verify'",'Every catalog image upload path must invoke the canonical binary verifier.');
 requirePattern(api,/catch\(error\)[\s\S]*storage\.from\('catalog-public'\)\.remove\(uploaded\)/,'Catalog image upload must compensate by deleting newly uploaded objects after verification failure.');
}
requireText(officialApi,'admin/${userId}/official-products/${crypto.randomUUID()}','Official media paths must be randomized inside the acting owner namespace.');
requireText(producerApi,'${normalizedProducerId}/products/${crypto.randomUUID()}','Producer media paths must be randomized inside the producer namespace.');

requirePattern(capabilities,/id:'product-health'[\s\S]*permission:'product\.health_manage'/,'Product Health admin surface must require product.health_manage.');
requirePattern(capabilities,/id:'official-store-products'[\s\S]*permission:'product\.publish'/,'Official Store Product manager must require product.publish.');
requireText(permissions,"'product.publish'",'Frontend permission contract must know product.publish.');
requireText(permissions,"'product.health_manage'",'Frontend permission contract must know product.health_manage.');
requireText(healthApi,"rpc('super_admin_catalog_media_health_v2')",'Product health API must load the canonical media health RPC.');
requireText(healthScreen,'Katalog medya sağlığı','Super Admin Product Health screen must expose media health.');
for(const label of ['Sağlıklı','Eksik','Yetim','Geçersiz'])requireText(healthScreen,label,`Media health UI is missing ${label}.`);

requirePattern(staffE2E,/moderator AAL2 leaked[\s\S]*product\.publish|product\.publish[\s\S]*moderator AAL2 leaked/,'Moderator AAL2 must explicitly deny product.publish.');
requireText(staffE2E,"['product.publish','product.health_manage','role.manage'",'Admin AAL2 must explicitly deny both owner capabilities.');
requireText(staffE2E,"['admin.access','product.publish','product.health_manage'",'Super Admin AAL2 must explicitly allow both owner capabilities.');
requireText(staffE2E,'catalog_media_binary_type_invalid','Real Storage E2E must prove fake image MIME binary rejection.');
requireText(staffE2E,"detectedMime,'image/png'",'Real Storage E2E must prove a valid PNG binary is accepted.');
requireText(staffE2E,"storage.from('catalog-public').remove(uploaded)",'Real Storage E2E must clean up its temporary catalog objects.');
requireText(staffWorkflow,'node scripts/staff-mfa-e2e.mjs','Pull requests must run the real-JWT staff owner security E2E.');
requireText(staffWorkflow,'id-token: write','Staff owner E2E must use short-lived GitHub OIDC control authorization.');

if(failures.length){console.error('Product owner/media contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Product owner/media contract audit passed.');
