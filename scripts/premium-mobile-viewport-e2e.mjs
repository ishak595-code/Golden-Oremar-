import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const widths=[320,360,375,390,412,430];
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true});

function assert(condition,message){if(!condition)throw new Error(message);}

async function loadAllDeferredSections(page,width){
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';});
 const sections=page.locator('.go-product-section-v2--deferred');
 const count=await sections.count();
 for(let index=0;index<count;index++){
  const host=sections.nth(index);
  await page.evaluate(sectionIndex=>{
   const hosts=[...document.querySelectorAll('.go-product-section-v2--deferred')];
   const target=hosts[sectionIndex];
   if(!target)throw new Error(`DEFERRED_SECTION_HOST_MISSING_${sectionIndex}`);
   const top=target.getBoundingClientRect().top+window.scrollY-Math.max(80,window.innerHeight*.25);
   window.scrollTo({top:Math.max(0,top),behavior:'auto'});
  },index);
  const firstCard=host.locator('.go-product-card-v2').first();
  const error=host.locator('.go-inline-error');
  await Promise.race([
   firstCard.waitFor({state:'visible',timeout:15000}),
   error.waitFor({state:'visible',timeout:15000}).then(async()=>{throw new Error(`DEFERRED_SECTION_ERROR_${width}_${index}:${(await error.textContent())||'unknown'}`);}),
  ]);
 }
 return count;
}

async function verifyAdaptiveHeader(page,width){
 const target=await page.evaluate(()=>{
  document.documentElement.style.scrollBehavior='auto';
  document.body.style.scrollBehavior='auto';
  const maxScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const next=Math.min(240,maxScroll);
  if(next<=104)throw new Error(`ADAPTIVE_HEADER_SCROLL_RANGE_TOO_SMALL:${next}`);
  window.scrollTo({top:next,behavior:'auto'});
  return next;
 });
 await page.waitForFunction(()=>document.documentElement.dataset.goHeaderCompact==='true',null,{timeout:2500});
 const compact=await page.evaluate(()=>({
  compact:document.documentElement.dataset.goHeaderCompact,
  searchVisible:!!document.querySelector('.go-search-bar input')?.getBoundingClientRect().width,
  voiceVisible:!!document.querySelector('.go-search-bar__voice')?.getBoundingClientRect().width,
  cartVisible:!!document.querySelector('header button[aria-label^="Sepetim"]')?.getBoundingClientRect().width,
 }));
 assert(compact.compact==='true'&&compact.searchVisible&&compact.voiceVisible&&compact.cartVisible,`ADAPTIVE_HEADER_COMPACT_FAILED_${width}:${JSON.stringify(compact)}`);
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'auto'}));
 await page.waitForFunction(()=>document.documentElement.dataset.goHeaderCompact==='false',null,{timeout:2500});
 return{target,...compact,expanded:true};
}

