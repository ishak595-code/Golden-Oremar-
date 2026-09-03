import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const storyboard=JSON.parse(fs.readFileSync(path.join(root,'catalog/product-media-storyboard.v1.json'),'utf8'));
const intake=JSON.parse(fs.readFileSync(path.join(root,'catalog/media-intake/bal-dag-bitkileri.v1.json'),'utf8'));
const failures=[];
const fail=(condition,message)=>{if(!condition)failures.push(message);};

fail(intake.version===1,'Media intake must remain v1.');
fail(intake.category==='bal-dag-bitkileri','First media intake must remain scoped to bal-dag-bitkileri.');
fail(intake.target?.width===storyboard.target?.width&&intake.target?.height===storyboard.target?.height,'Media intake render target must match the canonical storyboard.');
fail(intake.target?.format===storyboard.target?.format,'Media intake format must match the canonical storyboard.');
fail(intake.target?.minimumEdge>=1200,'Media intake minimum edge must remain at least 1200 px.');
fail(intake.target?.externalUrlsAllowed===false,'External media URLs must remain disabled.');
fail(intake.target?.visibleWatermark===false,'Customer-facing watermark must remain disabled.');
fail(intake.target?.requireUniqueBinary===true,'Binary uniqueness must remain mandatory.');
fail(intake.target?.requireManagedStorageVerification===true,'Managed Storage verification must remain mandatory.');
fail(intake.publicationPolicy?.generatedBinaryRequired===true,'A generated/source binary must exist before publication.');
fail(intake.publicationPolicy?.binaryVerificationRequired===true,'Binary verification must remain mandatory.');
fail(intake.publicationPolicy?.productImageRowRequired===true,'A product_images row must exist before publication.');
fail(intake.publicationPolicy?.runtimeResolutionRequired===true,'Runtime media resolution must be verified before publication.');
fail(intake.publicationPolicy?.allowPublishBeforeVerification===false,'Unverified media must never unlock publication.');

const canonicalProducts=(storyboard.products??[]).filter(product=>product.category===intake.category);
const canonicalSlugs=new Set(canonicalProducts.map(product=>product.slug));
const intakeProducts=Array.isArray(intake.products)?intake.products:[];
const intakeSlugs=new Set(intakeProducts.map(product=>product.slug));
fail(intakeProducts.length===canonicalProducts.length,`Expected ${canonicalProducts.length} ${intake.category} intake products, found ${intakeProducts.length}.`);
for(const slug of canonicalSlugs)fail(intakeSlugs.has(slug),`Missing media intake product: ${slug}.`);
for(const slug of intakeSlugs)fail(canonicalSlugs.has(slug),`Media intake contains a non-canonical product: ${slug}.`);

const allPaths=new Set();
const hashes=new Map();
const slotNames=['01-origin.webp','02-harvest-process.webp','03-texture.webp','04-packaging.webp','05-serving.webp'];
const supportedStatuses=new Set(['awaiting_generated_binary','binary_staged','verified']);
const forbidden=/https?:\/\/|unsplash|pexels|pixabay|placeholder|loremflickr/i;

for(const product of intakeProducts){
  const files=Array.isArray(product.files)?product.files:[];
  fail(supportedStatuses.has(product.status),`Unsupported intake status for ${product.slug}: ${product.status}.`);
  fail(files.length===5,`${product.slug} must reserve exactly five story files.`);
  files.forEach((relativePath,index)=>{
    const normalized=String(relativePath??'').replaceAll('\\','/');
    const expected=`${intake.target.basePath}/${product.slug}/${slotNames[index]}`;
    fail(normalized===expected,`${product.slug} slot ${index+1} path must be ${expected}.`);
    fail(!forbidden.test(normalized),`${product.slug} slot ${index+1} contains a forbidden external/stock media reference.`);
    fail(!allPaths.has(normalized),`Duplicate media intake path: ${normalized}.`);
    allPaths.add(normalized);

    const absolute=path.join(root,normalized);
    if(fs.existsSync(absolute)){
      const binary=fs.readFileSync(absolute);
      fail(binary.length>0,`Staged media file is empty: ${normalized}.`);
      const isWebp=binary.length>=12&&binary.subarray(0,4).toString('ascii')==='RIFF'&&binary.subarray(8,12).toString('ascii')==='WEBP';
      fail(isWebp,`Staged media file is not an actual WebP binary: ${normalized}.`);
      const hash=crypto.createHash('sha256').update(binary).digest('hex');
      const prior=hashes.get(hash);
      fail(!prior,`Duplicate staged media binary: ${normalized} duplicates ${prior}.`);
      hashes.set(hash,normalized);
    }
  });

  if(product.status==='verified'){
    const missing=files.filter(relativePath=>!fs.existsSync(path.join(root,relativePath)));
    fail(missing.length===0,`${product.slug} cannot be verified while ${missing.length} staged binaries are missing.`);
  }
}

if(failures.length){
  console.error('Product media intake contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Product media intake contract audit passed: ${intakeProducts.length} products, ${allPaths.size} reserved story files, ${hashes.size} staged unique binaries.`);
