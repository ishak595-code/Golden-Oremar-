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

if(failures.length){console.error('Task 3.5 certification contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Task 3.5 certification contract audit passed.');
