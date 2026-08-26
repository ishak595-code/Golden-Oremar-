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
const officialFallbackMigration=read('supabase/migrations/20260826114508_allow_official_store_brand_fallback_publication_v1.sql');
const readinessContractMigration=read('supabase/migrations/20260826122833_canonicalize_publish_readiness_media_contract_v2.sql');
const readinessSemanticsMigration=read('supabase/migrations/20260826123321_canonicalize_publish_readiness_media_block_semantics_v3.sql');
const mediaHealthIsolationMigration=read('supabase/migrations/20260826123459_isolate_super_admin_catalog_media_health_definer_v3.sql');
const historicalBinaryV1=read('supabase/migrations/20260824194626_add_catalog_media_binary_verification_v1.sql');
const historicalManualV1=read('supabase/migrations/20260824195156_simplify_catalog_media_to_manual_review_v1.sql');
const verifier=read('supabase/functions/catalog-media-verify/index.ts');
const retiredVerifier=read('supabase/functions/verify-catalog-media/index.ts');
const retiredOwnerPublisher=read('supabase/functions/catalog-owner-publish-maintenance/index.ts');
const producerApi=read('src/features/producer-products/api.ts');
const officialApi=read('src/admin/officialStoreProductApi.ts');
const readinessApi=read('src/admin/productPublishReadinessApi.ts');
const capabilities=read('src/admin/adminCapabilities.ts');
const permissions=read('src/features/auth/permissions.ts');
const healthApi=read('src/admin/catalogMediaHealthApi.ts');
const healthScreen=read('src/admin/AdminProductHealth.tsx');
const staffE2E=read('scripts/staff-mfa-e2e.mjs');
const customerE2E=read('scripts/customer-e2e.mjs');
const mobileWorkflow=read('.github/workflows/mobile-quality.yml');

requireText(ownerMigration,"('product.publish'",'Owner publication permission must exist.');
requireText(ownerMigration,"('product.health_manage'",'Owner product-health permission must exist.');
requirePattern(ownerMigration,/delete from private\.role_permissions[\s\S]*role<>'super_admin'/,'Owner capabilities must be removed from non-Super-Admin roles.');
requireText(ownerMigration,"values ('super_admin','product.publish'),('super_admin','product.health_manage')",'Both owner capabilities must be assigned to Super Admin.');
requireText(ownerMigration,'permission_required:product.publish','Final publication RPC/trigger must require product.publish.');
requireText(ownerMigration,'published_product_health_required','Final publication must require the published health package.');

requirePattern(publishStateMigration,/if new\.status='published'[\s\S]*publication_requested:=true/,'Every first transition into published state must become an owner publication request.');
requireText(publishStateMigration,"private.has_permission('product.publish')",'Published-state trigger must enforce the owner publication capability.');
requirePattern(publishStateMigration,/content_type='product_health'[\s\S]*locale='tr'[\s\S]*status='published'/,'Published-state trigger must require the Turkish published health package.');
requireText(publishStateMigration,'published_product_health_content_cannot_be_removed','Published product health content must fail closed against removal or invalidation.');
requirePattern(publishStateMigration,/where p\.id=p_product_id[\s\S]*p\.status='published'[\s\S]*not private\.product_media_integrity_ok_v1/,'Media integrity must cover every published product, not only active products.');

requireText(binaryMigration,'private.catalog_media_binary_verifications_v2','Canonical binary verification ledger v2 is missing.');
requirePattern(binaryMigration,/object_id uuid primary key references storage\.objects\(id\) on delete cascade/,'Binary verification must bind to the real Storage object and clean up on delete.');
for(const token of ['object_version','object_updated_at','sha256','private.catalog_media_binary_verified_path_v2','public.super_admin_catalog_media_health_v2'])requireText(binaryMigration,token,`Binary/media-health contract is missing ${token}.`);
requireText(binaryMigration,"private.has_permission('product.health_manage')",'Media health RPC must require product.health_manage.');

