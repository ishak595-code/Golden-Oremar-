import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const verifier=read('supabase/functions/catalog-media-verify/index.ts');
const producerApi=read('src/features/producer-products/api.ts');
const officialApi=read('src/admin/officialStoreProductApi.ts');
const failures=[];
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};
const requireMatch=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};

requireText(verifier,'MIN_PRODUCT_IMAGE_EDGE=1200','Server verifier must enforce the 1200 px minimum product-image edge.');
requireText(verifier,'MAX_PRODUCT_IMAGE_PIXELS=25_000_000','Server verifier must enforce the 25 MP product-image ceiling.');
requireText(verifier,'function avifDimensions','Server verifier must read AVIF dimensions before accepting AVIF catalog media.');
requireMatch(verifier,/function imageDimensions[\s\S]*image\/avif[\s\S]*avifDimensions/,'AVIF dimensions must participate in the canonical image-dimension parser.');
requireMatch(verifier,/function productDimensionsValid[\s\S]*width>=MIN_PRODUCT_IMAGE_EDGE[\s\S]*height>=MIN_PRODUCT_IMAGE_EDGE[\s\S]*width\*height<=MAX_PRODUCT_IMAGE_PIXELS/,'Canonical product media must satisfy minimum width, minimum height, and total-pixel limits.');
requireText(verifier,"catalog_media_dimensions_unreadable",'Unreadable product dimensions must fail closed.');
requireText(verifier,"catalog_media_dimensions_invalid",'Out-of-policy product dimensions must fail closed.');
requireMatch(verifier,/return json\(200,\{ok:true,path,detectedMime,byteSize:bytes\.byteLength,width:dimensions\.width,height:dimensions\.height/,'Successful binary verification must return the verified dimensions.');

requireText(producerApi,'MIN_PRODUCT_IMAGE_EDGE=1200','Producer picker must retain the same 1200 px client-side minimum for early feedback.');
requireText(producerApi,'MAX_PRODUCT_IMAGE_PIXELS=25_000_000','Producer picker must retain the same 25 MP client-side ceiling.');
const sharedBinary=read('supabase/functions/_shared/media_binary.ts');
requireText(sharedBinary,'MIN_PRODUCT_IMAGE_EDGE = 1200','The R2 verifier (media-upload) must keep the 1200 px product image floor.');
requireText(sharedBinary,'MAX_PRODUCT_IMAGE_PIXELS = 25_000_000','The R2 verifier (media-upload) must keep the 25 MP ceiling.');
for(const api of [producerApi,officialApi]){
  // Since 2026-09-26 images go straight to Cloudflare R2; media-upload is the
  // canonical server verifier (type from bytes, 1200 px floor, SHA-256).
  requireMatch(api,/uploadDirectMedia\('(product|official)-image'/,'Every product image upload surface must use the canonical server verifier (media-upload).');
  requireMatch(api,/catch\(error\)\{if\(uploaded\.length\)await cancelDirectMedia\(uploaded\)/,'Rejected image uploads must remove newly uploaded objects.');
}

if(failures.length){
  console.error('Catalog media dimensions contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Catalog media dimensions contract audit passed.');
