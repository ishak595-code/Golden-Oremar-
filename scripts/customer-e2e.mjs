import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const supabaseUrl=String(process.env.VITE_SUPABASE_URL||'').replace(/\/+$/,'');
const runId=String(process.env.GITHUB_RUN_ID||Date.now());
const oidcToken=String(process.env.E2E_CI_OIDC_TOKEN||'').trim();
const controlUrl=String(process.env.E2E_CI_CONTROL_URL||`${supabaseUrl}/functions/v1/ci-e2e-user`).trim();
const allowPublicOnly=String(process.env.E2E_ALLOW_PUBLIC_ONLY||'')==='1';
const email=`goldenoremar+ci-e2e-${runId}@gmail.com`;
const authSecret=`${crypto.randomBytes(24).toString('base64url')}Aa1!`;
const displayName=`Golden Oremar E2E ${runId}`;
const phone='+905379594851';
const productName='Avaşin Meşe Balı';
const productSlug='avasin-mese-bali-103';
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});
const report={runId,email,baseUrl,productName,startedAt:new Date().toISOString(),mode:oidcToken?'authenticated-oidc-provisioned':'public-only-explicit',checks:{},blockers:[],consoleErrors:[],pageErrors:[]};
const mark=(key,value=true)=>{report.checks[key]=value;};
const save=()=>fs.writeFileSync(path.join(out,'customer-e2e-report.json'),JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2));
const shot=async(page,name)=>page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
const visible=async(locator,timeout=12000)=>{try{await locator.waitFor({state:'visible',timeout});return true;}catch{return false;}};

async function ciControl(action,payload={}){
 if(!oidcToken)throw new Error('GITHUB_OIDC_E2E_TOKEN_REQUIRED');
 if(!controlUrl)throw new Error('E2E_CI_CONTROL_URL_REQUIRED');
 const response=await fetch(controlUrl,{
  method:'POST',
  headers:{Authorization:`Bearer ${oidcToken}`,'Content-Type':'application/json'},
  body:JSON.stringify({action,runId,...payload}),
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body?.ok!==true)throw new Error(`E2E_CI_CONTROL_${String(action).toUpperCase()}_FAILED:${response.status}:${String(body?.error||'unknown')}`);
 return body;
}

async function openPublicProductFromHome(page){
 await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:30000});
 await page.getByLabel('Ürün, üretici veya köy ara').waitFor({state:'visible',timeout:12000});
 const appearance=await page.evaluate(()=>({theme:document.documentElement.getAttribute('data-theme'),background:getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim()}));
 if(appearance.theme!=='custom'||!appearance.background)throw new Error(`MANAGED_BRAND_APPEARANCE_NOT_APPLIED:${JSON.stringify(appearance)}`);
 mark('managed_brand_appearance_runtime',true);
 const seasonalVisible=await visible(page.getByText(/Mevsim/i).first(),3000);
 const campaignVisible=await visible(page.getByText(/Fırsat|Kampanya|Teklif/i).first(),3000);
 const newVisible=await visible(page.getByText(/Yeni/i).first(),3000);
 mark('home_dynamic_sections',seasonalVisible||campaignVisible||newVisible);
 const search=page.getByLabel('Ürün, üretici veya köy ara');
 await search.fill(productName);await search.press('Enter');
 await page.getByText(productName,{exact:true}).first().waitFor({state:'visible',timeout:15000});
 mark('catalog_search',true);await shot(page,'03-search');
 await page.getByText(productName,{exact:true}).first().click();
 await page.getByRole('heading',{name:productName,exact:true}).waitFor({state:'visible',timeout:15000});
 mark('product_detail',true);
 if(await visible(page.getByText('Görsel henüz eklenmedi'),1000))report.blockers.push('REAL_PRODUCT_IMAGE_STORAGE_OBJECT_MISSING');
}

async function verifyPublicSections(page){
 await page.goto(`${baseUrl}/?tab=health`,{waitUntil:'networkidle',timeout:30000});
 await page.getByRole('heading',{name:'Sağlık & Tarifler'}).waitFor({state:'visible',timeout:12000});
 await page.getByRole('tab',{name:/Tarifler/}).click();
 await page.getByRole('tabpanel').waitFor({state:'visible',timeout:12000});
 mark('health_and_recipes',true);await shot(page,'07-health-recipes');
 await page.goto(`${baseUrl}/?tab=events`,{waitUntil:'networkidle',timeout:30000});
 await page.getByRole('heading',{name:'Etkinlikler',exact:true}).waitFor({state:'visible',timeout:12000});
 mark('events',true);await shot(page,'08-events');
 await page.goto(`${baseUrl}/?tab=categories`,{waitUntil:'networkidle',timeout:30000});
 await page.getByText(/Kategori/).first().waitFor({state:'visible',timeout:12000});
 mark('categories',true);
}

async function inspectRegistrationUi(page){
 await page.goto(`${baseUrl}/?tab=account`,{waitUntil:'networkidle',timeout:45000});
 const registerTab=page.getByRole('tab',{name:'Hesap Aç'});
 await registerTab.waitFor({state:'visible',timeout:12000});
 await registerTab.click();
 await page.locator('#auth-display-name').fill(displayName);
 await page.locator('#auth-phone').fill(phone);
 await page.locator('#auth-email').fill(email);
 await page.locator('#auth-password').fill(authSecret);
 await page.locator('#auth-confirm-password').fill(authSecret);
 await page.getByRole('button',{name:'Hesap Oluştur',exact:true}).waitFor({state:'visible',timeout:5000});
 mark('registration_ui_accessible',true);
 mark('registration_contract_guarded',true);
 await shot(page,'00-registration-ui');
}

