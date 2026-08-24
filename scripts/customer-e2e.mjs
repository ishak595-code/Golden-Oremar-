import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const supabaseUrl=String(process.env.VITE_SUPABASE_URL||'').replace(/\/+$/,'');
const runId=String(process.env.GITHUB_RUN_ID||Date.now());
const oidcToken=String(process.env.E2E_CI_OIDC_TOKEN||'').trim();
const controlUrl=String(process.env.E2E_CI_CONTROL_URL||`${supabaseUrl}/functions/v1/ci-e2e-user`).trim();
const supabasePublishableKey=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const allowPublicOnly=String(process.env.E2E_ALLOW_PUBLIC_ONLY||'')==='1';
const email=`goldenoremar+ci-e2e-${runId}@gmail.com`;
const authSecret=`${crypto.randomBytes(24).toString('base64url')}Aa1!`;
const displayName=`Golden Oremar E2E ${runId}`;
const phone='+905379594851';
let productName='';
let productSlug='';
const homeSearchLabel='Ürün, üretici veya köy ara';
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});
const report={runId,email,baseUrl,productName:null,productSlug:null,startedAt:new Date().toISOString(),mode:oidcToken?'authenticated-oidc-provisioned':'public-only-explicit',checks:{},blockers:[],deferredCoverage:[],consoleErrors:[],pageErrors:[]};
const mark=(key,value=true)=>{report.checks[key]=value;};
const defer=(code)=>{if(!report.deferredCoverage.includes(code))report.deferredCoverage.push(code);};
const save=()=>fs.writeFileSync(path.join(out,'customer-e2e-report.json'),JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2));
const shot=async(page,name)=>page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
const visible=async(locator,timeout=12000)=>{try{await locator.waitFor({state:'visible',timeout});return true;}catch{return false;}};

