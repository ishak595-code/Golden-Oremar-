import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const migrationPath='supabase/migrations/20260824172652_harden_product_media_integrity_lifecycle_v1.sql';
const driftMigrationPath='supabase/migrations/20260824173453_add_product_media_drift_quarantine_v1.sql';
const migration=read(migrationPath);
const driftMigration=read(driftMigrationPath);
const producerApi=read('src/features/producer-products/api.ts');
const customerE2E=read('scripts/customer-e2e.mjs');
const mediaFallback=read('src/features/catalog/installCatalogMediaFallback.ts');
const mainEntry=read('src/main.tsx');
const forensic=read('docs/task3-product-media-forensic-matrix.md');

const failures=[];
const requireMatch=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};
const forbidText=(source,text,message)=>{if(source.includes(text))failures.push(message);};

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

requireText(driftMigration,'private.quarantine_invalid_published_product_media_v1','Missing service-role drift quarantine function.');
requireMatch(driftMigration,/update public\.products p[\s\S]*set is_active=false[\s\S]*not private\.product_media_integrity_ok_v1\(p\.id\)/s,'Drift monitor must fail closed by quarantining newly invalid published products.');
requireText(driftMigration,'golden-oremar-product-media-integrity','Missing named media-integrity cron monitor.');
requireText(driftMigration,"'*/5 * * * *'",'Media-integrity drift monitor must run every five minutes.');
requireMatch(driftMigration,/revoke all on function private\.quarantine_invalid_published_product_media_v1\(\) from public,anon,authenticated,service_role/i,'Drift quarantine function must not be a client/service-role callable API.');

requireMatch(producerApi,/uploadProducerProductImages[\s\S]*files\.length>10/,'Producer upload must cap the gallery at ten files.');
requireMatch(producerApi,/image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp[\s\S]*image\/avif/,'Producer upload must use the canonical image MIME allowlist.');
requireMatch(producerApi,/file\.size>10\*1024\*1024/,'Producer client must reject images above 10 MB before upload.');
requireMatch(producerApi,/\$\{normalizedProducerId\}\/products\/\$\{crypto\.randomUUID\(\)\}/,'Producer uploads must use randomized producer-owned catalog paths.');
requireMatch(producerApi,/upsert:false/,'Product media uploads must remain immutable and non-overwriting.');
requireMatch(producerApi,/if\(uploaded\.length\).*\.remove\(uploaded\)/s,'Partial upload failures must clean up newly uploaded orphan objects.');

requireText(customerE2E,'get_public_home_catalog_v3','Customer E2E must discover a current published catalog fixture instead of pinning a stale product.');
requireText(customerE2E,'catalog_fixture_discovered','Customer E2E must record dynamic public catalog fixture discovery.');
requireText(customerE2E,'catalog_fail_closed_without_authentic_media','Customer E2E must prove the no-authentic-media catalog state fails closed without timing out.');
requireText(customerE2E,'AUTHENTIC_CATALOG_MEDIA_REQUIRED_FOR_COMMERCE_E2E','Customer E2E must explicitly classify commerce coverage as deferred until authentic product media exists.');
requireMatch(customerE2E,/if\(!fixture\)[\s\S]*return false;/,'Customer E2E must short-circuit product commerce cleanly when no verified public product fixture exists.');
requireMatch(customerE2E,/if\(productAvailable\)await verifyProductCommerceJourney\(page\);else\{mark\('commerce_e2e_deferred_for_authentic_media'/,'Authenticated E2E must continue non-commerce account and staff security coverage when catalog media is intentionally quarantined.');
requireText(customerE2E,'PUBLISHED_PRODUCT_MEDIA_PLACEHOLDER_EXPOSED','A published product must never silently pass E2E with a media placeholder.');
forbidText(customerE2E,"const productName='Avaşin Meşe Balı'",'Customer E2E must not pin the former quarantined product as its commerce fixture.');
forbidText(customerE2E,'noSearchResultText','No-media E2E fallback must rely on the canonical public catalog API, not a potentially hidden UI empty-state clone.');
forbidText(customerE2E,'emptyState.waitFor','No-media E2E fallback must not wait on duplicated or hidden DOM empty-state nodes.');

requireText(mainEntry,"installCatalogMediaFallback","Catalog media fallback must be installed before the customer UI renders.");
requireText(mainEntry,'installCatalogMediaFallback();','Catalog media fallback installer must run during application bootstrap.');
requireText(mediaFallback,"/storage/v1/object/public/catalog-public/",'Runtime fallback must be scoped to the canonical catalog-public Storage namespace.');
requireText(mediaFallback,"/images/products/",'Runtime fallback must safely recognize the historical product-media namespace during migration.');
requireText(mediaFallback,"Ürün görseli şu anda kullanılamıyor",'Runtime fallback must expose a truthful Turkish accessibility message.');
requireText(mediaFallback,"img.style.background = '#000'",'Broken catalog media must render a neutral black surface rather than another product image.');
requireText(mediaFallback,"window.addEventListener('error', onError, true)",'Catalog media fallback must capture native image load failures.');
requireText(mediaFallback,"window.addEventListener('online', onOnline)",'Catalog media fallback must allow one recovery attempt when network connectivity returns.');
requireText(mediaFallback,"goCatalogMediaRetry === '1'",'Catalog media fallback must cap automatic network recovery at one retry per image element.');
requireText(mediaFallback,"img.removeAttribute('srcset')",'Broken catalog media must remove alternate image candidates before applying fallback.');
requireText(mediaFallback,'FALLBACK_DATA_URI','Broken catalog media must replace the broken source so the browser broken-image glyph is not exposed.');
forbidText(mediaFallback,'unsplash','Runtime fallback must never substitute stock imagery.');
forbidText(mediaFallback,'placeholder.com','Runtime fallback must never substitute third-party placeholder imagery.');

requireText(forensic,'NO_VERIFIED_ORIGINAL_ASSET','Forensic baseline must preserve the no-authentic-asset finding.');
requireText(forensic,'disqualified','Demo/stock recovery candidates must remain explicitly disqualified.');

if(failures.length){
  console.error('Product media integrity contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Product media integrity contract audit passed.');