import fs from'node:fs';
import path from'node:path';

const root=process.cwd();
const failures=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const requireMatch=(condition,message)=>{if(!condition)failures.push(message);};
const forbid=(source,needle,message)=>requireMatch(!source.includes(needle),message);

const detail=read('src/features/catalog/ProductDetailScreen.tsx');
const category=read('src/features/catalog/CategoryDirectoryScreen.tsx');
const searchResults=read('src/features/catalog/CatalogSearchResults.tsx');
const searchInput=read('src/features/catalog/CatalogSearchInput.tsx');
const favorites=read('src/features/account/FavoritesPanel.tsx');
const cart=read('src/features/cart/CartCheckoutFlow.tsx');
const payments=read('src/features/account/PaymentsPanel.tsx');
const home=read('src/features/home/HomeSection.tsx');
const homeProductCard=read('src/features/home/components/ProductCard.tsx');
const homePrice=read('src/features/home/components/PriceDisplay.tsx');
const premiumCss=read('src/features/customer-experience/premiumMobileV2.css');
const productDockCss=read('src/features/customer-experience/productDetailCommerceDock.css');
const customerE2e=read('scripts/customer-e2e.mjs');
const accessibilityE2e=read('scripts/product-card-accessibility-e2e.mjs');

const titleIndex=detail.indexOf('<h1');
const priceIndex=detail.indexOf('priceReady?',titleIndex);
const shortDescriptionIndex=detail.indexOf('detail.shortDescription',titleIndex);
const variantIndex=detail.indexOf('Paket / seçenek',titleIndex);
const producerIndex=detail.indexOf('detail?.producer',Math.max(0,variantIndex));
requireMatch(titleIndex>=0&&priceIndex>titleIndex,'Product detail title/price hierarchy is missing.');
requireMatch(shortDescriptionIndex<0||priceIndex<shortDescriptionIndex,'Product detail price must remain above short description.');
requireMatch(variantIndex>priceIndex,'Optional multi-variant selection must remain after the primary price block.');
requireMatch(producerIndex<0||variantIndex<producerIndex,'Optional multi-variant selection must remain before secondary producer content.');
requireMatch(detail.includes('detail.variants.length>1')&&detail.includes('<select value={variantId}'),'Single-variant products must not render a redundant option selector; multi-variant products need one compact select.');
forbid(detail,'<fieldset className="mt-5"','Product detail must not return to radio-style option marking.');
forbid(detail,'const itemPrice=','Product detail variant selector must not repeat the primary price.');
requireMatch(detail.includes('aria-label="Miktarı azalt"')&&detail.includes('aria-label="Miktarı artır"'),'Product detail quantity decrease/increase controls must remain available.');
requireMatch(detail.includes('product-detail-commerce-dock'),'State-aware product commerce dock is missing.');
forbid(detail,'product-detail-commerce-summary','Product detail purchase dock must not repeat price or quantity summary above fixed actions.');
requireMatch(detail.includes("setStatus('Sepete eklendi.')")&&detail.includes('Sepete Git'),'Compact add-to-cart success action is missing.');
requireMatch(detail.includes('kategorisini aç')&&detail.includes('buildSearchUrl'),'Product detail category must remain a real navigable customer link.');
requireMatch(detail.includes("if(currency==='TRY')return`${amount} TL`"),'Product detail TRY prices must use customer-facing TL notation.');
requireMatch(detail.includes('compareAtPriceReady')&&detail.includes('Önce {money(compareAtPriceMinor,currency)}'),'Product detail must surface a real compare price when it exists.');
forbid(detail,'line-clamp-3','Product detail short copy must not return to artificial three-line truncation.');
requireMatch(productDockCss.includes('minmax(0,.82fr) minmax(0,1fr) minmax(0,1.16fr)'),'Product detail purchase dock must preserve the three-action Gift / Cart / Buy hierarchy.');
const giftIndex=detail.indexOf('product-detail-commerce-gift');
const cartIndex=detail.indexOf('product-detail-commerce-cart');
const buyIndex=detail.indexOf('product-detail-commerce-buy');
requireMatch(giftIndex>=0&&cartIndex>giftIndex&&buyIndex>cartIndex,'Product detail fixed actions must remain ordered Hediye Et, Sepete Ekle, Hemen Satın Al.');
requireMatch(detail.includes('<span>Hediye Et</span>')&&detail.includes("preorder?'Ön Sipariş':'Sepete Ekle'")&&detail.includes('<span>Hemen Satın Al</span>'),'Product detail fixed action labels are incomplete.');

