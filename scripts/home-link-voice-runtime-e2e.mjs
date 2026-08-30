import fs from'node:fs';
import path from'node:path';
import{chromium}from'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.message||error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

try{
 await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:45000});
 const voice=page.getByRole('button',{name:'Sesli mikrofon',exact:true});
 if(await voice.count()!==1)throw new Error(`VOICE_ACCESSIBLE_NAME_COUNT:${await voice.count()}`);
 await voice.waitFor({state:'visible',timeout:15000});
 const voiceState=await voice.evaluate(element=>({tag:element.tagName,label:element.getAttribute('aria-label'),pressed:element.getAttribute('aria-pressed'),listening:element.getAttribute('data-listening'),busy:element.getAttribute('aria-busy')}));
 if(voiceState.pressed!==null)throw new Error(`VOICE_TOGGLE_STATE_LEAK:${JSON.stringify(voiceState)}`);
 if(voiceState.label!=='Sesli mikrofon')throw new Error(`VOICE_LABEL_REGRESSION:${voiceState.label}`);
 if(await page.getByText(/Mikrofon kapalı/i).count()!==0)throw new Error('VOICE_OFF_COPY_VISIBLE');

 const row=page.locator('.go-product-card-v2__button[data-product-link="true"]').first();
 await row.waitFor({state:'visible',timeout:15000});
 const rowMeta=await row.evaluate(element=>{
  const rect=element.getBoundingClientRect();
  const parent=element.closest('.go-product-card-v2')?.getBoundingClientRect();
  const media=element.querySelector('.go-product-card-v2__media');
  const body=element.querySelector('.go-product-card-v2__body');
  const title=element.querySelector('.go-product-card-v2__title');
  const rating=element.querySelector('.go-product-card-v2__rating');
  const price=element.querySelector('.go-product-card-v2__price strong');
  const meta=element.querySelector('.go-product-card-v2__meta');
  const chevron=element.querySelector('.go-product-card-v2__chevron');
  const mediaRect=media?.getBoundingClientRect();
  const bodyRect=body?.getBoundingClientRect();
  const chevronRect=chevron?.getBoundingClientRect();
  const style=getComputedStyle(element);
  const titleStyle=title?getComputedStyle(title):null;
  return{
   tag:element.tagName,href:element.getAttribute('href')||'',
   left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,
   parentLeft:parent?.left??null,parentRight:parent?.right??null,parentTop:parent?.top??null,parentBottom:parent?.bottom??null,
   display:style.display,gridTemplateColumns:style.gridTemplateColumns,
   mediaInsideLink:Boolean(media&&element.contains(media)),mediaLeft:mediaRect?.left??null,mediaRight:mediaRect?.right??null,mediaTop:mediaRect?.top??null,mediaBottom:mediaRect?.bottom??null,mediaWidth:mediaRect?.width??null,mediaHeight:mediaRect?.height??null,
   bodyLeft:bodyRect?.left??null,bodyRight:bodyRect?.right??null,chevronLeft:chevronRect?.left??null,chevronRight:chevronRect?.right??null,
   titleFontSize:titleStyle?Number.parseFloat(titleStyle.fontSize):null,
   ratingText:(rating?.textContent||'').trim(),priceText:(price?.textContent||'').trim(),metaText:(meta?.textContent||'').trim(),
   badgeCount:element.querySelectorAll('.go-product-badge').length,
   oldTrailingCount:element.querySelectorAll('.go-product-card-v2__trailing').length,
   nestedInteractiveCount:element.querySelectorAll('a,button,input,select,textarea').length,
  };
 });
 if(rowMeta.tag!=='A'||!rowMeta.href||rowMeta.href==='#')throw new Error(`HOME_PRODUCT_NOT_REAL_LINK:${JSON.stringify(rowMeta)}`);
 if(rowMeta.parentLeft===null)throw new Error('HOME_PRODUCT_LINK_PARENT_MISSING');
 if(Math.abs(rowMeta.left-rowMeta.parentLeft)>2||Math.abs(rowMeta.right-rowMeta.parentRight)>2||Math.abs(rowMeta.top-rowMeta.parentTop)>2||Math.abs(rowMeta.bottom-rowMeta.parentBottom)>2)throw new Error(`HOME_PRODUCT_LINK_GEOMETRY:${JSON.stringify(rowMeta)}`);
 if(rowMeta.width<340)throw new Error(`HOME_PRODUCT_LINK_NOT_FULL_WIDTH:${rowMeta.width}`);
 if(rowMeta.height>124||rowMeta.height<94)throw new Error(`HOME_PRODUCT_ROW_DENSITY_REGRESSION:${JSON.stringify(rowMeta)}`);
 if(rowMeta.display!=='grid')throw new Error(`HOME_PRODUCT_ROW_NOT_GRID:${JSON.stringify(rowMeta)}`);
 if(!rowMeta.mediaInsideLink||rowMeta.mediaLeft===null)throw new Error(`HOME_PRODUCT_MEDIA_NOT_INSIDE_LINK:${JSON.stringify(rowMeta)}`);
 if(rowMeta.mediaLeft<rowMeta.left-1||rowMeta.mediaRight>rowMeta.right+1||rowMeta.mediaTop<rowMeta.top-1||rowMeta.mediaBottom>rowMeta.bottom+1)throw new Error(`HOME_PRODUCT_MEDIA_OUTSIDE_ROW:${JSON.stringify(rowMeta)}`);
 if(rowMeta.mediaWidth>82||rowMeta.mediaHeight>82||rowMeta.mediaWidth<68||rowMeta.mediaHeight<68)throw new Error(`HOME_PRODUCT_THUMBNAIL_DENSITY_REGRESSION:${JSON.stringify(rowMeta)}`);
 if(rowMeta.titleFontSize===null||rowMeta.titleFontSize>16.5||rowMeta.titleFontSize<14)throw new Error(`HOME_PRODUCT_TITLE_SCALE_REGRESSION:${JSON.stringify(rowMeta)}`);
 if(rowMeta.badgeCount!==0||rowMeta.oldTrailingCount!==0)throw new Error(`HOME_PRODUCT_LEGACY_CARD_UI_REGRESSION:${JSON.stringify(rowMeta)}`);
 if(!rowMeta.priceText)throw new Error(`HOME_PRODUCT_PRICE_MISSING:${JSON.stringify(rowMeta)}`);
 if(!rowMeta.metaText)throw new Error(`HOME_PRODUCT_META_MISSING:${JSON.stringify(rowMeta)}`);
 if(rowMeta.bodyLeft===null||rowMeta.bodyRight===null||rowMeta.chevronLeft===null||rowMeta.chevronRight===null||rowMeta.bodyRight>rowMeta.chevronLeft+1||rowMeta.chevronRight>rowMeta.right+1)throw new Error(`HOME_PRODUCT_COLUMN_OVERLAP:${JSON.stringify(rowMeta)}`);
 if(rowMeta.nestedInteractiveCount!==0)throw new Error(`HOME_PRODUCT_NESTED_INTERACTIVE:${JSON.stringify(rowMeta)}`);

 const allRows=page.locator('.go-product-card-v2__button[data-product-link="true"]');
 const rowCount=await allRows.count();
 if(rowCount<1)throw new Error('HOME_PRODUCT_ROWS_MISSING');
 const invalidRows=await allRows.evaluateAll(elements=>elements.filter(element=>{
  const rect=element.getBoundingClientRect();
  const media=element.querySelector('.go-product-card-v2__media');
  const mediaRect=media?.getBoundingClientRect();
  const title=element.querySelector('.go-product-card-v2__title');
  const titleSize=title?Number.parseFloat(getComputedStyle(title).fontSize):999;
  const body=element.querySelector('.go-product-card-v2__body')?.getBoundingClientRect();
  const chevron=element.querySelector('.go-product-card-v2__chevron')?.getBoundingClientRect();
  const price=(element.querySelector('.go-product-card-v2__price strong')?.textContent||'').trim();
  return element.tagName!=='A'||rect.height>124||rect.height<94||!media||!element.contains(media)||!mediaRect||mediaRect.width>82||mediaRect.height>82||mediaRect.width<68||mediaRect.height<68||mediaRect.right>rect.right+1||mediaRect.bottom>rect.bottom+1||titleSize>16.5||element.querySelectorAll('.go-product-badge,.go-product-card-v2__trailing').length!==0||!price||!body||!chevron||body.right>chevron.left+1;
 }).length);
 if(invalidRows!==0)throw new Error(`HOME_PRODUCT_ROW_SET_REGRESSION:${invalidRows}/${rowCount}`);

 await page.screenshot({path:path.join(out,'home-link-voice-runtime.png'),fullPage:false});
 await row.click({position:{x:Math.max(1,rowMeta.width-12),y:Math.max(1,rowMeta.height/2)}});
 await page.waitForFunction(()=>document.documentElement.dataset.appTab==='product-detail',null,{timeout:15000});
 const result={baseUrl,voice:voiceState,row:rowMeta,rowCount,invalidRows,navigatedToProductDetail:true,pageErrors:errors};
 if(errors.length)throw new Error(`RUNTIME_ERRORS:${errors.join(' | ').slice(0,2000)}`);
 fs.writeFileSync(path.join(out,'home-link-voice-runtime-report.json'),JSON.stringify(result,null,2));
 console.log('Home voice and reference marketplace-list runtime contract passed.');
}finally{
 await context.close();
 await browser.close();
}
