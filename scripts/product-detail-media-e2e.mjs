import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const supabaseUrl=String(process.env.VITE_SUPABASE_URL||'').replace(/\/+$/,'');
const supabasePublishableKey=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const widths=[320,360,375,390,412,430];
const authenticProductMediaPath=/^(?:[0-9a-f-]{36}\/products\/[0-9a-f-]{36}|admin\/[0-9a-f-]{36}\/official-products\/[0-9a-f-]{36})\.(?:jpg|jpeg|png|webp|avif)$/i;
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});

function assert(condition,message){if(!condition)throw new Error(message);}
function stressAsset(width,height){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/><rect x="24" y="24" width="${width-48}" height="${height-48}" fill="#e5e7eb" stroke="#111827" stroke-width="24"/><circle cx="${Math.round(width/2)}" cy="${Math.round(height/2)}" r="${Math.round(Math.min(width,height)/7)}" fill="#6b7280"/></svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;}
async function setImageSource(locator,src){await locator.evaluate((image,nextSrc)=>new Promise((resolve,reject)=>{if(!(image instanceof HTMLImageElement)){reject(new Error('PRODUCT_DETAIL_MEDIA_IMAGE_ELEMENT_REQUIRED'));return;}const finish=()=>resolve(true);image.addEventListener('load',finish,{once:true});image.addEventListener('error',()=>reject(new Error('PRODUCT_DETAIL_MEDIA_TEST_ASSET_LOAD_FAILED')),{once:true});image.src=String(nextSrc);if(image.complete&&image.naturalWidth>0)resolve(true);}),src);}