requireText(historicalBinaryV1,'Historical production migration archive.','Superseded binary verification v1 production version must be explicitly archived in source control.');
requireText(historicalBinaryV1,'20260824195156_simplify_catalog_media_to_manual_review_v1','Archived v1 migration must document its immediate superseding migration.');
requireText(historicalManualV1,'drop table if exists private.catalog_media_verifications','Manual-review migration must preserve production retirement of transient v1 verification storage.');
requireText(historicalManualV1,'private.verified_product_video_path_v1','Manual-review migration must preserve the production video helper state before canonical image v2.');

requireText(officialMediaMigration,"coalesce(private.has_permission('product.publish'),false)",'Official catalog Storage policy must require product.publish.');
requireText(officialMediaMigration,"'official-products'",'Official catalog Storage policy must be scoped to the official-products namespace.');
for(const policy of ['storage_admin_public_assets_insert_v2','storage_admin_public_assets_update_v3','storage_admin_public_assets_delete_v3'])requireText(officialMediaMigration,policy,`Hardened official catalog Storage policy is missing ${policy}.`);

requireText(officialFallbackMigration,"return product_store_kind='official'",'Zero-image publication fallback must be restricted to the official store.');
requireText(officialFallbackMigration,'image_count between 1 and 10','Products that do have media must still obey the canonical image-count gate.');
requireText(officialFallbackMigration,'primary_count=1','Products that do have media must still have exactly one primary image.');
requireText(officialFallbackMigration,'and all_valid','Products that do have media must still use verified canonical paths.');

for(const token of ["'mediaReady'","'brandFallbackAllowed'",'f.media_ok media_ready',"f.store_kind='official' and f.image_count=0 and f.media_ok"]){requireText(readinessContractMigration,token,`Canonical readiness contract is missing ${token}.`);}
requireText(readinessSemanticsMigration,'(not f.media_ok) media_blocked','Media-blocked must mean the canonical media gate did not pass, including missing media for non-official sellers.');
requirePattern(readinessSemanticsMigration,/primary_image_missing[\s\S]*image_count=0 and not c\.brand_fallback_allowed/,'Missing media must remain a blocking reason outside the official fallback.');
for(const token of ['mediaReady','brandFallbackAllowed'])requireText(readinessApi,token,`Frontend readiness parser must validate canonical ${token}.`);

requireText(mediaHealthIsolationMigration,'private.super_admin_catalog_media_health_v3','Privileged media-health scan must live in a private core.');
requirePattern(mediaHealthIsolationMigration,/function private\.super_admin_catalog_media_health_v3\(\)[\s\S]*security definer/,'Private media-health core must retain the privileged read boundary.');
requirePattern(mediaHealthIsolationMigration,/function public\.super_admin_catalog_media_health_v2\(\)[\s\S]*security invoker/,'Public media-health RPC must be a SECURITY INVOKER wrapper.');
requireText(mediaHealthIsolationMigration,"private.has_permission('product.health_manage')",'Private media-health core must fail closed on product.health_manage.');

requireText(verifier,"p_permission_key:'product.publish'",'Official catalog binary verification must require product.publish.');
requireText(verifier,"p_permission_key:'admin.access'",'Official catalog binary verification must also require an active admin shell.');
for(const token of ["'image/jpeg'","'image/png'","'image/webp'","'image/avif'"])requireText(verifier,token,`Canonical verifier is missing ${token}.`);
requireText(verifier,"crypto.subtle.digest('SHA-256'",'Canonical verifier must calculate SHA-256 from binary bytes.');
for(const token of [".eq('owner_user_id',userId)",".eq('status','active')",".eq('is_verified',true)",".eq('origin_verified',true)",'ADMIN_PATH_RE'])requireText(verifier,token,`Canonical verifier ownership contract is missing ${token}.`);
forbidText(verifier,"p_permission_key:'product.update'",'Official catalog verification must not fall back to generic product.update authority.');
requireText(retiredVerifier,'410','Retired duplicate media verifier must return HTTP 410.');
requireText(retiredVerifier,'catalog-media-verify','Retired verifier must point callers to the canonical endpoint.');

