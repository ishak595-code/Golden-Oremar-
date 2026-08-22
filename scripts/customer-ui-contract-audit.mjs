import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){
  const full=path.join(root,relative);
  if(!fs.existsSync(full)){failures.push(`Missing customer UI contract file: ${relative}`);return'';}
  return fs.readFileSync(full,'utf8');
}
function expect(condition,message){if(!condition)failures.push(message);}

const app=read('src/App.tsx');
const main=read('src/main.tsx');
const routeState=read('src/features/navigation/customerShellRouteState.ts');
const shellCss=read('src/features/customer-experience/customerShellPolish.css');
const home=read('src/features/home/HomeSection.tsx');
const card=read('src/features/catalog/CatalogProductCard.tsx');
const detail=read('src/features/catalog/ProductDetailScreen.tsx');
const preferences=read('src/features/account/PremiumPreferencesPanel.tsx');

expect(main.includes("installCustomerShellRouteState();"),'Customer shell route-state tracker must be installed before render.');
expect(main.includes("customerShellPolish.css"),'Customer shell polish stylesheet must be loaded.');
expect(routeState.includes('dataset.appTab=currentTab()'),'Route-state tracker must expose the active tab to the document.');
expect(routeState.includes("patch('pushState')")&&routeState.includes("patch('replaceState')"),'Route-state tracker must react to in-app history navigation.');
expect(app.includes("{currentTab==='home'?<header"),'Global storefront header must be rendered only on Home in the React shell.');
expect(shellCss.includes(':root:not([data-app-tab="home"]) #root > .min-h-screen > header'),'CSS must retain defense-in-depth hiding for the global storefront header outside Home.');
expect(shellCss.includes('.customer-disclosure'),'Collapsed customer information styling must exist.');

for(const forbidden of ['HeroMetric','producerCount','originCount','label="Seçilmiş ürün"','label="Doğrulanmış üretici"','label="Üretim yöresi"']){
  expect(!home.includes(forbidden),`Home must not restore the metric-heavy hero marker: ${forbidden}`);
}
expect(home.includes('hide-scrollbar flex snap-x'),'Home should preserve compact horizontal discovery rows.');
expect(home.includes('<CatalogProductCard compact'),'Home catalog must use compact mobile product rows instead of oversized cards.');
expect(home.includes('useLiveHomeCatalog'),'Home must remain driven by the live catalog hook.');
expect(home.includes('usePublicStorefrontConfig'),'Home must remain driven by managed storefront content.');
expect(home.includes('heroCategories.map(config=>liveById.get(config.targetCategory))'),'Super Admin category ordering must remain authoritative on Home.');
expect(home.includes('homeSections.filter(section=>section.active)'),'Super Admin showcase ordering must remain authoritative on Home.');

expect(!card.includes('description?<p'),'Product cards must not reveal long descriptions by default.');
expect(!card.includes('quantity,setQuantity'),'Product cards must not restore the large inline quantity stepper.');
expect(card.includes("onAddToCart(product,1)"),'Compact product cards must use one-tap single-item add-to-cart.');
expect(card.includes('safeHandling'),'Product-card handling metadata must remain fail-safe.');
expect(card.includes('compact=false')&&card.includes('if(compact)return<article'),'Catalog cards must retain a dedicated compact mobile layout.');

for(const marker of ['aria-label="Geri"','Favorilere ekle','Ürünü paylaş','customer-disclosure','Ürün Hikâyesi','Gıda Güvenliği & Kullanım','Müşteri Yorumları']){
  expect(detail.includes(marker),`Product detail is missing customer navigation/disclosure marker: ${marker}`);
}
expect(detail.includes('<details className="customer-disclosure">'),'Long product information must remain collapsed by default.');

const disclosureCount=(preferences.match(/<details className="customer-disclosure">/g)||[]).length;
expect(disclosureCount>=2,'Theme and notification sounds must be separate collapsed preference sections.');
expect(preferences.includes('Tema')&&preferences.includes('Bildirim sesleri'),'Collapsed preferences must expose theme and sound summaries.');
for(const forbidden of ['sunucuya kaydedilemedi','Sunucuya kaydedilemedi','Supabase','veritabanı']){
  expect(!preferences.includes(forbidden),`Customer preference copy must not expose backend terminology: ${forbidden}`);
}

if(failures.length){
  console.error('Golden Oremar customer UI contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Golden Oremar customer UI contract audit passed: Home-only global header, compact dynamic storefront rows, simplified product cards, local product-detail navigation, collapsed long-form product information, and collapsed theme/sound preferences are locked in.');