async function verifyProductDetailDock(page,width){
 await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:45000});
 const row=page.locator('.go-product-card-v2__button[data-product-link="true"]').first();
 await row.waitFor({state:'visible',timeout:15000});
 assert(await row.evaluate(element=>element.tagName)==='A',`HOME_PRODUCT_ROW_NOT_LINK_${width}`);
 await row.click();
 await page.waitForFunction(()=>document.documentElement.dataset.appTab==='product-detail',null,{timeout:15000});
 const dock=page.locator('.product-detail-commerce-dock');
 await dock.waitFor({state:'visible',timeout:15000});
 await page.getByRole('button',{name:'Miktarı azalt',exact:true}).waitFor({state:'visible',timeout:5000});
 await page.getByRole('button',{name:'Miktarı artır',exact:true}).waitFor({state:'visible',timeout:5000});
 assert(await page.locator('input[type="radio"][name="variant"]').count()===0,`PRODUCT_DETAIL_REDUNDANT_RADIO_OPTION_${width}`);
 assert(await page.getByText('Paket / seçenek',{exact:true}).count()===0,`PRODUCT_DETAIL_SINGLE_VARIANT_SELECTOR_VISIBLE_${width}`);
 const dockText=(await dock.textContent()||'').replace(/\s+/g,' ').trim();
 assert(!/\bTL\b/.test(dockText),`PRODUCT_DETAIL_DOCK_REPEATED_PRICE_${width}:${dockText}`);
 const before=await dock.evaluate(element=>{
  const rect=element.getBoundingClientRect();
  const style=getComputedStyle(element);
  const buttons=[...element.querySelectorAll('.product-detail-commerce-actions>button')];
  return{
   position:style.position,top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,viewportHeight:window.innerHeight,
   labels:buttons.map(button=>(button.textContent||'').replace(/\s+/g,' ').trim()),
   visible:buttons.map(button=>{const r=button.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=-1&&r.bottom<=window.innerHeight+1;}),
  };
 });
 assert(before.position==='fixed',`PRODUCT_DETAIL_DOCK_NOT_FIXED_${width}:${before.position}`);
 assert(before.labels.length===3,`PRODUCT_DETAIL_ACTION_COUNT_${width}:${before.labels.length}`);
 assert(before.labels[0]==='Hediye Et'&&['Sepete Ekle','Ön Sipariş'].includes(before.labels[1])&&before.labels[2]==='Hemen Satın Al',`PRODUCT_DETAIL_ACTION_ORDER_${width}:${JSON.stringify(before.labels)}`);
 assert(before.visible.every(Boolean),`PRODUCT_DETAIL_ACTION_NOT_VISIBLE_${width}:${JSON.stringify(before.visible)}`);
 assert(before.left>=-1&&before.right<=width+1&&before.bottom<=before.viewportHeight+1,`PRODUCT_DETAIL_DOCK_OVERFLOW_${width}:${JSON.stringify(before)}`);
 await page.evaluate(()=>{const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);window.scrollTo({top:Math.max(0,max*.72),behavior:'auto'});});
 await page.waitForTimeout(120);
 const after=await dock.evaluate(element=>{const rect=element.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,viewportHeight:window.innerHeight,scrollY:window.scrollY};});
 assert(after.scrollY>0,`PRODUCT_DETAIL_SCROLL_RANGE_TOO_SMALL_${width}`);
 assert(after.left>=-1&&after.right<=width+1&&after.top>=-1&&after.bottom<=after.viewportHeight+1,`PRODUCT_DETAIL_DOCK_LOST_AFTER_SCROLL_${width}:${JSON.stringify(after)}`);
 assert(Math.abs(after.top-before.top)<=2&&Math.abs(after.bottom-before.bottom)<=2,`PRODUCT_DETAIL_DOCK_MOVED_WITH_CONTENT_${width}`);
 await page.screenshot({path:path.join(out,`product-detail-fixed-dock-${width}.png`),fullPage:false});
 return{before,after};
}

