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
const densityCss=read('src/features/customer-experience/marketplaceDensity.css');
const referenceCss=read('src/features/customer-experience/referenceHomeExact.css');
const dockCss=read('src/features/customer-experience/productDetailCommerceDock.css');
const compatibilityCss=read('src/features/customer-experience/premiumCompatibility.css');
const home=read('src/features/home/HomeSection.tsx');
const card=read('src/features/catalog/CatalogProductCard.tsx');
const detail=read('src/features/catalog/ProductDetailScreen.tsx');
const recommendations=read('src/features/catalog/ProductRecommendationsRail.tsx');
const preferences=read('src/features/account/PremiumPreferencesPanel.tsx');
const settings=read('src/features/account/SettingsPanel.tsx');
const sounds=read('src/features/notifications/premiumSounds.ts');

expect(main.includes('installCustomerShellRouteState();'),'Customer shell route-state tracker must be installed before render.');
expect(main.includes('customerShellPolish.css'),'Customer shell polish stylesheet must be loaded.');
expect(main.includes('videoReferencePremium.css'),'Video-reference premium customer stylesheet must be loaded.');
expect(main.includes('marketplaceDensity.css'),'Responsive marketplace-density stylesheet must be loaded.');
expect(main.includes('referenceHomeExact.css'),'Approved dark marketplace reference stylesheet must be loaded.');
expect(main.includes('productDetailCommerceDock.css'),'Product-detail purchase dock stylesheet must be loaded.');
expect(main.includes('premiumCompatibility.css'),'Premium iOS/WebView compatibility fallback must be loaded.');
expect(main.includes('<ProductRecommendationsRail />'),'Live product recommendations must be mounted after the app shell.');
expect(routeState.includes('const tab=currentTab();')&&routeState.includes('dataset.appTab=tab'),'Route-state tracker must expose the active tab to the document.');
expect(routeState.includes("patch('pushState')")&&routeState.includes("patch('replaceState')"),'Route-state tracker must react to in-app history navigation.');
expect(app.includes("{currentTab==='home'?<header"),'Global storefront header must be rendered only on Home in the React shell.');
expect(shellCss.includes(':root:not([data-app-tab="home"]) #root > .min-h-screen > header'),'CSS must retain defense-in-depth hiding for the global storefront header outside Home.');
expect(shellCss.includes('.customer-disclosure'),'Collapsed long-form customer information styling must exist.');
expect(premiumCss.includes('input[aria-label="Ürün, üretici veya köy ara"] ~ button[aria-label="Sesli arama"]'),'Voice search must stay compact until the search control is active.');
expect(premiumCss.includes('.go-product-card__media'),'Premium product-card visual contract must exist.');
expect(densityCss.includes('.go-product-card--compact')&&densityCss.includes('@media(max-width:360px)'),'Compact card variant must remain available for screens that intentionally use it.');
expect(referenceCss.includes('.go-reference-category-card')&&referenceCss.includes('.go-reference-product-rail'),'Approved category and large product rail presentation must exist.');
expect(dockCss.includes(':root[data-app-tab="product-detail"] nav[aria-label="Ana gezinme"]'),'Product detail must replace the global bottom tab bar.');
expect(dockCss.includes('position: fixed')&&dockCss.includes('safe-area-inset-bottom'),'Product detail purchase actions must remain fixed and native safe-area aware.');
expect(compatibilityCss.includes('@supports not (color: color-mix'),'Premium surfaces must retain an older WebView/iOS 15 fallback.');

for(const forbidden of ['HeroMetric','producerCount','originCount','label="Seçilmiş ürün"','label="Doğrulanmış üretici"','label="Üretim yöresi"'])expect(!home.includes(forbidden),`Home must not restore the metric-heavy hero marker: ${forbidden}`);
expect(home.includes('data-video-reference-home="true"'),'Home must retain the approved video-reference storefront marker.');
expect(home.includes('data-reference-layout="approved-dark-marketplace"'),'Home must retain the exact approved dark marketplace layout marker.');
expect(home.includes('go-reference-product-rail'),'Managed home collections must use the approved large visual product rails.');
expect(!home.includes('<CatalogProductCard compact'),'Primary Home collections must not regress to compact row cards.');
expect(home.includes('go-reference-category-card'),'Managed categories must retain the approved wide visual discovery cards.');
expect(home.includes('categoryPreviewImages')&&home.includes('products.filter(product=>product.categorySlug===category.id'),'Category preview imagery must be derived from the live catalog.');
expect(home.includes('useLiveHomeCatalog'),'Home must remain driven by the live catalog hook.');
expect(home.includes('usePublicStorefrontConfig'),'Home must remain driven by managed storefront content.');
expect(home.includes('heroCategories.map(config=>liveById.get(config.targetCategory))'),'Super Admin category ordering must remain authoritative on Home.');
expect(home.includes('homeSections.filter(section=>section.active)'),'Super Admin showcase ordering must remain authoritative on Home.');
expect(home.includes('filteredProducts.length} ürün listeleniyor'),'Home must expose the live filtered product count.');
expect(home.indexOf('go-reference-category-section')<home.indexOf('go-reference-campaign'),'Category discovery must be rendered before the optional live-offer campaign surface.');
expect(home.includes("const offerProducts=sectionProducts('offers')")&&home.includes('offerProducts.length>0'),'Campaign surface must be gated by real live offer products.');
expect(home.includes("eventSpotlight?.enabled")&&home.includes('eventSpotlight.placement===placement'),'Event spotlight must stay dynamic and placement-managed.');
expect(referenceCss.includes('width: min(29rem,78vw)')&&referenceCss.includes('width: min(32rem,79vw)'),'Approved mobile rails must keep a partially visible next card for discoverability.');
expect(referenceCss.includes('header button[aria-label^="Bildirimler"]')&&referenceCss.includes('display: none !important'),'Home header must remain logo, search and cart focused.');
expect(referenceCss.includes('background: rgb(19 37 30 / .97)'),'Home bottom navigation must retain the dark floating reference surface.');