async function resolveFixture(){
 assert(supabaseUrl&&supabasePublishableKey,'PRODUCT_DETAIL_MEDIA_E2E_CONFIG_REQUIRED');
 const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_home_catalog_v3`,{
  method:'POST',
  headers:{apikey:supabasePublishableKey,'Content-Type':'application/json'},
  body:'{}',
 });
 const payload=await response.json().catch(()=>null);
 assert(response.ok&&payload&&typeof payload==='object',`PRODUCT_DETAIL_MEDIA_FIXTURE_QUERY_FAILED:${response.status}`);
 const items=Array.isArray(payload.items)?payload.items:[];
 const eligible=items.filter(row=>row&&typeof row==='object'&&typeof row.name==='string'&&row.name.trim()&&typeof row.slug==='string'&&row.slug.trim()&&typeof row.imagePath==='string'&&row.imagePath.trim());
 const authentic=eligible.find(row=>authenticProductMediaPath.test(row.imagePath.trim()));
 const item=authentic||eligible[0];
 assert(item,'PRODUCT_DETAIL_MEDIA_PUBLISHED_FIXTURE_REQUIRED');
 return{name:item.name.trim(),slug:item.slug.trim(),imagePath:item.imagePath.trim(),mediaMode:authentic?'authentic-product':'catalog-fallback'};
}

const browser=await chromium.launch({headless:true});
const fixture=await resolveFixture();
const results=[];

try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  const consoleErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.goto(`${baseUrl}/?tab=product-detail&product=${encodeURIComponent(fixture.slug)}`,{waitUntil:'networkidle',timeout:30000});
  await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor({state:'visible',timeout:15000});

  const back=page.getByRole('button',{name:'Geri',exact:true});
  const favorite=page.getByRole('button',{name:/Favorilere (ekle|çıkar)/}).first();
  const share=page.getByRole('button',{name:'Ürünü paylaş',exact:true});
  const gallery=page.locator('section[aria-label="Ürün görselleri"]').first();
  const mainImage=gallery.locator('img[data-product-primary-image="true"]').first();
  const infoSection=gallery.locator('xpath=following-sibling::section[1]');
  const toolbar=back.locator('..');

  await Promise.all([back.waitFor(),favorite.waitFor(),share.waitFor(),gallery.waitFor(),mainImage.waitFor(),infoSection.waitFor()]);
  await mainImage.evaluate(image=>image instanceof HTMLImageElement&&image.complete?true:new Promise(resolve=>image.addEventListener('load',()=>resolve(true),{once:true})));

  const [backBox,favoriteBox,shareBox,toolbarBox,galleryBox,imageBox,infoBox]=await Promise.all([
   back.boundingBox(),favorite.boundingBox(),share.boundingBox(),toolbar.boundingBox(),gallery.boundingBox(),mainImage.boundingBox(),infoSection.boundingBox(),
  ]);
  assert(backBox&&favoriteBox&&shareBox&&toolbarBox&&galleryBox&&imageBox&&infoBox,`PRODUCT_DETAIL_MEDIA_GEOMETRY_MISSING:${width}`);
  for(const [name,box] of [['back',backBox],['favorite',favoriteBox],['share',shareBox]]){
   assert(box.width>=44&&box.height>=44,`PRODUCT_DETAIL_${name.toUpperCase()}_TOUCH_TARGET_TOO_SMALL:${width}:${box.width}x${box.height}`);
  }
  assert(imageBox.y>=toolbarBox.y+toolbarBox.height-1,`PRODUCT_DETAIL_IMAGE_OVERLAPS_TOOLBAR:${width}`);
  assert(infoBox.y>=galleryBox.y+galleryBox.height-1,`PRODUCT_DETAIL_INFO_OVERLAPS_GALLERY:${width}`);
  assert(Math.abs(imageBox.width-imageBox.height)<=2,`PRODUCT_DETAIL_PRIMARY_MEDIA_NOT_SQUARE:${width}:${imageBox.width}x${imageBox.height}`);
  assert(imageBox.width>=width-36,`PRODUCT_DETAIL_PRIMARY_MEDIA_TOO_NARROW:${width}:${imageBox.width}`);

  const originalSrc=await mainImage.getAttribute('src');
  assert(originalSrc,'PRODUCT_DETAIL_PRIMARY_MEDIA_SOURCE_REQUIRED');
  const imageState=await mainImage.evaluate(image=>({
   objectFit:getComputedStyle(image).objectFit,
   naturalWidth:image instanceof HTMLImageElement?image.naturalWidth:0,
   naturalHeight:image instanceof HTMLImageElement?image.naturalHeight:0,
   alt:image.getAttribute('alt')||'',
  }));
  assert(imageState.objectFit==='contain',`PRODUCT_DETAIL_PRIMARY_MEDIA_MUST_CONTAIN:${width}:${imageState.objectFit}`);
  assert(imageState.naturalWidth>0&&imageState.naturalHeight>0,`PRODUCT_DETAIL_PRIMARY_MEDIA_NOT_LOADED:${width}`);
  assert(imageState.alt.includes(fixture.name),`PRODUCT_DETAIL_PRIMARY_MEDIA_ALT_MISSING_PRODUCT_NAME:${width}`);

  const orientationStress=[];
  for(const sample of [{name:'portrait',width:1200,height:1800},{name:'landscape',width:1800,height:1200}]){
   await setImageSource(mainImage,stressAsset(sample.width,sample.height));
   const state=await mainImage.evaluate(image=>({objectFit:getComputedStyle(image).objectFit,naturalWidth:image instanceof HTMLImageElement?image.naturalWidth:0,naturalHeight:image instanceof HTMLImageElement?image.naturalHeight:0}));
   const stressBox=await mainImage.boundingBox();
   assert(state.objectFit==='contain',`PRODUCT_DETAIL_${sample.name.toUpperCase()}_MEDIA_MUST_CONTAIN:${width}:${state.objectFit}`);
   assert(state.naturalWidth===sample.width&&state.naturalHeight===sample.height,`PRODUCT_DETAIL_${sample.name.toUpperCase()}_TEST_DIMENSIONS_MISMATCH:${width}:${state.naturalWidth}x${state.naturalHeight}`);
   assert(stressBox&&Math.abs(stressBox.width-imageBox.width)<=2&&Math.abs(stressBox.height-imageBox.height)<=2,`PRODUCT_DETAIL_${sample.name.toUpperCase()}_MEDIA_CHANGED_CANVAS:${width}`);
   orientationStress.push({name:sample.name,naturalWidth:state.naturalWidth,naturalHeight:state.naturalHeight,objectFit:state.objectFit});
  }
  await setImageSource(mainImage,originalSrc);

  const overflow=await page.evaluate(()=>({viewport:window.innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert(overflow.scrollWidth<=overflow.viewport+1,`PRODUCT_DETAIL_HORIZONTAL_OVERFLOW:${width}:${overflow.scrollWidth}`);

  await page.getByRole('button',{name:`${fixture.name} görselini büyüt`,exact:true}).click();
  const viewer=page.getByRole('dialog',{name:fixture.name,exact:true});
  await viewer.waitFor({state:'visible',timeout:5000});
  const viewerImage=viewer.locator('img').first();
  await viewerImage.waitFor({state:'visible',timeout:5000});
  const viewerState=await viewerImage.evaluate(image=>({objectFit:getComputedStyle(image).objectFit,alt:image.getAttribute('alt')||''}));
  assert(viewerState.objectFit==='contain',`PRODUCT_DETAIL_VIEWER_MUST_CONTAIN:${width}:${viewerState.objectFit}`);
  assert(viewerState.alt.includes(fixture.name),`PRODUCT_DETAIL_VIEWER_ALT_MISSING_PRODUCT_NAME:${width}`);
  const close=viewer.getByRole('button',{name:'Görseli kapat',exact:true});
  const closeBox=await close.boundingBox();
  assert(closeBox&&closeBox.width>=44&&closeBox.height>=44,`PRODUCT_DETAIL_VIEWER_CLOSE_TARGET_TOO_SMALL:${width}`);
  await close.click();
  await viewer.waitFor({state:'hidden',timeout:5000});

  const metrics={
   width,
   toolbarBottom:Math.round(toolbarBox.y+toolbarBox.height),
   imageTop:Math.round(imageBox.y),
   imageSize:Math.round(imageBox.width),
   galleryBottom:Math.round(galleryBox.y+galleryBox.height),
   infoTop:Math.round(infoBox.y),
   objectFit:imageState.objectFit,
   naturalWidth:imageState.naturalWidth,
   naturalHeight:imageState.naturalHeight,
   scrollWidth:overflow.scrollWidth,
   viewerOpened:true,
   orientationStress,
   consoleErrors,
  };
  results.push(metrics);
  if(width===390)await page.screenshot({path:path.join(out,'product-detail-media-390.png'),fullPage:true});
  await context.close();
 }
 fs.writeFileSync(path.join(out,'product-detail-media-report.json'),JSON.stringify({fixture,results,checkedAt:new Date().toISOString()},null,2));
 console.log(`Product detail media geometry, viewer and orientation stress passed at ${widths.join(', ')}px for ${fixture.name} (${fixture.mediaMode}).`);
}finally{
 await browser.close();
}