async function verifyCategoryViewport(page,width){
 await page.goto(`${baseUrl}/?tab=categories`,{waitUntil:'networkidle',timeout:45000});
 await page.getByRole('heading',{name:'Lezzetleri kendi ritminizde keşfedin',exact:true}).waitFor({state:'visible',timeout:15000});
 await page.locator('#category-products article').first().waitFor({state:'visible',timeout:15000});
 const metrics=await page.evaluate(()=>{
  const root=document.documentElement;
  const select=document.querySelector('select');
  const stock=document.querySelector('input[type="checkbox"]')?.closest('label');
  const grid=document.querySelector('#category-products');
  const card=document.querySelector('#category-products article');
  if(!select||!stock||!grid||!card)throw new Error('CATEGORY_VIEWPORT_REQUIRED_ELEMENT_MISSING');
  const sr=select.getBoundingClientRect(),fr=stock.getBoundingClientRect(),cr=card.getBoundingClientRect();
  const gridStyle=getComputedStyle(grid);
  return{scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,selectRight:sr.right,filterRight:fr.right,cardRight:cr.right,selectLeft:sr.left,filterLeft:fr.left,cardLeft:cr.left,productGridGap:Number.parseFloat(gridStyle.rowGap)||Number.parseFloat(gridStyle.gap)||0};
 });
 assert(metrics.scrollWidth<=metrics.clientWidth+1,`CATEGORY_HORIZONTAL_OVERFLOW_${width}:${metrics.scrollWidth}>${metrics.clientWidth}`);
 for(const[name,left,right]of[['sort',metrics.selectLeft,metrics.selectRight],['stock',metrics.filterLeft,metrics.filterRight],['card',metrics.cardLeft,metrics.cardRight]])assert(left>=-1&&right<=width+1,`CATEGORY_COMPONENT_OVERFLOW_${width}_${name}:${left}:${right}`);
 assert(metrics.productGridGap>=19,`CATEGORY_PRODUCT_GRID_DENSITY_${width}:${metrics.productGridGap}`);
 await page.screenshot({path:path.join(out,`category-mobile-${width}.png`),fullPage:true});
 return metrics;
}