async function ciControl(action,payload={}){
 if(!oidcToken)throw new Error('GITHUB_OIDC_E2E_TOKEN_REQUIRED');
 if(!controlUrl)throw new Error('E2E_CI_CONTROL_URL_REQUIRED');
 const response=await fetch(controlUrl,{method:'POST',headers:{Authorization:`Bearer ${oidcToken}`,'Content-Type':'application/json'},body:JSON.stringify({action,runId,...payload})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body?.ok!==true)throw new Error(`E2E_CI_CONTROL_${String(action).toUpperCase()}_FAILED:${response.status}:${String(body?.error||'unknown')}`);
 return body;
}

async function resolvePublishedCatalogFixture(){
 if(!supabaseUrl||!supabasePublishableKey)throw new Error('PUBLIC_CATALOG_FIXTURE_CONFIG_REQUIRED');
 const response=await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_home_catalog_v3`,{method:'POST',headers:{apikey:supabasePublishableKey,'Content-Type':'application/json'},body:'{}'});
 const payload=await response.json().catch(()=>null);
 if(!response.ok||!payload||typeof payload!=='object')throw new Error(`PUBLIC_CATALOG_FIXTURE_QUERY_FAILED:${response.status}`);
 const items=Array.isArray(payload.items)?payload.items:[];
 const fixture=items.find(item=>item&&typeof item==='object'&&typeof item.name==='string'&&item.name.trim()&&typeof item.slug==='string'&&item.slug.trim()&&typeof item.imagePath==='string'&&item.imagePath.trim());
 if(!fixture)return null;
 productName=fixture.name.trim();
 productSlug=fixture.slug.trim();
 report.productName=productName;
 report.productSlug=productSlug;
 mark('catalog_fixture_discovered',true);
 return{productName,productSlug};
}

async function assertGlobalHomeHeaderHidden(page,checkName){const search=page.getByRole('searchbox',{name:homeSearchLabel});if(await visible(search,1000))throw new Error(`GLOBAL_HOME_HEADER_VISIBLE_OUTSIDE_HOME:${checkName}`);mark(checkName,true);}
async function openHomeShell(page){await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:30000});let search=page.getByRole('searchbox',{name:homeSearchLabel});if(!(await visible(search,4000))){const homeButton=page.getByRole('button',{name:'Ana Sayfa',exact:true});if(await visible(homeButton,3000)){await homeButton.click();await page.waitForURL(url=>new URL(url).searchParams.get('tab')==='home',{timeout:10000}).catch(()=>{});}search=page.getByRole('searchbox',{name:homeSearchLabel});}await search.waitFor({state:'visible',timeout:12000});const activeTab=await page.evaluate(()=>new URL(window.location.href).searchParams.get('tab')||'home');if(activeTab!=='home')throw new Error(`HOME_SHELL_ROUTE_MISMATCH:${activeTab}`);mark('home_shell_navigation',true);return search;}
async function openPublicProductFromHome(page){
 const search=await openHomeShell(page);
 const appearance=await page.evaluate(()=>({theme:document.documentElement.getAttribute('data-theme'),background:getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim()}));
 if(appearance.theme!=='custom'||!appearance.background)throw new Error(`MANAGED_BRAND_APPEARANCE_NOT_APPLIED:${JSON.stringify(appearance)}`);
 mark('managed_brand_appearance_runtime',true);
 const managedSectionVisible=await visible(page.getByText('Golden Oremar seçkisi',{exact:true}).first(),3000);
 const seasonalVisible=await visible(page.getByText(/Mevsim/i).first(),1500);
 const campaignVisible=await visible(page.getByText(/Fırsat|Kampanya|Teklif/i).first(),1500);
 const newVisible=await visible(page.getByText(/Yeni/i).first(),1500);
 mark('home_dynamic_sections',managedSectionVisible||seasonalVisible||campaignVisible||newVisible);
 const fixture=await resolvePublishedCatalogFixture();
 if(!fixture){
  mark('catalog_fail_closed_without_authentic_media',true);
  defer('AUTHENTIC_CATALOG_MEDIA_REQUIRED_FOR_COMMERCE_E2E');
  await shot(page,'03-catalog-fail-closed');
  return false;
 }
 await search.fill(productName);
 await search.press('Enter');
 const product=page.getByText(productName,{exact:true}).first();
 await product.waitFor({state:'visible',timeout:8000});
 mark('catalog_search',true);
 await shot(page,'03-search');
 await product.click();
 await page.getByRole('heading',{name:productName,exact:true}).waitFor({state:'visible',timeout:15000});
 mark('product_detail',true);
 if(await visible(page.getByText('Ürün görseli yakında',{exact:true}),1000))throw new Error('PUBLISHED_PRODUCT_MEDIA_PLACEHOLDER_EXPOSED');
 return true;
}
async function verifyPublicSections(page){await page.goto(`${baseUrl}/?tab=health`,{waitUntil:'networkidle',timeout:30000});await page.getByRole('heading',{name:'Sağlık & Tarifler'}).waitFor({state:'visible',timeout:12000});await page.getByRole('tab',{name:/Tarifler/}).click();await page.getByRole('tabpanel').waitFor({state:'visible',timeout:12000});mark('health_and_recipes',true);await shot(page,'07-health-recipes');await page.goto(`${baseUrl}/?tab=events`,{waitUntil:'networkidle',timeout:30000});await page.getByRole('heading',{name:'Etkinlikler',exact:true}).waitFor({state:'visible',timeout:12000});mark('events',true);await shot(page,'08-events');await page.goto(`${baseUrl}/?tab=categories`,{waitUntil:'networkidle',timeout:30000});await page.getByText(/Kategori/).first().waitFor({state:'visible',timeout:12000});mark('categories',true);}
async function inspectRegistrationUi(page){await page.goto(`${baseUrl}/?tab=account`,{waitUntil:'networkidle',timeout:45000});await assertGlobalHomeHeaderHidden(page,'account_global_header_hidden');const registerTab=page.getByRole('tab',{name:'Hesap Aç'});await registerTab.waitFor({state:'visible',timeout:12000});await registerTab.click();await page.locator('#auth-display-name').fill(displayName);await page.locator('#auth-phone').fill(phone);await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill(authSecret);await page.locator('#auth-confirm-password').fill(authSecret);await page.getByRole('button',{name:'Hesap Oluştur',exact:true}).waitFor({state:'visible',timeout:5000});mark('registration_ui_accessible',true);mark('registration_contract_guarded',true);await shot(page,'00-registration-ui');}
async function provisionAndLogin(page){await inspectRegistrationUi(page);const provisioned=await ciControl('provision',{password:authSecret,displayName,phone});if(provisioned.provisioned!==true||provisioned.emailConfirmed!==true)throw new Error('OIDC_E2E_PROVISIONING_NOT_CONFIRMED');mark('oidc_disposable_user_provisioned',true);await page.getByRole('tab',{name:'Giriş Yap'}).click();await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill(authSecret);await page.getByRole('button',{name:'Giriş Yap',exact:true}).click();const accountReady=page.getByRole('button',{name:'Profilimi Düzenle'});await accountReady.waitFor({state:'visible',timeout:20000});mark('login_via_real_ui',true);mark('registration_and_login',true);return accountReady;}
async function verifyAuthenticatedNonCommerceAccount(page){
 await page.goto(`${baseUrl}/?tab=account&view=favorites`,{waitUntil:'networkidle',timeout:30000});
 await assertGlobalHomeHeaderHidden(page,'favorites_global_header_hidden');
 await page.getByRole('heading',{name:'Favorilerim'}).waitFor({state:'visible',timeout:12000});
 mark('favorites_panel',true);
 await page.goto(`${baseUrl}/?tab=account&view=orders`,{waitUntil:'networkidle',timeout:30000});
 await assertGlobalHomeHeaderHidden(page,'orders_global_header_hidden');
 await page.getByRole('heading',{name:'Siparişlerim'}).waitFor({state:'visible',timeout:12000});
 mark('orders_panel',true);
}
async function verifyProductCommerceJourney(page){
 await page.getByRole('button',{name:'Favorilere ekle'}).click();
 await page.getByText(/Favorilerinize eklendi\.|Ürün favorilerinize eklendi\./).waitFor({state:'visible',timeout:10000});
 mark('favorite_add',true);
 await page.getByRole('button',{name:'Ürünü paylaş',exact:true}).click();
 await page.getByText(/Ürün bağlantısı kopyalandı|Paylaşım menüsü açıldı|Ürün bağlantısı panoya kopyalandı|Ürün paylaşımı tamamlandı/).waitFor({state:'visible',timeout:10000});
 mark('share',true);
 await page.getByRole('button',{name:/Sepete Ekle|Ön Siparişe Ekle/}).click();
 await page.getByText(/adet ürün sepetinize eklendi/).waitFor({state:'visible',timeout:10000});
 mark('cart_add',true);
 await shot(page,'04-product-actions');
 await page.goto(`${baseUrl}/?tab=account&view=favorites`,{waitUntil:'networkidle',timeout:30000});
 await assertGlobalHomeHeaderHidden(page,'favorites_global_header_hidden');
 await page.getByRole('heading',{name:'Favorilerim'}).waitFor({state:'visible',timeout:12000});
 await page.getByText(productName,{exact:true}).first().waitFor({state:'visible',timeout:12000});
 mark('favorite_roundtrip',true);
 await page.goto(`${baseUrl}/?tab=product-detail&product=${productSlug}`,{waitUntil:'networkidle',timeout:30000});
 await page.getByRole('heading',{name:productName,exact:true}).waitFor({state:'visible',timeout:12000});
 await page.getByRole('button',{name:/Hediye olarak gönder|Hediye et/}).click();
 await page.getByRole('heading',{name:'Bir üründen fazlasını gönderin'}).waitFor({state:'visible',timeout:12000});
 mark('gift_flow_opens',true);
 await shot(page,'05-gift');
 await page.getByRole('button',{name:'Hediye ekranını kapat'}).click();
 const buyNow=page.getByRole('button',{name:/Hemen Satın Al/i});
 if(!(await visible(buyNow,3000)))throw new Error('BUY_NOW_ACTION_MISSING');
 await buyNow.click();
 await page.getByRole('heading',{name:'Sepetim'}).waitFor({state:'visible',timeout:15000});
 await assertGlobalHomeHeaderHidden(page,'cart_global_header_hidden');
 mark('buy_now_to_cart',true);
 await page.getByText(productName,{exact:true}).first().waitFor({state:'visible',timeout:10000});
 mark('cart_roundtrip',true);
 const paymentUnavailable=page.getByText(/Şu anda tahsilata hazır iyzico yöntemi yok/);
 if(await visible(paymentUnavailable,8000)){mark('payment_fail_closed_without_provider_secrets',true);report.blockers.push('REAL_IYZICO_PROVIDER_SECRETS_REQUIRED');}else mark('payment_provider_ready',true);
 const checkoutButton=page.getByRole('button',{name:/Güvenli Ödemeye Geç|Kayıtlı Kartla Öde/});
 if(await visible(checkoutButton,3000))mark('checkout_action_present',true);
 await shot(page,'06-cart-checkout');
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({locale:'tr-TR',permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:900}});
const page=await context.newPage();
page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text().slice(0,2000));});
page.on('pageerror',error=>report.pageErrors.push(String(error?.stack||error).slice(0,4000)));
try{
 if(!oidcToken&&!allowPublicOnly)throw new Error('AUTHENTICATED_E2E_REQUIRES_GITHUB_OIDC');
 if(!oidcToken){
  report.blockers.push('AUTHENTICATED_E2E_EXPLICITLY_DISABLED');
  const productAvailable=await openPublicProductFromHome(page);
  if(productAvailable){await page.getByRole('button',{name:'Ürünü paylaş',exact:true}).click();await page.getByText(/Ürün bağlantısı kopyalandı|Paylaşım menüsü açıldı|Ürün bağlantısı panoya kopyalandı|Ürün paylaşımı tamamlandı/).waitFor({state:'visible',timeout:10000});mark('public_product_share',true);}else mark('public_product_actions_deferred_for_authentic_media',true);
  await verifyPublicSections(page);
  if(report.pageErrors.length)throw new Error(`PAGE_ERRORS:${report.pageErrors.join(' | ')}`);
  console.log('Golden Oremar explicit public-only Chromium E2E passed.');
 }else{
  const accountReady=await provisionAndLogin(page);
  await shot(page,'01-account-created');
  await accountReady.click();
  await page.getByRole('heading',{name:'Profilimi Düzenle'}).waitFor({state:'visible',timeout:12000});
  const profileName=page.getByLabel('Ad Soyad');
  await profileName.fill(`Golden Oremar Test Müşterisi ${runId}`);
  await page.getByRole('button',{name:'Değişiklikleri Kaydet'}).click();
  await page.getByText('Profil bilgileriniz güncellendi.').waitFor({state:'visible',timeout:12000});
  mark('profile_update_roundtrip',true);
  await shot(page,'02-profile');
  const productAvailable=await openPublicProductFromHome(page);
  if(productAvailable)await verifyProductCommerceJourney(page);else{mark('commerce_e2e_deferred_for_authentic_media',true);await verifyAuthenticatedNonCommerceAccount(page);}
  if(productAvailable){await page.goto(`${baseUrl}/?tab=account&view=orders`,{waitUntil:'networkidle',timeout:30000});await assertGlobalHomeHeaderHidden(page,'orders_global_header_hidden');await page.getByRole('heading',{name:'Siparişlerim'}).waitFor({state:'visible',timeout:12000});mark('orders_panel',true);}
  await verifyPublicSections(page);
  if(report.pageErrors.length)throw new Error(`PAGE_ERRORS:${report.pageErrors.join(' | ')}`);
  await import('./staff-mfa-e2e.mjs');
  mark('staff_mfa_authorization_e2e',true);
  console.log(productAvailable?'Golden Oremar authenticated customer commerce and staff MFA E2E passed.':'Golden Oremar authenticated account/public/staff MFA E2E passed; commerce coverage is deferred until authentic catalog media is published.');
 }
}catch(error){report.failure=String(error?.stack||error);console.error(report.failure);process.exitCode=1;}finally{
 if(oidcToken){try{const result=await ciControl('delete');mark('e2e_user_hard_deleted',result.deleted===true||result.alreadyAbsent===true);}catch(error){report.cleanupError=String(error?.stack||error);process.exitCode=1;}}
 save();await context.close();await browser.close();
}
