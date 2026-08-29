import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const supabaseUrl=String(process.env.VITE_SUPABASE_URL||'').replace(/\/+$/,'');
const supabasePublishableKey=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const widths=[320,360,375,390,412,430];
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});

function assert(condition,message){if(!condition)throw new Error(message);}

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
 const item=items.find(row=>row&&typeof row==='object'&&typeof row.name==='string'&&row.name.trim()&&typeof row.slug==='string'&&row.slug.trim()&&typeof row.imagePath==='string'&&row.imagePath.trim());
 assert(item,'PRODUCT_DETAIL_MEDIA_AUTHENTIC_FIXTURE_REQUIRED');
 return{name:item.name.trim(),slug:item.slug.trim(),imagePath:item.imagePath.trim()};
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
  const mainImage=gallery.locator(':scope > div:first-child > img').first();
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

  const imageState=await mainImage.evaluate(image=>({
   objectFit:getComputedStyle(image).objectFit,
   naturalWidth:image instanceof HTMLImageElement?image.naturalWidth:0,
   naturalHeight:image instanceof HTMLImageElement?image.naturalHeight:0,
   alt:image.getAttribute('alt')||'',
  }));
  assert(imageState.objectFit==='contain',`PRODUCT_DETAIL_PRIMARY_MEDIA_MUST_CONTAIN:${width}:${imageState.objectFit}`);
  assert(imageState.naturalWidth>0&&imageState.naturalHeight>0,`PRODUCT_DETAIL_PRIMARY_MEDIA_NOT_LOADED:${width}`);
  assert(imageState.alt.includes(fixture.name),`PRODUCT_DETAIL_PRIMARY_MEDIA_ALT_MISSING_PRODUCT_NAME:${width}`);

  const overflow=await page.evaluate(()=>({viewport:window.innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert(overflow.scrollWidth<=overflow.viewport+1,`PRODUCT_DETAIL_HORIZONTAL_OVERFLOW:${width}:${overflow.scrollWidth}`);

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
   consoleErrors,
  };
  results.push(metrics);
  if(width===390)await page.screenshot({path:path.join(out,'product-detail-media-390.png'),fullPage:true});
  await context.close();
 }
 fs.writeFileSync(path.join(out,'product-detail-media-report.json'),JSON.stringify({fixture,results,checkedAt:new Date().toISOString()},null,2));
 console.log(`Product detail media geometry passed at ${widths.join(', ')}px for ${fixture.name}.`);
}finally{
 await browser.close();
}
