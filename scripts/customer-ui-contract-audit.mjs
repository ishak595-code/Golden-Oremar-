import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Missing customer UI contract file: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function expect(condition,message){if(!condition)failures.push(message);}

const app=read('src/App.tsx');
const main=read('src/main.tsx');
const routeState=read('src/features/navigation/customerShellRouteState.ts');
const shellCss=read('src/features/customer-experience/customerShellPolish.css');
const premiumCss=read('src/features/customer-experience/videoReferencePremium.css');
const home=read('src/features/home/HomeSection.tsx');
const card=read('src/features/catalog/CatalogProductCard.tsx');
const detail=read('src/features/catalog/ProductDetailScreen.tsx');
const recommendations=read('src/features/catalog/ProductRecommendationsRail.tsx');
const preferences=read('src/features/account/PremiumPreferencesPanel.tsx');

expect(main.includes("installCustomerShellRouteState();"),'Customer shell route-state tracker must be installed before render.');
expect(main.includes("customerShellPolish.css"),'Customer shell polish stylesheet must be loaded.');
expect(main.includes("videoReferencePremium.css"),'Video-reference premium customer stylesheet must be loaded.');
expect(main.includes('<ProductRecommendationsRail />'),'Live product recommendations must be mounted after the app shell.');
expect(routeState.includes('const tab=currentTab();')&&routeState.includes('dataset.appTab=tab'),'Route-state tracker must expose the active tab to the document.');
expect(routeState.includes("patch('pushState')")&&routeState.includes("patch('replaceState')"),'Route-state tracker must react to in-app history navigation.');
expect(app.includes("{currentTab==='home'?<header"),'Global storefront header must be rendered only on Home in the React shell.');
expect(shellCss.includes(':root:not([data-app-tab="home"]) #root > .min-h-screen > header'),'CSS must retain defense-in-depth hiding for the global storefront header outside Home.');
expect(shellCss.includes('.customer-disclosure'),'Collapsed customer information styling must exist.');
expect(premiumCss.includes('input[aria-label="Ürün, üretici veya köy ara"] ~ button[aria-label="Sesli arama"]'),'Voice search must stay compact until the search control is active.');
expect(premiumCss.includes('.go-product-card__media')&&premiumCss.includes('.go-premium-category-card'),'Premium card and managed category visual contracts must exist.');

for(const forbidden of ['HeroMetric','producerCount','originCount','label="Seçilmiş ürün"','label="Doğrulanmış üretici"','label="Üretim yöresi"'])expect(!home.includes(forbidden),`Home must not restore the metric-heavy hero marker: ${forbidden}`);
expect(home.includes('data-video-reference-home="true"'),'Home must retain the approved video-reference storefront marker.');
expect(home.includes('go-premium-product-rail'),'Managed home collections must retain immersive horizontal product rails.');
expect(home.includes('go-premium-category-card'),'Managed categories must retain visual discovery cards.');
expect(home.includes('useLiveHomeCatalog'),'Home must remain driven by the live catalog hook.');
expect(home.includes('usePublicStorefrontConfig'),'Home must remain driven by managed storefront content.');
expect(home.includes('heroCategories.map(config=>liveById.get(config.targetCategory))'),'Super Admin category ordering must remain authoritative on Home.');
expect(home.includes('homeSections.filter(section=>section.active)'),'Super Admin showcase ordering must remain authoritative on Home.');
expect(home.includes('filteredProducts.length} ürün listeleniyor'),'Home must expose the live filtered product count.');
expect(!home.includes('<CatalogProductCard compact key={product.id}'),'Primary Home collections must not regress to cramped horizontal list cards.');

expect(!card.includes('description?<p'),'Product cards must not reveal long descriptions by default.');
expect(!card.includes('quantity,setQuantity'),'Product cards must not restore the large inline quantity stepper.');
expect(card.includes("onAddToCart(product,1)"),'Product cards must use one-tap single-item add-to-cart.');
expect(card.includes('safeHandling'),'Product-card handling metadata must remain fail-safe.');
expect(card.includes('compact=false')&&card.includes('if(compact)return<article'),'Catalog cards must retain a compact variant for secondary surfaces.');
expect(card.includes('coldChain')&&card.includes('Soğuk Zincir'),'Cold-chain products must retain truthful handling visibility.');
expect(card.includes('seasonal')&&card.includes('Mevsimlik Üretim'),'Seasonal stock mode must remain visibly distinct.');
expect(card.includes("preorder?'Hemen Ön Sipariş Ver':'Sepete Ekle'"),'Preorder cards must use the correct purchase language.');
expect(card.includes('originalPrice')&&card.includes('Önce '),'Real compare-at pricing may be shown without fabricated discount percentages.');

for(const marker of ['aria-label="Geri"','Favorilere ekle','Ürünü paylaş','customer-disclosure','Ürün Hikâyesi','Gıda Güvenliği & Kullanım','Müşteri Yorumları'])expect(detail.includes(marker),`Product detail is missing customer navigation/disclosure marker: ${marker}`);
expect(detail.includes('<details className="customer-disclosure">'),'Long product information must remain collapsed by default.');
expect(recommendations.includes('useLiveHomeCatalog'),'Product recommendations must come from the live catalog.');
expect(recommendations.includes("item.categorySlug===current.categorySlug"),'Product recommendations must prioritize the current live category.');
expect(recommendations.includes("item.id!==current.id"),'Product recommendations must exclude the product already being viewed.');
expect(!recommendations.includes('const products=['),'Product recommendations must never become a hard-coded business list.');

const disclosureCount=(preferences.match(/<details className="customer-disclosure">/g)||[]).length;
expect(disclosureCount>=2,'Theme and notification sounds must be separate collapsed preference sections.');
expect(preferences.includes('Tema')&&preferences.includes('Bildirim sesleri'),'Collapsed preferences must expose theme and sound summaries.');
for(const forbidden of ['sunucuya kaydedilemedi','Sunucuya kaydedilemedi','Supabase','veritabanı'])expect(!preferences.includes(forbidden),`Customer preference copy must not expose backend terminology: ${forbidden}`);

if(failures.length){console.error('Golden Oremar customer UI contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar customer UI contract audit passed: Home-only global header, compact-on-focus voice search, managed visual category rails, premium live product cards, truthful cold-chain/preorder states, local product-detail navigation, live recommendations, collapsed long-form product information and collapsed theme/sound preferences are locked in.');
