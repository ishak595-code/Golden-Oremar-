import fs from'node:fs';
import path from'node:path';

const root=process.cwd();
const failures=[];
function read(file){const absolute=path.join(root,file);if(!fs.existsSync(absolute)){failures.push(`Missing required file: ${file}`);return'';}return fs.readFileSync(absolute,'utf8');}
function requireText(content,text,message){if(!content.includes(text))failures.push(message);}
function requirePattern(content,re,message){if(!re.test(content))failures.push(message);}
function forbid(content,re,message){if(re.test(content))failures.push(message);}

const main=read('src/main.tsx');
const componentCss=read('src/features/home/components/ProductCard.css');
const home=read('src/features/home/HomeSection.tsx');
const product=read('src/features/home/components/ProductCard.tsx');
const price=read('src/features/home/components/PriceDisplay.tsx');
const catalog=read('src/features/catalog/api.ts');
const image=read('src/features/home/components/PremiumImage.tsx');

requireText(main,"import './features/customer-experience/premiumMobileV2.css';",'Premium Mobile V2 must remain the shared storefront foundation.');
requireText(product,"import'./ProductCard.css';",'ProductCard must own its canonical marketplace-row stylesheet.');
for(const retired of ['homeOneRowPremium.css','homeMerchandisingUpgrade.css','referenceHomeExact.css','homeProductRowLock.css']){if(fs.existsSync(path.join(root,'src/features/customer-experience',retired))||fs.existsSync(path.join(root,'src/features/home/components',retired)))failures.push(`Retired overlapping Home CSS must stay absent: ${retired}`);}

requireText(componentCss,'.go-product-grid-v2','Canonical Home product-list surface is missing.');
requirePattern(componentCss,/\.go-product-grid-v2\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,1fr\)/s,'Home products must remain a single full-width list.');
requirePattern(componentCss,/\.go-product-card-v2__button\[data-product-link="true"\]\s*\{[^}]*grid-template-columns\s*:\s*76px\s+minmax\(0,1fr\)\s+18px/s,'Default marketplace row must preserve thumbnail, body and disclosure columns.');
requireText(componentCss,'.go-product-card-v2__rating','Marketplace rows must support real social-proof rendering.');
requireText(componentCss,'.go-product-card-v2__price','Marketplace rows must preserve a dedicated canonical price line.');
requireText(componentCss,'.go-product-card-v2__meta','Marketplace rows must preserve concise provenance/trust context.');
requireText(componentCss,'.go-product-card-v2__chevron','Marketplace rows must retain a disclosure indicator for product-detail navigation.');
requireText(componentCss,'object-fit:cover','Product thumbnails must remain ready for real photography.');
forbid(componentCss,/\.go-product-grid-v2\s*\{[^}]*grid-template-columns\s*:\s*repeat\(/s,'Home products must not return to a multi-column card grid.');
forbid(componentCss,/\.go-product-badge\b/,'Primary Home marketplace rows must not restore promotional pill badges.');

requireText(home,'<ProductCard','Managed Home products must render through the reusable ProductCard.');
requireText(product,'go-product-card-v2__title','Home rows must render the product title as the primary decision signal.');
requireText(product,'go-product-card-v2__rating','Home rows must render rating only when real review data exists.');
requireText(product,'item.reviewCount<1','Empty review data must not fabricate social proof.');
requireText(product,'item.averageRating.toLocaleString','Visible rating must remain backend-derived.');
requireText(product,'go-product-card-v2__price','Home rows must render the canonical price in the information hierarchy.');
requireText(product,'go-product-card-v2__source','Home rows must retain producer/location context.');
requireText(product,'go-product-card-v2__trust','Home rows must render at most one concise truth-backed trust signal.');
requireText(product,'<PriceDisplay','Home rows must use the canonical money formatter.');
requireText(product,'data-product-id={item.id}','Home rows must expose a stable product identity marker.');
requireText(product,'data-product-reference={item.slug}','Home rows must expose a stable navigable product reference.');
requireText(product,'<a href={buildProductUrl(item.slug)}','The entire Home product row must be a real navigable product link.');
requireText(product,"const official=item.producer.storeKind==='official'",'Official-store trust must remain backend-derived.');
requireText(product,'const visualSignal=signal??','Rows must select one strongest concise truth-backed trust signal.');
requireText(product,"!item.imagePath.startsWith('brand/official-store/')",'Official-store brand imagery must not masquerade as a product photo.');
forbid(product,/ProductBadge|\.map\([^)]*badge|badges\.map/,'Primary Home rows must not render promotional badge collections.');
forbid(product,/Sepete Ekle|Hemen Ön Sipariş Ver|ShoppingCart/,'Home discovery rows must not restore inline commerce controls.');
requireText(catalog,'averageRating:number;reviewCount:number','Catalog rows must preserve real product review aggregates.');
requireText(catalog,'compareAtPriceMinor?:number|null','Canonical catalog data must preserve a real compare-at price when supplied.');
requireText(product,'compareAtPrice:compareMinor!==null?compareMinor/100:null','Real compare-at data must remain available to the spoken product label when present.');
forbid(product,/<PriceDisplay[^>]*compareAtPrice/,'Primary Home rows must not turn compare-at pricing into promotional strike-through framing.');
forbid(price,/compareAtPriceMinor|line-through|<del\b/,'Primary Home PriceDisplay must remain a single current-price hierarchy.');
requireText(price,'Intl.NumberFormat','Price rendering must remain locale/currency aware from minor units.');
requireText(price,"normalized==='TRY'",'TRY price rendering must use customer-facing TL notation.');
requireText(image,"loading={eager?'eager':'lazy'}",'Product imagery must keep the LCP eager path and lazy loading elsewhere.');
requireText(image,'onError','Product imagery must keep a resilient error fallback.');
requirePattern(product,/sourceLabel\(item\)/,'Product source copy must remain data-derived rather than hardcoded.');

if(failures.length){console.error('Golden Oremar premium Home marketplace-list audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar premium Home marketplace-list audit passed: one product owns one full-row link with a truthful thumbnail, concise identity, optional real social proof, canonical price and one bounded trust signal.');
