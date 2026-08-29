import fs from'node:fs';import path from'node:path';import{chromium}from'playwright';
const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');const out=path.resolve('e2e-artifacts');fs.mkdirSync(out,{recursive:true});
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');
function requireIncludes(label,value,marker){if(!normalize(label).includes(normalize(value)))throw new Error(`${marker}: label=${JSON.stringify(label)} missing=${JSON.stringify(value)}`);}
async function declaredAccessibleName(card,button){const labelledBy=(await button.getAttribute('aria-labelledby')||'').trim();if(labelledBy){const parts=[];for(const id of labelledBy.split(/\s+/)){const text=(await card.locator(`#${CSS.escape(id)}`).textContent()||'').trim();if(text)parts.push(text);}if(parts.length)return parts.join(' ');}return(await button.getAttribute('aria-label')||'').trim();}
async function verifyCard(page,{cardSelector,buttonSelector,titleSelector,priceSelector,screen}){
 const card=page.locator(cardSelector).first();await card.waitFor({state:'visible',timeout:20000});
 const title=(await card.locator(titleSelector).first().textContent()||'').trim();if(!title)throw new Error(`${screen}_PRODUCT_TITLE_MISSING`);
 const button=card.locator(buttonSelector).first();const label=await declaredAccessibleName(card,button);if(!label)throw new Error(`${screen}_ACCESSIBLE_NAME_DECLARATION_MISSING`);
 requireIncludes(label,title,`${screen}_ARIA_NAME_MISSING_TITLE`);
 const priceNode=card.locator(priceSelector).first();if(await priceNode.count()){const current=(await priceNode.locator('strong').count()?await priceNode.locator('strong').first().textContent():await priceNode.textContent())||'';if(current.trim())requireIncludes(label,current.trim(),`${screen}_ARIA_NAME_MISSING_PRICE`);const compare=await priceNode.locator('span').first();if(await compare.count()){const compareText=(await compare.textContent()||'').replace(/^Önce\s+/i,'').trim();if(compareText)requireIncludes(label,compareText,`${screen}_ARIA_NAME_MISSING_COMPARE_PRICE`);}}
 const visibleBadge=card.locator('.go-product-card-v2__signals [class*="badge"], .go-product-card__badge').first();if(await visibleBadge.count()){const badge=(await visibleBadge.textContent()||'').trim();if(badge)requireIncludes(label,badge,`${screen}_ARIA_NAME_MISSING_STATUS`);}
 const image=card.locator('img').first();if(await image.count()){const alt=(await image.getAttribute('alt')||'').trim();if(!alt)throw new Error(`${screen}_IMAGE_ALT_EMPTY`);requireIncludes(alt,title,`${screen}_IMAGE_ALT_MISSING_PRODUCT_NAME`);}
 await page.getByRole('button',{name:label,exact:true}).first().waitFor({state:'visible',timeout:5000});
 return{screen,title,label};
}
const browser=await chromium.launch({headless:true});const report=[];let homeProduct='';
try{
 const context=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:45000});
 const home=await verifyCard(page,{cardSelector:'.go-product-card-v2',buttonSelector:'.go-product-card-v2__button',titleSelector:'.go-product-card-v2__title',priceSelector:'.go-price-display',screen:'HOME'});report.push(home);homeProduct=home.title;
 await page.goto(`${baseUrl}/?tab=categories`,{waitUntil:'networkidle',timeout:45000});
 const category=await verifyCard(page,{cardSelector:'.go-product-card',buttonSelector:'.go-product-card__media button',titleSelector:'h3',priceSelector:'.go-product-card__price',screen:'CATEGORY'});report.push(category);
 await page.goto(`${baseUrl}/?tab=search-results&q=${encodeURIComponent(homeProduct)}`,{waitUntil:'networkidle',timeout:45000});
 const search=await verifyCard(page,{cardSelector:'.go-product-card',buttonSelector:'.go-product-card__media button',titleSelector:'h3',priceSelector:'.go-product-card__price',screen:'SEARCH'});report.push(search);
 await page.screenshot({path:path.join(out,'product-card-accessibility-runtime.png'),fullPage:true});
 await context.close();
}finally{await browser.close();fs.writeFileSync(path.join(out,'product-card-accessibility-report.json'),JSON.stringify({baseUrl,homeProduct,report,finishedAt:new Date().toISOString()},null,2));}
console.log('Golden Oremar product-card runtime accessibility passed for Home, Category and Search using role/name resolution.');
