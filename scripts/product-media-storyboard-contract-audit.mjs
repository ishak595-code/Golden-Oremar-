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
fail(target.visibleWatermark===false,'Customer-facing generated product media must not require a visible watermark.');
fail(target.basePath==='public/images/products','Storyboard files must target the app-managed product image namespace.');
fail(products.length===50,`Expected exactly 50 product storyboards, found ${products.length}.`);

const slugs=new Set();
const sceneTexts=new Set();
const filePaths=new Set();
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
    const managedPath=`${target.basePath}/${slug}/${filename}`;
    fail(!filePaths.has(managedPath),`Duplicate managed media path: ${managedPath}.`);
    filePaths.add(managedPath);
  });
}

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

console.log(`Product media storyboard contract audit passed: ${products.length} products, ${sceneTexts.size} unique scenes, ${filePaths.size} managed file targets.`);
