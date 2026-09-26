import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const manifestPath='catalog/product-media-storyboard.v1.json';
const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
const failures=[];

const fail=(condition,message)=>{if(!condition)failures.push(message);};
const products=Array.isArray(manifest.products)?manifest.products:[];
const target=manifest.target??{};

fail(manifest.version===1,'Media storyboard version must remain v1.');
fail(target.width>=1200&&target.height>=1200,'Storyboard render target must satisfy the 1200 px minimum edge.');
fail(target.width*target.height<=25_000_000,'Storyboard render target must remain under the 25 MP ceiling.');
fail(['jpeg','jpg','png','webp','avif'].includes(String(target.format).toLowerCase()),'Storyboard format must use a supported catalog image type.');
fail(target.externalUrlsAllowed===false,'External product-media URLs must remain disabled.');
fail(target.visibleWatermark===false,'Customer-facing product media must not require a visible watermark.');
fail(target.basePath==='public/images/products','Storyboard source files must use the repository-managed staging namespace.');
fail(products.length===50,`Expected exactly 50 product storyboards, found ${products.length}.`);

const slugs=new Set();
const sceneTexts=new Set();
const sourcePaths=new Set();
const urlPattern=/(?:https?:)?\/\//i;
const forbiddenStock=/unsplash|pexels|pixabay|placeholder\.com|loremflickr/i;
const requiredSceneCount=5;

for(const product of products){
  const slug=String(product?.slug??'').trim();
  const category=String(product?.category??'').trim();
  const scenes=Array.isArray(product?.scenes)?product.scenes:[];
  fail(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),`Invalid product slug: ${slug||'<empty>'}.`);
  fail(!slugs.has(slug),`Duplicate product storyboard slug: ${slug}.`);
  slugs.add(slug);
  fail(category.length>0,`Missing category for ${slug}.`);
  fail(scenes.length===requiredSceneCount,`${slug} must define exactly ${requiredSceneCount} distinct story scenes.`);

  scenes.forEach((scene,index)=>{
    const text=String(scene??'').trim();
    fail(text.length>=25,`${slug} scene ${index+1} is too vague.`);
    fail(!urlPattern.test(text),`${slug} scene ${index+1} contains an external URL.`);
    fail(!forbiddenStock.test(text),`${slug} scene ${index+1} references a stock/placeholder source.`);
    const normalized=text.toLocaleLowerCase('tr-TR');
    fail(!sceneTexts.has(normalized),`${slug} scene ${index+1} duplicates another product scene verbatim.`);
    sceneTexts.add(normalized);

    const filename=`${String(index+1).padStart(2,'0')}-${['origin','harvest-process','texture','packaging','serving'][index]}.${target.format}`;
    const sourcePath=`${target.basePath}/${slug}/${filename}`;
    fail(!sourcePaths.has(sourcePath),`Duplicate staged media path: ${sourcePath}.`);
    sourcePaths.add(sourcePath);
  });
}

const officialApi=fs.readFileSync(path.join(root,'src/admin/officialStoreProductApi.ts'),'utf8');
// Since 2026-09-26 official media is uploaded straight to Cloudflare R2 and
// verified there by media-upload; the server builds the admin-owned path.
const mediaUploadFn=fs.readFileSync(path.join(root,'supabase/functions/media-upload/index.ts'),'utf8');
fail(officialApi.includes("uploadDirectMedia('official-image'"),'Official product media must be uploaded as managed files through media-upload.');
fail(fs.readFileSync(path.join(root,'src/lib/directMediaUpload.ts'),'utf8').includes("action: 'finish'"),'Official product media must pass the canonical server binary verifier before use.');
fail(mediaUploadFn.includes('case "official-image": case "official-video": return `admin/${userId}/official-products/${id}.${ext}`'),'Official product media runtime paths must remain immutable admin-owned objects.');
fail(mediaUploadFn.includes('crypto.randomUUID()')&&!officialApi.includes('upsert:true'),'Official product media uploads must not overwrite existing binaries.');
fail(!/fetch\([^)]*https?:\/\//i.test(officialApi),'Official product media upload must not fetch external image URLs.');

const mediaMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260824172652_harden_product_media_integrity_lifecycle_v1.sql'),'utf8');
fail(mediaMigration.includes("where o.bucket_id='catalog-public'"),'Published product images must resolve to catalog-public Storage objects.');
fail(mediaMigration.includes('private.verified_catalog_product_image_path_v1'),'Published media must pass canonical managed-file verification.');
fail(mediaMigration.includes('published_product_requires_verified_media'),'Publishing must fail closed when managed product media is absent or invalid.');

const seedMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260902114000_seed_hakkari_50_product_catalog_v1.sql'),'utf8');
for(const slug of ['yuksekova-sonbahar-armudu-901','hakkari-dag-erigi-902','yuksekova-yayla-kayisisi-903','yuksekova-yaz-hiyari-904','hakkari-yayla-karpuzu-905','yuksekova-yayla-poleni-906','hakkari-ham-propolisi-907','tas-degirmen-yuksekova-bulguru-908']){
  fail(seedMigration.includes(`'${slug}'`),`Storyboard draft slug is missing from the canonical 50-product seed: ${slug}.`);
}
fail(/'draft'[\s\S]*false,false,null/.test(seedMigration),'The eight demo additions must remain draft and inactive until verification and media publication gates pass.');

if(failures.length){
  console.error('Product media storyboard contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Product media storyboard contract audit passed: ${products.length} products, ${sceneTexts.size} unique scenes, ${sourcePaths.size} staged file targets, managed Storage runtime locked.`);