try{
 for(const width of widths){
  const context=await browser.newContext({locale:'tr-TR',viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error?.message||error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:45000});

  const search=page.getByRole('searchbox',{name:'Ürün, üretici veya köy ara',exact:true});
  assert(await search.count()===1,`SEARCHBOX_ACCESSIBLE_NAME_COUNT_${width}:${await search.count()}`);
  await search.waitFor({state:'visible',timeout:15000});
  const voice=page.getByRole('button',{name:'Sesli mikrofon',exact:true});
  assert(await voice.count()===1,`VOICE_CONTROL_COUNT_${width}:${await voice.count()}`);
  await voice.waitFor({state:'visible',timeout:5000});
  assert(await page.getByRole('button',{name:/Mikrofon kapalı|Sesli aramayı başlat/i}).count()===0,`STALE_MICROPHONE_CONTROL_${width}`);
  assert(await page.getByText(/Mikrofon kapalı/i).count()===0,`STALE_MICROPHONE_OFF_COPY_${width}`);
  await page.locator('.go-product-card-v2').first().waitFor({state:'visible',timeout:15000});

  const initial=await page.evaluate(()=>{
   const root=document.documentElement,header=document.querySelector('header'),nav=document.querySelector('nav[aria-label="Ana gezinme"]'),title=document.querySelector('.go-product-card-v2__title'),card=document.querySelector('.go-product-card-v2'),cardButton=document.querySelector('.go-product-card-v2__button[data-product-link="true"]'),voice=document.querySelector('.go-search-bar__voice'),search=document.querySelector('.go-search-bar input'),productGrid=document.querySelector('.go-product-grid-v2'),sectionHeader=document.querySelector('.go-section-header'),media=document.querySelector('.go-product-card-v2__media'),categoryCard=document.querySelector('.go-category-card'),sections=[...document.querySelectorAll('.go-home-section')];
   if(!header||!nav||!title||!card||!cardButton||!voice||!search||!productGrid||!sectionHeader||!media)throw new Error('PREMIUM_HOME_REQUIRED_ELEMENT_MISSING');
   const titleStyle=getComputedStyle(title),image=media.querySelector('img'),cardButtonStyle=getComputedStyle(cardButton),gridStyle=getComputedStyle(productGrid),headerStyle=getComputedStyle(sectionHeader),support=sectionHeader.querySelector('p'),supportStyle=support?getComputedStyle(support):null,spacedSection=sections.length>1?sections[1]:null,cardRect=card.getBoundingClientRect(),mediaRect=media.getBoundingClientRect();
   return{
    scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,headerHeight:header.getBoundingClientRect().height,navButtons:nav.querySelectorAll('button').length,
    titleWhiteSpace:titleStyle.whiteSpace,titleClamp:titleStyle.getPropertyValue('-webkit-line-clamp'),titleLineHeight:titleStyle.lineHeight,
    cardWidth:cardRect.width,cardLeft:cardRect.left,cardRight:cardRect.right,cardButtonHeight:cardButton.getBoundingClientRect().height,cardPaddingTop:Number.parseFloat(cardButtonStyle.paddingTop)||0,
    productGridGap:Number.parseFloat(gridStyle.rowGap)||Number.parseFloat(gridStyle.gap)||0,productGridColumns:gridStyle.gridTemplateColumns,
    sectionHeaderMarginBottom:Number.parseFloat(headerStyle.marginBottom)||0,sectionMarginTop:spacedSection?(Number.parseFloat(getComputedStyle(spacedSection).marginTop)||0):null,supportLineHeight:supportStyle?(Number.parseFloat(supportStyle.lineHeight)||0):null,
    categoryCardHeight:categoryCard?categoryCard.getBoundingClientRect().height:null,searchWidth:search.getBoundingClientRect().width,voiceWidth:voice.getBoundingClientRect().width,imageFit:image?getComputedStyle(image).objectFit:null,
    mediaWidth:mediaRect.width,mediaHeight:mediaRect.height,productId:card.getAttribute('data-product-id')||'',productReference:card.getAttribute('data-product-reference')||'',productRowTag:cardButton.tagName,
    legacyBadgeCount:cardButton.querySelectorAll('.go-product-badge,.go-product-card-v2__trailing').length,
    priceText:(cardButton.querySelector('.go-product-card-v2__price strong')?.textContent||'').trim(),
   };
  });

  assert(initial.scrollWidth<=initial.clientWidth+1,`HORIZONTAL_OVERFLOW_${width}:${initial.scrollWidth}>${initial.clientWidth}`);
  assert(initial.navButtons===5,`BOTTOM_NAV_COUNT_${width}:${initial.navButtons}`);
  assert(initial.productRowTag==='A',`HOME_PRODUCT_ROW_LINK_SEMANTICS_${width}:${initial.productRowTag}`);
  assert(initial.titleWhiteSpace!=='nowrap'&&initial.titleClamp==='2',`PRODUCT_TITLE_TRUNCATION_CONTRACT_${width}:${initial.titleWhiteSpace}:${initial.titleClamp}`);
  assert(initial.cardWidth<=width&&initial.searchWidth<=width&&initial.cardLeft>=-1&&initial.cardRight<=width+1,`MOBILE_COMPONENT_WIDTH_OVERFLOW_${width}`);
  assert(initial.voiceWidth>=43,`VOICE_TOUCH_TARGET_TOO_SMALL_${width}:${initial.voiceWidth}`);
  assert(!initial.imageFit||initial.imageFit==='cover',`PRODUCT_IMAGE_OBJECT_FIT_${width}:${initial.imageFit}`);
  assert(Math.abs(initial.mediaWidth-initial.mediaHeight)<=1,`PRODUCT_MEDIA_NOT_SQUARE_${width}:${initial.mediaWidth}x${initial.mediaHeight}`);
  const expectedMedia=width<=350?68:76;
  assert(Math.abs(initial.mediaWidth-expectedMedia)<=1,`PRODUCT_MEDIA_SIZE_${width}:${initial.mediaWidth}!=${expectedMedia}`);
  assert(Boolean(initial.productId&&initial.productReference),`PRODUCT_ROW_IDENTITY_MISSING_${width}`);
  assert(initial.productGridColumns.trim().split(/\s+/).filter(Boolean).length===1,`HOME_PRODUCT_GRID_COLUMN_REGRESSION_${width}:${initial.productGridColumns}`);
  assert(initial.sectionMarginTop===null||initial.sectionMarginTop>=39,`HOME_SECTION_RHYTHM_TOO_DENSE_${width}:${initial.sectionMarginTop}`);
  assert(initial.sectionHeaderMarginBottom>=19,`HOME_SECTION_HEADER_GAP_TOO_DENSE_${width}:${initial.sectionHeaderMarginBottom}`);
  assert(initial.productGridGap<=1,`HOME_PRODUCT_LIST_GAP_REGRESSION_${width}:${initial.productGridGap}`);
  const minRowHeight=width<=350?94:102;
  assert(initial.cardButtonHeight>=minRowHeight&&initial.cardButtonHeight<=132,`HOME_PRODUCT_ROW_HEIGHT_${width}:${initial.cardButtonHeight}`);
  assert(initial.cardPaddingTop>=9&&initial.cardPaddingTop<=13,`HOME_PRODUCT_ROW_PADDING_${width}:${initial.cardPaddingTop}`);
  assert(initial.legacyBadgeCount===0,`HOME_PRODUCT_LEGACY_CARD_UI_${width}:${initial.legacyBadgeCount}`);
  assert(Boolean(initial.priceText),`HOME_PRODUCT_PRICE_MISSING_${width}`);
  assert(initial.categoryCardHeight===null||initial.categoryCardHeight>=171,`HOME_CATEGORY_CARD_HEIGHT_TOO_DENSE_${width}:${initial.categoryCardHeight}`);
  assert(initial.supportLineHeight===null||initial.supportLineHeight>=22,`HOME_SUPPORT_COPY_LINE_HEIGHT_TOO_TIGHT_${width}:${initial.supportLineHeight}`);

  const compact=await verifyAdaptiveHeader(page,width);
  const deferredCount=await loadAllDeferredSections(page,width);
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'auto'}));
  await page.waitForTimeout(120);
  const bottom=await page.evaluate(()=>{
   const nav=document.querySelector('nav[aria-label="Ana gezinme"]'),last=document.querySelector('.go-discover-all');
   if(!nav||!last)throw new Error('BOTTOM_NAV_OCCLUSION_TARGET_MISSING');
   const n=nav.getBoundingClientRect(),l=last.getBoundingClientRect(),root=document.documentElement;
   return{navTop:n.top,lastBottom:l.bottom,docScrollWidth:root.scrollWidth,clientWidth:root.clientWidth,scrollY:window.scrollY,maxScroll:Math.max(0,root.scrollHeight-window.innerHeight)};
  });
  assert(Math.abs(bottom.scrollY-bottom.maxScroll)<=2,`BOTTOM_SCROLL_NOT_SETTLED_${width}:${bottom.scrollY}/${bottom.maxScroll}`);
  assert(bottom.docScrollWidth<=bottom.clientWidth+1,`BOTTOM_HORIZONTAL_OVERFLOW_${width}`);
  assert(bottom.lastBottom<=bottom.navTop-4,`BOTTOM_NAV_OCCLUSION_${width}:last=${bottom.lastBottom}:nav=${bottom.navTop}`);

  await search.focus();
  const focusOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert(focusOverflow<=1,`FOCUSED_SEARCH_OVERFLOW_${width}:${focusOverflow}`);
  const detailDock=await verifyProductDetailDock(page,width);
  const category=await verifyCategoryViewport(page,width);
  assert(errors.length===0,`PAGE_ERRORS_${width}:${errors.join(' | ').slice(0,2000)}`);
  results.push({width,...initial,compact,deferredCount,bottom,detailDock,category});
  await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:45000});
  await page.screenshot({path:path.join(out,`premium-mobile-${width}.png`),fullPage:true});
  await context.close();
  console.log(`Premium Mobile viewport ${width}px passed.`);
 }
}finally{
 await browser.close();
 fs.writeFileSync(path.join(out,'premium-mobile-viewport-report.json'),JSON.stringify({baseUrl,widths,results,finishedAt:new Date().toISOString()},null,2));
}
console.log('Golden Oremar Premium Mobile viewport E2E passed at 320/360/375/390/412/430 px with canonical marketplace product rows, stable voice search, fixed product-detail commerce actions and overflow-safe category discovery.');
