import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=relative=>{const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Missing certification file: ${relative}`);return'';}return fs.readFileSync(full,'utf8');};
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};
const forbidText=(source,text,message)=>{if(source.includes(text))failures.push(message);};
const requirePattern=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};

const app=read('src/App.tsx');
const searchInput=read('src/features/catalog/CatalogSearchInput.tsx');
const readinessApi=read('src/admin/productPublishReadinessApi.ts');
const readinessV3=read('supabase/migrations/20260826123321_canonicalize_publish_readiness_media_block_semantics_v3.sql');
const readinessV5=read('supabase/migrations/20260826124438_make_exact_product_id_readiness_exclusive_v5.sql');
const mediaHealthIsolation=read('supabase/migrations/20260826123459_isolate_super_admin_catalog_media_health_definer_v3.sql');
const officialApi=read('src/admin/officialStoreProductApi.ts');
const retiredPublisher=read('supabase/functions/catalog-owner-publish-maintenance/index.ts');
const migration120207=read('supabase/migrations/20260826120207_align_product_review_media_with_canonical_integrity_v1.sql');
const duplicateMigrationPath=path.join(root,'supabase/migrations/20260826130156_align_product_review_media_with_canonical_integrity_v1.sql');
const brandingV1=read('supabase/migrations/20260826154938_harden_store_branding_asset_ownership_v1.sql');
const brandingV2=read('supabase/migrations/20260826155021_separate_official_and_owner_store_branding_authority_v2.sql');
const brandingV3=read('supabase/migrations/20260826160122_minimize_store_branding_helper_execute_boundary_v3.sql');
const brandingApi=read('src/features/store-branding/storeBrandingApi.ts');
const brandingEditor=read('src/features/store-branding/StoreBrandingEditor.tsx');
const producerProfile=read('src/features/account/ProducerProfilePanel.tsx');
const officialWorkspace=read('src/admin/AdminOfficialStoreWorkspace.tsx');
const adminPage=read('src/pages/AdminPage.tsx');
const mediaVerifier=read('supabase/functions/catalog-media-verify/index.ts');

forbidText(app,'voiceDialogRef','Voice search must not restore a second full-screen dialog state.');
forbidText(app,'Sesli arama</h2>','Voice search full-screen modal must stay removed.');
requireText(app,'processVoiceText','Recognized voice text must enter the canonical search adapter.');
requirePattern(app,/processVoiceText[\s\S]*openSearch\(value\)/,'Voice transcript must use the same openSearch route as typed search.');
requireText(searchInput,'aria-pressed={listening}','Search input microphone must expose listening state accessibly.');
requireText(searchInput,'animate-pulse','Search input microphone must visibly expose active listening state.');

for(const field of ['mediaReady','brandFallbackAllowed'])requireText(readinessApi,field,`Readiness frontend contract is missing ${field}.`);
requireText(readinessApi,'getSuperAdminProductPublishReadinessItem','Single-product readiness must use a dedicated exact-ID client helper.');
requireText(readinessApi,'UUID_RE','Exact readiness helper must reject malformed product IDs before RPC execution.');
requireText(readinessV3,'(not f.media_ok) media_blocked','Media blocked semantics must be the inverse of canonical media readiness.');
requireText(readinessV3,"f.store_kind='official' and f.image_count=0 and f.media_ok",'Official zero-image fallback must remain explicit and fail closed for other seller kinds.');
requireText(readinessV5,'q_is_uuid','Readiness search must explicitly distinguish UUID lookup from free-text discovery.');
requirePattern(readinessV5,/q_is_uuid and e\.id::text=q[\s\S]*not q_is_uuid and/,'UUID readiness lookup must be exclusive and must not fall through to name, slug, or producer matching.');
forbidText(officialApi,"if(input.publish&&!gallery.length)",'Official-store client code must not require an image when the canonical brand fallback is allowed.');

requireText(mediaHealthIsolation,'security invoker','Public catalog media health surface must be an invoker wrapper.');
requireText(mediaHealthIsolation,'private.super_admin_catalog_media_health_v3','Privileged media health logic must live in the private core.');
requireText(retiredPublisher,'status: 410','Owner publish maintenance endpoint must remain retired with HTTP 410.');
for(const forbidden of ['service_role','createUser','auth.admin','product.publish','MAINTENANCE'])forbidText(retiredPublisher,forbidden,`Retired owner publisher contains forbidden privileged token: ${forbidden}`);
requireText(migration120207,'private.product_media_integrity_ok_v1','Single-product moderation must use the canonical media integrity helper.');
if(fs.existsSync(duplicateMigrationPath))failures.push('Duplicate 20260826130156 review-media migration must not exist.');

for(const source of [brandingV1,brandingV2])requireText(source,'storage_catalog_brand_insert_owner_or_official_v1','Store branding migration must define the canonical immutable insert policy.');
requireText(brandingV1,'private.catalog_media_binary_verified_path_v2','Store branding DB binding must require canonical binary verification.');
requireText(brandingV1,'private.catalog_public_asset_is_referenced_v1(name)','Store branding cleanup must never delete a referenced catalog asset.');
requireText(brandingV1,'set_store_branding_asset_v1','Store branding writes must use the atomic binding RPC.');
requirePattern(brandingV2,/p\.store_kind<>'official' and p\.owner_user_id=\(select auth\.uid\(\)\)[\s\S]*p\.store_kind='official' and coalesce\(private\.has_permission\('product\.publish'\),false\)/,'Independent store ownership and official-store Super Admin authority must remain separate.');
requireText(brandingV3,'revoke all on function private.store_branding_can_edit_v1(uuid) from authenticated','Authenticated clients must not execute the internal branding authorization helper directly.');
requireText(brandingV3,'revoke all on function private.store_branding_verified_path_v1(uuid,text,text) from authenticated','Authenticated clients must not execute the internal branding path verifier directly.');

for(const token of ['1024','512','1500','600','1200','480','5*1024*1024'])requireText(brandingApi,token,`Store branding client is missing dimension or size contract token ${token}.`);
for(const token of ["'image/jpeg'","'image/png'","'image/webp'",'crypto.randomUUID()','upsert:false',"functions.invoke('catalog-media-verify'","rpc('set_store_branding_asset_v1'"])requireText(brandingApi,token,`Store branding upload contract is missing ${token}.`);
forbidText(brandingApi,"'image/avif'",'Store branding must not advertise AVIF while server-side dimension parsing is limited to JPEG, PNG and WebP.');
requireText(brandingEditor,'Önerilen','Store branding editor must display recommended dimensions.');
requireText(brandingEditor,'minimum','Store branding editor must display minimum dimensions.');
requireText(brandingEditor,'orta yaklaşık %60 güvenli alanda','Cover editor must explain mobile safe-area cropping.');
requireText(producerProfile,"../store-branding/StoreBrandingEditor",'Store owner profile must use the shared store-branding editor.');
for(const forbidden of ['pendingAssets','uploadAsset(','imageTypes=new Set','function Asset('])forbidText(producerProfile,forbidden,`Producer profile must not keep the retired direct-brand-upload path: ${forbidden}`);
requireText(officialWorkspace,"../features/store-branding/StoreBrandingEditor",'Super Admin official-store workspace must use the shared store-branding editor.');
requireText(adminPage,'AdminOfficialStoreWorkspace','Official-store admin tab must route through the branding-aware workspace.');

for(const token of ['BRAND_PATH_RE','BRAND_MAX_BYTES','brandDimensionsValid','jpegDimensions','pngDimensions','webpDimensions',"producer.store_kind!=='official'","producer.store_kind==='official'","p_permission_key:'product.publish'","kind==='logo'","kind==='cover'"])requireText(mediaVerifier,token,`Canonical media verifier is missing store-branding enforcement token ${token}.`);
requireText(mediaVerifier,'width===height&&width>=512','Server must enforce square logo minimum dimensions.');
requireText(mediaVerifier,'width>=1200&&height>=480','Server must enforce minimum cover dimensions.');
requireText(mediaVerifier,'Math.abs(ratio-2.5)<=0.025','Server must enforce the 5:2 cover ratio.');

if(failures.length){console.error('Task 3.5 certification contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Task 3.5 certification contract audit passed.');