requireText(retiredOwnerPublisher,'status: 410','Retired owner-publish maintenance endpoint must remain HTTP 410.');
requireText(retiredOwnerPublisher,'endpoint_retired','Retired owner-publish maintenance endpoint must explicitly report retirement.');
for(const forbidden of ['service_role','auth.admin','createUser','enroll','challenge','verify','product.publish','maintenance key','MAINTENANCE'])forbidText(retiredOwnerPublisher,forbidden,`Retired owner-publish endpoint must never regain privileged logic: ${forbidden}.`);

for(const api of [producerApi,officialApi]){
 requireText(api,"functions.invoke('catalog-media-verify'",'Every catalog image upload path must invoke the canonical binary verifier.');
 requirePattern(api,/catch\(error\)[\s\S]*storage\.from\('catalog-public'\)\.remove\(uploaded\)/,'Catalog image upload must compensate by deleting newly uploaded objects after verification failure.');
}
requireText(officialApi,'admin/${userId}/official-products/${crypto.randomUUID()}','Official media paths must be randomized inside the acting owner namespace.');
forbidText(officialApi,"if(input.publish&&!gallery.length)",'Official-store publication must not reintroduce a client-only image requirement that conflicts with the canonical brand fallback.');
requireText(producerApi,'${normalizedProducerId}/products/${crypto.randomUUID()}','Producer media paths must be randomized inside the producer namespace.');

requireText(capabilities,"'product-health':'product.health_manage'",'Product Health admin surface must require product.health_manage.');
requireText(capabilities,"'official-store-products':'product.publish'",'Official Store Product manager must require product.publish.');
requireText(permissions,"'product.publish'",'Frontend permission contract must know product.publish.');
requireText(permissions,"'product.health_manage'",'Frontend permission contract must know product.health_manage.');
requireText(healthApi,"rpc('super_admin_catalog_media_health_v2')",'Product health API must load the canonical media health RPC.');
requireText(healthScreen,'Katalog medya sağlığı','Super Admin Product Health screen must expose media health.');
for(const label of ['Sağlıklı','Eksik','Yetim','Geçersiz'])requireText(healthScreen,label,`Media health UI is missing ${label}.`);

requirePattern(staffE2E,/product\.publish[\s\S]*moderator AAL2 leaked|moderator AAL2 leaked[\s\S]*product\.publish/,'Moderator AAL2 must explicitly deny product.publish.');
requireText(staffE2E,"['product.publish','product.health_manage','role.manage'",'Admin AAL2 must explicitly deny both owner capabilities.');
requireText(staffE2E,"['admin.access','product.publish','product.health_manage'",'Super Admin AAL2 must explicitly allow both owner capabilities.');
requireText(staffE2E,'catalog_media_binary_type_invalid','Real Storage E2E must prove fake image MIME binary rejection.');
requireText(staffE2E,"detectedMime,'image/png'",'Real Storage E2E must prove a valid PNG binary is accepted.');
requireText(staffE2E,"storage.from('catalog-public').remove(uploaded)",'Real Storage E2E must clean up its temporary catalog objects.');
requireText(customerE2E,"await import('./staff-mfa-e2e.mjs')",'Mandatory authenticated customer E2E must execute the real staff owner/MFA matrix.');
requireText(mobileWorkflow,'Run mandatory authenticated customer Chromium journey','Pull-request Mobile Quality Gate must run the authenticated customer journey that includes staff owner/MFA E2E.');
requireText(mobileWorkflow,'id-token: write','Mandatory customer/staff E2E must use short-lived GitHub OIDC control authorization.');

if(failures.length){console.error('Product owner/media contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Product owner/media contract audit passed.');