forbid(home,'salesReadiness.message','Home storefront must not expose internal sales-readiness explanations.');
forbid(home,'salesBlocked','Home storefront must not render an internal checkout-readiness banner.');
requireMatch(homeProductCard.includes('<a href={buildProductUrl(item.slug)}')&&homeProductCard.includes('aria-labelledby={spokenId}')&&homeProductCard.includes('className="sr-only">{accessibleLabel}</span>'),'Home product rows must be real links with one deterministic full spoken label.');
requireMatch(homeProductCard.includes('data-product-id={item.id}')&&homeProductCard.includes('data-product-reference={item.slug}'),'Every Home product row must expose stable internal identity/reference markers.');
requireMatch(homeProductCard.includes("!item.imagePath.startsWith('brand/official-store/')"),'Official-store brand imagery must not masquerade as a product photo in Home rows.');
requireMatch(homeProductCard.includes('compareAtPrice:compareMinor!==null?compareMinor/100:null')&&!/<PriceDisplay[^>]*compareAtPrice/.test(homeProductCard),'Home product cards must keep real compare pricing in the spoken contract without adding promotional compare pricing to the visible discovery card.');
requireMatch(homePrice.includes("normalized==='TRY'")&&homePrice.includes('TL`'),'Home TRY prices must use TL notation.');
requireMatch(accessibilityE2e.includes("role:'link'")&&accessibilityE2e.includes('ARIA_NAME_MISSING_COMPARE_PRICE'),'Runtime accessibility must resolve Home as a link and preserve the compare-price spoken contract.');
requireMatch(searchInput.includes('aria-label="Ürün, üretici veya köy ara"')&&!searchInput.includes('role="search"'),'Search must expose one searchbox name without duplicate landmark narration.');
requireMatch(searchInput.includes("aria-label={listening?'Sesli arama dinleniyor':'Sesli mikrofon'}")&&searchInput.includes('aria-pressed={listening}')&&searchInput.includes('role="status" aria-live="polite"')&&searchInput.includes('Mic')&&!searchInput.includes('MicOff')&&!searchInput.includes('Mikrofon kapalı'),'Voice search must expose idle Sesli mikrofon, active listening state, and no artificial off copy.');

for(const [needle,message] of [
 ['sunucudan doğrulanamadı','Category screen must not expose server-validation wording.'],
 ['Kategori ürün toplamı doğrulanamadı','Category screen must not expose catalog validation internals.'],
 ['{loadMoreError}</p>','Category load-more alert must not print raw technical errors.'],
])forbid(category,needle,message);
requireMatch(category.includes('mt-7 grid gap-5')&&category.includes('sm:gap-6'),'Category product grid breathing-room contract is missing.');

forbid(searchResults,'setError(err?.message','Search results must not pass raw validation/API errors to customers.');
forbid(searchResults,"count==null?'Sonuçlar doğrulanamadı'",'Search filter sheet must not expose validation terminology.');
requireMatch(searchResults.includes("setError('Arama sonuçları şu anda gösterilemiyor. Lütfen yeniden deneyin.')"),'Search results need a stable customer-safe failure message.');
requireMatch(searchResults.includes("count==null?'Sonuç sayısı alınamadı'"),'Search filter unavailable state must remain customer-readable.');

for(const [needle,message] of [
 ['mağaza kimliği','Favorites copy must not expose store-identity implementation wording.'],
 ['dinamik gösterilir','Favorites copy must not describe implementation behavior.'],
 ['Aktif satış varyantı bulunmuyor','Favorites copy must not expose variant-system terminology.'],
 ['>Çıkar</button>','Favorites action must not regress to terse ambiguous wording.'],
])forbid(favorites,needle,message);
requireMatch(favorites.includes('Favoriden çıkar'),'Favorites action should remain explicit.');
requireMatch(favorites.includes('grid gap-5 sm:grid-cols-2 sm:gap-6'),'Favorites spacing contract is missing.');

