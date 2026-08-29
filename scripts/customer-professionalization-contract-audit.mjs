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
const favorites=read('src/features/account/FavoritesPanel.tsx');
const cart=read('src/features/cart/CartCheckoutFlow.tsx');
const premiumCss=read('src/features/customer-experience/premiumMobileV2.css');
const customerE2e=read('scripts/customer-e2e.mjs');

const titleIndex=detail.indexOf('<h1');
const priceIndex=detail.indexOf('priceReady?',titleIndex);
const shortDescriptionIndex=detail.indexOf('detail.shortDescription',titleIndex);
const variantIndex=detail.indexOf('<fieldset className="mt-5"',titleIndex);
const producerIndex=detail.indexOf('detail?.producer',Math.max(0,variantIndex));
requireMatch(titleIndex>=0&&priceIndex>titleIndex,'Product detail title/price hierarchy is missing.');
requireMatch(shortDescriptionIndex<0||priceIndex<shortDescriptionIndex,'Product detail price must remain above short description.');
requireMatch(variantIndex>priceIndex,'Variant selection must remain after the primary price block.');
requireMatch(producerIndex<0||variantIndex<producerIndex,'Variant selection must remain before secondary producer content.');
requireMatch(detail.includes('product-detail-commerce-dock'),'State-aware product commerce dock is missing.');
requireMatch(detail.includes("setStatus('Sepete eklendi.')")&&detail.includes('Sepete Git'),'Compact add-to-cart success action is missing.');
forbid(detail,'line-clamp-3','Product detail short copy must not return to artificial three-line truncation.');

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

requireMatch(premiumCss.includes('.go-home-content{width:min(100%,1280px);margin:0 auto;padding:var(--go-space-5) var(--go-mobile-pad) var(--go-space-9);}'),'Home content needs the calmer premium outer rhythm.');
requireMatch(premiumCss.includes('.go-home-section{margin-top:var(--go-space-8);}'),'Home sections need the calmer 40px vertical rhythm.');
requireMatch(premiumCss.includes('.go-product-grid-v2{display:grid;grid-template-columns:1fr;gap:var(--go-space-4);}'),'Home product grid needs 16px mobile breathing room.');
requireMatch(premiumCss.includes('min-height:148px')&&premiumCss.includes('padding:var(--go-space-4);text-align:left'),'Home product cards need the expanded premium inner spacing.');
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
function collectTsx(target){
 const absolute=path.join(root,target);
 if(!fs.existsSync(absolute))return[];
 const stat=fs.statSync(absolute);
 if(stat.isFile())return target.endsWith('.tsx')?[target]:[];
 return fs.readdirSync(absolute,{withFileTypes:true}).flatMap(entry=>collectTsx(path.join(target,entry.name)));
}
function stripComments(source){return source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');}
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
];
const customerFiles=[...new Set(customerRoots.flatMap(collectTsx))].sort();
requireMatch(customerFiles.length>0,'Customer-facing TSX surface scan found no files.');
for(const file of customerFiles){
 const source=stripComments(read(file));
 for(const [pattern,label] of technicalCopyPatterns){
  if(pattern.test(source))failures.push(`${file} customer surface still contains technical wording: ${label}.`);
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
