import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const storyboard=JSON.parse(fs.readFileSync(path.join(root,'catalog/product-media-storyboard.v1.json'),'utf8'));
const intakeDir=path.join(root,'catalog/media-intake');
const intakeFiles=fs.readdirSync(intakeDir).filter(name=>name.endsWith('.v1.json')).sort();
const failures=[];
const fail=(condition,message)=>{if(!condition)failures.push(message);};

fail(intakeFiles.length>0,'At least one category media intake file is required.');

const allPaths=new Set();
const hashes=new Map();
const coveredSlugs=new Set();
const coveredCategories=new Set();
const slotNames=['01-origin.webp','02-harvest-process.webp','03-texture.webp','04-packaging.webp','05-serving.webp'];
const supportedStatuses=new Set(['awaiting_generated_binary','binary_staged','verified']);
const forbidden=/https?:\/\/|unsplash|pexels|pixabay|placeholder|loremflickr/i;
let totalProducts=0;

for(const intakeFile of intakeFiles){
  const intake=JSON.parse(fs.readFileSync(path.join(intakeDir,intakeFile),'utf8'));
  fail(intake.version===1,`${intakeFile}: media intake must remain v1.`);
  fail(typeof intake.category==='string'&&intake.category.length>0,`${intakeFile}: category is required.`);
  fail(!coveredCategories.has(intake.category),`${intakeFile}: duplicate category intake ${intake.category}.`);
  coveredCategories.add(intake.category);

  fail(intake.target?.width===storyboard.target?.width&&intake.target?.height===storyboard.target?.height,`${intakeFile}: render target must match the canonical storyboard.`);
  fail(intake.target?.format===storyboard.target?.format,`${intakeFile}: format must match the canonical storyboard.`);
  fail(intake.target?.minimumEdge>=1200,`${intakeFile}: minimum edge must remain at least 1200 px.`);
  fail(intake.target?.externalUrlsAllowed===false,`${intakeFile}: external media URLs must remain disabled.`);
  fail(intake.target?.visibleWatermark===false,`${intakeFile}: customer-facing watermark must remain disabled.`);
  fail(intake.target?.requireUniqueBinary===true,`${intakeFile}: binary uniqueness must remain mandatory.`);
  fail(intake.target?.requireManagedStorageVerification===true,`${intakeFile}: managed Storage verification must remain mandatory.`);
  fail(intake.publicationPolicy?.generatedBinaryRequired===true,`${intakeFile}: source binary must exist before publication.`);
  fail(intake.publicationPolicy?.binaryVerificationRequired===true,`${intakeFile}: binary verification must remain mandatory.`);
  fail(intake.publicationPolicy?.productImageRowRequired===true,`${intakeFile}: product_images row must exist before publication.`);
  fail(intake.publicationPolicy?.runtimeResolutionRequired===true,`${intakeFile}: runtime media resolution must be verified before publication.`);
  fail(intake.publicationPolicy?.allowPublishBeforeVerification===false,`${intakeFile}: unverified media must never unlock publication.`);

  const canonicalProducts=(storyboard.products??[]).filter(product=>product.category===intake.category);
  const canonicalSlugs=new Set(canonicalProducts.map(product=>product.slug));
  const intakeProducts=Array.isArray(intake.products)?intake.products:[];
  const intakeSlugs=new Set(intakeProducts.map(product=>product.slug));
  totalProducts+=intakeProducts.length;

  fail(canonicalProducts.length>0,`${intakeFile}: category ${intake.category} does not exist in the canonical storyboard.`);
  fail(intakeProducts.length===canonicalProducts.length,`${intakeFile}: expected ${canonicalProducts.length} products for ${intake.category}, found ${intakeProducts.length}.`);
  for(const slug of canonicalSlugs)fail(intakeSlugs.has(slug),`${intakeFile}: missing canonical product ${slug}.`);
  for(const slug of intakeSlugs)fail(canonicalSlugs.has(slug),`${intakeFile}: contains non-canonical product ${slug}.`);

  for(const product of intakeProducts){
    fail(!coveredSlugs.has(product.slug),`${intakeFile}: product ${product.slug} is duplicated across category intake files.`);
    coveredSlugs.add(product.slug);

    const files=Array.isArray(product.files)?product.files:[];
    fail(supportedStatuses.has(product.status),`${intakeFile}: unsupported intake status for ${product.slug}: ${product.status}.`);
    fail(files.length===5,`${intakeFile}: ${product.slug} must reserve exactly five story files.`);

    files.forEach((relativePath,index)=>{
      const normalized=String(relativePath??'').replaceAll('\\','/');
      const expected=`${intake.target.basePath}/${product.slug}/${slotNames[index]}`;
      fail(normalized===expected,`${intakeFile}: ${product.slug} slot ${index+1} path must be ${expected}.`);
      fail(!forbidden.test(normalized),`${intakeFile}: ${product.slug} slot ${index+1} contains a forbidden external/stock media reference.`);
      fail(!allPaths.has(normalized),`Duplicate media intake path across categories: ${normalized}.`);
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

    if(product.status==='binary_staged'||product.status==='verified'){
      const missing=files.filter(relativePath=>!fs.existsSync(path.join(root,relativePath)));
      fail(missing.length===0,`${intakeFile}: ${product.slug} cannot be ${product.status} while ${missing.length} staged binaries are missing.`);
    }
  }
}

if(failures.length){
  console.error('Product media intake contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Product media intake contract audit passed: ${coveredCategories.size} categories, ${totalProducts} products, ${allPaths.size} reserved story files, ${hashes.size} staged unique binaries.`);