for(const [needle,message] of [
 ['Checkout şu anda tamamlanamıyor','Checkout must not expose English implementation terminology.'],
 ['Checkout hesap bilgileri doğrulanamadı','Checkout must not expose internal validation wording.'],
 ['Super Admin ödeme altyapısını','Checkout must not expose administrator/infrastructure wording.'],
 ['iki harfli ISO kodu','Checkout must not require standards jargon from customers.'],
 ['komisyon, kargo ve ödeme sunucuda doğrulanır','Checkout trust copy must not narrate backend implementation.'],
])forbid(cart,needle,message);
requireMatch(cart.includes('space-y-6')&&cart.includes('sm:p-6'),'Checkout density reduction contract is missing.');
requireMatch(cart.includes('Aynı ödeme işlemi ikinci kez tahsil edilmez.'),'Checkout duplicate-charge safety copy must remain customer-readable.');
for(const needle of['metadata','veritabanı','Super Admin','iki harfli ISO'])forbid(payments,needle,`Payments customer copy must not expose technical wording: ${needle}.`);

requireMatch(premiumCss.includes('.go-home-content{width:min(100%,1280px);margin:0 auto;padding:var(--go-space-5) var(--go-mobile-pad) var(--go-space-9);}'),'Home content needs the calmer premium outer rhythm.');
requireMatch(premiumCss.includes('.go-home-section{margin-top:var(--go-space-8);}'),'Home sections need the calmer 40px vertical rhythm.');
requireMatch(premiumCss.includes('.go-product-grid-v2{display:grid;width:100%;max-width:860px;grid-template-columns:1fr;gap:0'),'Home products must remain one product per full-width list row.');
requireMatch(!premiumCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))')&&!premiumCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'Home products must not regress into multi-column card grids.');
requireMatch(premiumCss.includes('min-height:116px')&&premiumCss.includes('padding:var(--go-space-3) 0;text-align:left'),'Home product rows need compact but touch-safe list spacing.');
requireMatch(premiumCss.includes('.go-category-card{display:flex;width:100%;min-height:172px')&&premiumCss.includes('.go-category-card__copy{')&&premiumCss.includes('padding:var(--go-space-4);'),'Home category cards need the expanded premium spacing contract.');
requireMatch(premiumCss.includes('font:500 14px/1.65 var(--font-sans)'),'Home section support copy needs relaxed readable line height.');