expect(!card.includes('description?<p'),'Product cards must not reveal long descriptions by default.');
expect(!card.includes('quantity,setQuantity'),'Product cards must not restore the large inline quantity stepper.');
expect(card.includes('onAddToCart(product,1)'),'Product cards must use one-tap single-item add-to-cart.');
expect(card.includes('safeHandling'),'Product-card handling metadata must remain fail-safe.');
expect(card.includes('compact=false')&&card.includes('if(compact)return<article'),'Catalog cards must retain a compact variant for non-Home contexts.');
expect(card.includes('coldChain')&&card.includes('Soğuk'),'Cold-chain products must retain truthful handling visibility.');
expect(card.includes('seasonal')&&card.includes('Mevsimlik'),'Seasonal stock mode must remain visibly distinct.');
expect(card.includes("preorder?'Hemen Ön Sipariş Ver':'Sepete Ekle'"),'Preorder cards must use the correct purchase language.');
expect(card.includes('originalPrice')&&card.includes('Önce '),'Real compare-at pricing may be shown without fabricated discount percentages.');
expect(!card.includes('line-through'),'Compare-at price must not use aggressive struck-through discount framing.');
expect(card.includes('text-brand-on-green')&&card.includes('text-brand-on-gold'),'Accent actions and badges must retain semantic theme foreground tokens.');

for(const marker of ['aria-label="Geri"','Favorilere ekle','Ürünü paylaş','customer-disclosure','Ürün Hikâyesi','Gıda Güvenliği & Kullanım','Müşteri Yorumları'])expect(detail.includes(marker),`Product detail is missing customer navigation/disclosure marker: ${marker}`);
expect(detail.includes('<details className="customer-disclosure">'),'Long product information must remain collapsed by default.');
expect(recommendations.includes('useLiveHomeCatalog'),'Product recommendations must come from the live catalog.');
expect(recommendations.includes('item.categorySlug===current.categorySlug'),'Product recommendations must prioritize the current live category.');
expect(recommendations.includes('item.id!==current.id'),'Product recommendations must exclude the product already being viewed.');
expect(!recommendations.includes('const products=['),'Product recommendations must never become a hard-coded business list.');

for(const marker of ["'theme','Tema'","'sound','Bildirim Sesi'","'notifications','Bildirim Tercihleri'","'password','Şifre Değiştir'","'newsletter','E-bülten'","'sessions','Oturum ve Güvenlik'","'closure','Hesap Kapatma'"])expect(settings.includes(marker),`Settings menu is missing dedicated destination: ${marker}`);
expect(settings.includes("if(view==='menu')"),'Settings must open as a clean menu rather than one long form.');
expect(settings.includes("mode=\"theme\"")&&settings.includes("mode=\"sound\""),'Theme and notification sound must open as dedicated settings screens.');
expect(settings.includes("setView('menu')"),'Successful settings operations must be able to return to the settings list.');
expect(!settings.includes("runSession('current')"),'Current-device logout must not be duplicated inside Settings.');
expect(preferences.includes("mode?:PreferenceMode")&&preferences.includes('onSaved?:()=>void'),'Premium preferences must support focused settings screens and save-return behavior.');
for(const forbidden of ['sunucuya kaydedilemedi','Sunucuya kaydedilemedi','Supabase','veritabanı'])expect(!preferences.includes(forbidden),`Customer preference copy must not expose backend terminology: ${forbidden}`);
for(const forbidden of ['Şafak Horozu','Keklik Çağrısı','Dağ Kuşları'])expect(!sounds.includes(forbidden),`Premium sonic identity must not use novelty animal-imitation copy: ${forbidden}`);
for(const marker of ['Oremar Kristali','Dağ Esintisi','Şafak İmzası','Zümrüt Yankı','Şampanya Çanı'])expect(sounds.includes(marker),`Premium sonic identity is missing refined option: ${marker}`);

if(failures.length){console.error('Golden Oremar customer UI contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar customer UI contract audit passed: Home-only header, approved dark wide category discovery, live DB-managed large visual product rails, real-offer campaign gating, truthful dynamic product states, native-safe detail commerce, focused account settings and refined premium notification sounds are locked in.');