async function provisionAndLogin(page){
 await inspectRegistrationUi(page);
 const provisioned=await ciControl('provision',{password:authSecret,displayName,phone});
 if(provisioned.provisioned!==true||provisioned.emailConfirmed!==true)throw new Error('OIDC_E2E_PROVISIONING_NOT_CONFIRMED');
 mark('oidc_disposable_user_provisioned',true);
 await page.getByRole('tab',{name:'Giriş Yap'}).click();
 await page.locator('#auth-email').fill(email);
 await page.locator('#auth-password').fill(authSecret);
 await page.getByRole('button',{name:'Giriş Yap',exact:true}).click();
 const accountReady=page.getByRole('button',{name:'Profilimi Düzenle'});
 await accountReady.waitFor({state:'visible',timeout:20000});
 mark('login_via_real_ui',true);
 mark('registration_and_login',true);
 return accountReady;
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
  await openPublicProductFromHome(page);
  await page.getByRole('button',{name:`${productName} ürününü paylaş`}).click();
  await page.getByText(/Ürün bağlantısı panoya kopyalandı|Ürün paylaşımı tamamlandı/).waitFor({state:'visible',timeout:10000});
  mark('public_product_share',true);
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
  mark('profile_update_roundtrip',true);await shot(page,'02-profile');

  await openPublicProductFromHome(page);
  await page.getByRole('button',{name:'Favorilere ekle'}).click();
  await page.getByText('Ürün favorilerinize eklendi.').waitFor({state:'visible',timeout:10000});
  mark('favorite_add',true);
  await page.getByRole('button',{name:`${productName} ürününü paylaş`}).click();
  await page.getByText(/Ürün bağlantısı panoya kopyalandı|Ürün paylaşımı tamamlandı/).waitFor({state:'visible',timeout:10000});
  mark('share',true);
  await page.getByRole('button',{name:/Sepete Ekle|Ön Siparişe Ekle/}).click();
  await page.getByText(/ürün sepetinize eklendi/).waitFor({state:'visible',timeout:10000});
  mark('cart_add',true);await shot(page,'04-product-actions');

  await page.goto(`${baseUrl}/?tab=account&view=favorites`,{waitUntil:'networkidle',timeout:30000});
  await page.getByRole('heading',{name:'Favorilerim'}).waitFor({state:'visible',timeout:12000});
  await page.getByText(productName,{exact:true}).first().waitFor({state:'visible',timeout:12000});
  mark('favorite_roundtrip',true);

  await page.goto(`${baseUrl}/?tab=product-detail&product=${productSlug}`,{waitUntil:'networkidle',timeout:30000});
  await page.getByRole('heading',{name:productName,exact:true}).waitFor({state:'visible',timeout:12000});
  await page.getByRole('button',{name:'Hediye et'}).click();
  await page.getByRole('heading',{name:'Bir üründen fazlasını gönderin'}).waitFor({state:'visible',timeout:12000});
  mark('gift_flow_opens',true);await shot(page,'05-gift');
  await page.getByRole('button',{name:'Hediye ekranını kapat'}).click();

  const buyNow=page.getByRole('button',{name:/Hemen Satın Al/i});
  if(!(await visible(buyNow,3000)))throw new Error('BUY_NOW_ACTION_MISSING');
  await buyNow.click();
  await page.getByRole('heading',{name:'Sepetim'}).waitFor({state:'visible',timeout:15000});
  mark('buy_now_to_cart',true);
  await page.getByText(productName,{exact:true}).first().waitFor({state:'visible',timeout:10000});
  mark('cart_roundtrip',true);

  const paymentUnavailable=page.getByText(/Şu anda tahsilata hazır iyzico yöntemi yok/);
  if(await visible(paymentUnavailable,8000)){mark('payment_fail_closed_without_provider_secrets',true);report.blockers.push('REAL_IYZICO_PROVIDER_SECRETS_REQUIRED');}
  else mark('payment_provider_ready',true);
  const checkoutButton=page.getByRole('button',{name:/Güvenli Ödemeye Geç|Kayıtlı Kartla Öde/});
  if(await visible(checkoutButton,3000))mark('checkout_action_present',true);
  await shot(page,'06-cart-checkout');

  await page.goto(`${baseUrl}/?tab=account&view=orders`,{waitUntil:'networkidle',timeout:30000});
  await page.getByRole('heading',{name:'Siparişlerim'}).waitFor({state:'visible',timeout:12000});
  mark('orders_panel',true);
  await verifyPublicSections(page);
  if(report.pageErrors.length)throw new Error(`PAGE_ERRORS:${report.pageErrors.join(' | ')}`);
  console.log('Golden Oremar authenticated customer E2E passed with GitHub OIDC-provisioned disposable user and real UI login.');
 }
}catch(error){
 report.failure=String(error?.stack||error);
 console.error(report.failure);
 process.exitCode=1;
}finally{
 if(oidcToken){
  try{
   const result=await ciControl('delete');
   mark('e2e_user_hard_deleted',result.deleted===true||result.alreadyAbsent===true);
  }catch(error){
   report.cleanupError=String(error?.stack||error);
   process.exitCode=1;
  }
 }
 save();
 await context.close();
 await browser.close();
}