function hexToken(source,name){const match=source.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6})`));return match?.[1]?.toUpperCase()||'';}
function channel(value){const normalized=value/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4;}
function luminance(hex){const value=hex.replace('#','');const r=channel(parseInt(value.slice(0,2),16)),g=channel(parseInt(value.slice(2,4),16)),b=channel(parseInt(value.slice(4,6),16));return.2126*r+.7152*g+.0722*b;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const homePalette={background:hexToken(premiumCss,'go-forest-950'),card:hexToken(premiumCss,'go-forest-850'),text:hexToken(premiumCss,'go-ivory'),muted:hexToken(premiumCss,'go-muted'),muted2:hexToken(premiumCss,'go-muted-2'),gold:hexToken(premiumCss,'go-gold'),goldStrong:hexToken(premiumCss,'go-gold-strong')};
for(const [name,value]of Object.entries(homePalette))requireMatch(/^#[0-9A-F]{6}$/.test(value),`Premium Home palette token is invalid: ${name}.`);
if(Object.values(homePalette).every(Boolean)){
 requireMatch(contrast(homePalette.text,homePalette.background)>=4.5,'Premium Home primary text contrast is below WCAG AA.');
 requireMatch(contrast(homePalette.muted,homePalette.background)>=4.5,'Premium Home muted text contrast is below WCAG AA.');
 requireMatch(contrast(homePalette.muted2,homePalette.background)>=4.5,'Premium Home secondary text contrast is below WCAG AA.');
 requireMatch(contrast(homePalette.gold,homePalette.background)>=4.5,'Premium Home gold accent contrast is below WCAG AA.');
 requireMatch(contrast(homePalette.goldStrong,homePalette.background)>=4.5,'Premium Home strong gold accent contrast is below WCAG AA.');
 requireMatch(contrast(homePalette.text,homePalette.card)>=4.5,'Premium Home card text contrast is below WCAG AA.');
 requireMatch(contrast(homePalette.muted,homePalette.card)>=4.5,'Premium Home card muted contrast is below WCAG AA.');
}

const customerRoots=[
 'src/App.tsx','src/ErrorBoundary.tsx','src/pages',
 'src/features/account','src/features/addresses','src/features/app-update','src/features/appearance','src/features/auth',
 'src/features/cart','src/features/catalog','src/features/content','src/features/engagement','src/features/events',
 'src/features/gifts','src/features/health','src/features/home','src/features/navigation','src/features/payments',
 'src/features/resilience','src/features/reviews','src/features/search','src/features/support',
];
const nonCustomerSurfaces=new Set([
 'src/features/account/SellerPanel.tsx',
 'src/features/account/ProducerProfilePanel.tsx',
 'src/features/auth/StaffMfaGate.tsx',
 'src/features/content/ProductHealthEditorForm.tsx',
]);
function collectTsx(target){
 const absolute=path.join(root,target);
 if(!fs.existsSync(absolute))return[];
 const stat=fs.statSync(absolute);
 if(stat.isFile())return target.endsWith('.tsx')?[target]:[];
 return fs.readdirSync(absolute,{withFileTypes:true}).flatMap(entry=>collectTsx(path.join(target,entry.name)));
}
function stripComments(source){return source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');}
function textLiterals(source){
 const clean=stripComments(source),values=[];
 for(const pattern of[/'((?:\\.|[^'\\])*)'/gs,/"((?:\\.|[^"\\])*)"/gs,/`((?:\\.|[^`\\])*)`/gs])for(const match of clean.matchAll(pattern))values.push(match[1]);
 return values.join('\n');
}
const technicalCopyPatterns=[
 [/\bbackend\b/iu,'backend'],
 [/veritaban/iu,'veritabanı'],
 [/sunucudan\s+doğrulan/iu,'sunucudan doğrulama'],
 [/sunucu\s+hatas/iu,'sunucu hatası'],
 [/\bsuper\s+admin\b/iu,'Super Admin'],
 [/\bservice[- ]?role\b/iu,'service role'],
 [/provider\s+credential/iu,'provider credential'],
 [/\bapi\s+(?:hatas|yanıt|cevap|istek)/iu,'API iç dili'],
 [/\brpc\b/iu,'RPC'],
 [/\bsistem\s+hatas/iu,'sistem hatası'],
 [/\bISO\b/u,'ISO standardı'],
 [/merchant\s+yapılandır/iu,'merchant yapılandırması'],
 [/FCM\/APNs/iu,'FCM/APNs altyapı dili'],
 [/\bprivate\s+(?:alan|depolama)/iu,'private depolama dili'],
];
const customerFiles=[...new Set(customerRoots.flatMap(collectTsx))].filter(file=>!nonCustomerSurfaces.has(file)).sort();
requireMatch(customerFiles.length>0,'Customer-facing TSX surface scan found no files.');
for(const file of customerFiles){
 const literals=textLiterals(read(file));
 for(const [pattern,label] of technicalCopyPatterns){
  if(pattern.test(literals))failures.push(`${file} customer copy still contains technical wording: ${label}.`);
 }
}

requireMatch(customerE2e.includes("getByText('Sepete eklendi.',{exact:true})"),'Customer E2E must verify the current add-to-cart success message.');
requireMatch(customerE2e.includes("getByRole('button',{name:'Sepete Git',exact:true})"),'Customer E2E must verify direct cart navigation.');
requireMatch(customerE2e.includes('catalog_sort_backend_roundtrip')&&customerE2e.includes('catalog_stock_filter_backend_roundtrip'),'Customer E2E must verify real catalog filter RPC roundtrips.');
requireMatch(customerE2e.includes('favorite_remove_roundtrip')&&customerE2e.includes('cart_add_roundtrip'),'Customer E2E must verify persisted favorite/cart state changes.');

if(failures.length){
 console.error('Customer professionalization contract audit failed:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}
console.log(`Customer professionalization contract audit passed across ${customerFiles.length} customer TSX surfaces with Premium Home WCAG AA contrast and spacing contracts.`);
