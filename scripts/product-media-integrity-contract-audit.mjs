import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const migrationPath='supabase/migrations/20260824172652_harden_product_media_integrity_lifecycle_v1.sql';
const migration=read(migrationPath);
const producerApi=read('src/features/producer-products/api.ts');
const forensic=read('docs/task3-product-media-forensic-matrix.md');

const failures=[];
const requireMatch=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};

requireText(migration,'private.verified_catalog_product_image_path_v1','Missing canonical verified catalog image helper.');
requireMatch(migration,/metadata->>'mimetype'.*image\/jpeg/s,'Server image verification must inspect Storage MIME metadata.');
requireMatch(migration,/metadata->>'size'.*10485760/s,'Server image verification must enforce the 10 MB image ceiling.');
requireText(migration,"coalesce(o.is_delete_marker,false)=false",'Deleted Storage object markers must fail image verification.');
requireText(migration,'o.archived_at is null','Archived Storage objects must fail image verification.');
requireText(migration,'private.product_media_integrity_ok_v1','Missing product-level media integrity predicate.');
requireMatch(migration,/image_count between 1 and 10 and primary_count=1 and all_valid/,'Published media must require 1-10 valid images and exactly one primary image.');
requireMatch(migration,/create constraint trigger product_media_integrity_product_v1[\s\S]*deferrable initially deferred/i,'Product publish integrity must be commit-time deferred.');
requireMatch(migration,/create constraint trigger product_media_integrity_images_v1[\s\S]*deferrable initially deferred/i,'Image replacement integrity must be commit-time deferred.');
requireText(migration,'published_product_requires_verified_media','Published products must fail closed without verified media.');
requireText(migration,'verified_catalog_product_image_required','Product image rows must fail closed for missing or invalid Storage objects.');
requireText(migration,'storage_admin_public_assets_delete_v2','Admin Storage delete policy must be hardened.');
requireText(migration,'storage_admin_public_assets_update_v2','Admin Storage update policy must be hardened.');
requireMatch(migration,/not exists\([\s\S]*public\.product_images image[\s\S]*image\.storage_path=storage\.objects\.name/s,'Referenced catalog assets must not be deleted or overwritten by admin policy.');
requireMatch(migration,/update public\.products p[\s\S]*set is_active=false[\s\S]*not private\.product_media_integrity_ok_v1\(p\.id\)/s,'Existing published products with broken media must be quarantined instead of exposed.');

requireMatch(producerApi,/uploadProducerProductImages[\s\S]*files\.length>10/,'Producer upload must cap the gallery at ten files.');
requireMatch(producerApi,/image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp[\s\S]*image\/avif/,'Producer upload must use the canonical image MIME allowlist.');
requireMatch(producerApi,/file\.size>10\*1024\*1024/,'Producer client must reject images above 10 MB before upload.');
requireMatch(producerApi,/\$\{normalizedProducerId\}\/products\/\$\{crypto\.randomUUID\(\)\}/,'Producer uploads must use randomized producer-owned catalog paths.');
requireMatch(producerApi,/upsert:false/,'Product media uploads must remain immutable and non-overwriting.');
requireMatch(producerApi,/if\(uploaded\.length\).*\.remove\(uploaded\)/s,'Partial upload failures must clean up newly uploaded orphan objects.');
requireText(forensic,'NO_VERIFIED_ORIGINAL_ASSET','Forensic baseline must preserve the no-authentic-asset finding.');
requireText(forensic,'disqualified','Demo/stock recovery candidates must remain explicitly disqualified.');

if(failures.length){
  console.error('Product media integrity contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Product media integrity contract audit passed.');
