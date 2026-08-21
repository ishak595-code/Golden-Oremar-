import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const runId=String(process.env.GITHUB_RUN_ID||Date.now());
const email=`golden-oremar-e2e-${runId}@example.com`;
const password=`GoldenOremar-${runId}!`;
const productName='Avaşin Meşe Balı';
const productSlug='avasin-mese-bali-103';
const out=path.resolve('e2e-artifacts');
fs.mkdirSync(out,{recursive:true});
const report={runId,email,baseUrl,productName,startedAt:new Date().toISOString(),checks:{},blockers:[],consoleErrors:[],pageErrors:[]};
const mark=(key,value=true)=>{report.checks[key]=value;};
const save=()=>fs.writeFileSync(path.join(out,'customer-e2e-report.json'),JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2));
const shot=async(page,name)=>page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
const visible=async(locator,timeout=12000)=>{try{await locator.waitFor({state:'visible',timeout});return true;}catch{return false;}};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({locale:'tr-TR',permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:900}});
const page=await context.newPage();
page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text().slice(0,2000));});
page.on('pageerror',error=>report.pageErrors.push(String(error?.stack||error).slice(0,4000)));

try{
 await page.goto(`${baseUrl}/?tab=account`,{waitUntil:'networkidle',timeout:45000});
 await page.getByRole('button',{name:'Hesap Aç'}).click();
 await page.locator('#auth-display-name').fill(`Golden Oremar E2E ${runId}`);
 await page.locator('#auth-phone').fill('+905379594851');
 await page.locator('#auth-email').fill(email);
 await page.locator('#auth-password').fill(password);
 await page.locator('#auth-confirm-password').fill(password);
 await page.getByRole('button',{name:'Hesap Oluştur'}).click();
 const accountReady=page.getByRole('button',{name:'Profilimi Düzenle'});
 const needsConfirmation=page.getByText(/E-posta doğrulaması açıksa/i);
 await Promise.race([accountReady.waitFor({state:'visible',timeout:20000}),needsConfirmation.waitFor({state:'visible',timeout:20000})]).catch(()=>{});
 if(await visible(needsConfirmation,500)){mark('registration_form',true);report.blockers.push('EMAIL_CONFIRMATION_REQUIRED');await shot(page,'01-email-confirmation-required');save();throw new Error(`EMAIL_CONFIRMATION_REQUIRED:${email}`);}
 if(!(await visible(accountReady,3000)))throw new Error('ACCOUNT_CENTER_NOT_REACHED_AFTER_SIGNUP');
 mark('registration_and_login',true);await shot(page,'01-account-created');

 await accountReady.click();
 await page.getByRole('heading',{name:'Profilimi Düzenle'}).waitFor({state:'visible',timeout:12000});
 const profileName=page.getByLabel('Ad Soyad');
 await profileName.fill(`Golden Oremar Test Müşterisi ${runId}`);
 await page.getByRole('button',{name:'Değişiklikleri Kaydet'}).click();
 await page.getByText('Profil bilgileriniz güncellendi.').waitFor({state:'visible',timeout:12000});
 mark('profile_update_roundtrip',true);await shot(page,'02-profile');

 await page.goto(`${baseUrl}/?tab=home`,{waitUntil:'networkidle',timeout:30000});
 await page.getByLabel('Ürün, üretici veya köy ara').waitFor({state:'visible',timeout:12000});
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

 await page.goto(`${baseUrl}/?tab=health`,{waitUntil:'networkidle',timeout:30000});
 await page.getByRole('heading',{name:'Sağlık & Tarifler'}).waitFor({state:'visible',timeout:12000});
 await page.getByRole('tab',{name:/Tarifler/}).click();
 await page.getByRole('tabpanel').waitFor({state:'visible',timeout:12000});
 mark('health_and_recipes',true);await shot(page,'07-health-recipes');

 await page.goto(`${baseUrl}/?tab=events`,{waitUntil:'networkidle',timeout:30000});
 await page.getByRole('heading',{name:'Etkinlikler'}).waitFor({state:'visible',timeout:12000});
 mark('events',true);await shot(page,'08-events');

 await page.goto(`${baseUrl}/?tab=categories`,{waitUntil:'networkidle',timeout:30000});
 await page.getByText(/Kategori/).first().waitFor({state:'visible',timeout:12000});
 mark('categories',true);

 if(report.pageErrors.length)throw new Error(`PAGE_ERRORS:${report.pageErrors.join(' | ')}`);
 save();
 console.log(`CUSTOMER_E2E_EMAIL=${email}`);
 console.log('Golden Oremar customer E2E passed with external-provider blockers reported separately.');
} catch(error){
 report.failure=String(error?.stack||error);save();
 console.error(`CUSTOMER_E2E_EMAIL=${email}`);
 console.error(report.failure);
 process.exitCode=1;
} finally { await context.close();await browser.close(); }
