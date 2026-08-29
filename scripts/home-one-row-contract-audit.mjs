import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(file){const absolute=path.join(root,file);if(!fs.existsSync(absolute)){failures.push(`Missing required file: ${file}`);return'';}return fs.readFileSync(absolute,'utf8');}
function requireText(content,text,message){if(!content.includes(text))failures.push(message);}
function requirePattern(content,re,message){if(!re.test(content))failures.push(message);}
function forbid(content,re,message){if(re.test(content))failures.push(message);}

const main=read('src/main.tsx');
const css=read('src/features/customer-experience/premiumMobileV2.css');
const home=read('src/features/home/HomeSection.tsx');
const product=read('src/features/home/components/ProductCard.tsx');
const price=read('src/features/home/components/PriceDisplay.tsx');
const catalog=read('src/features/catalog/api.ts');
const image=read('src/features/home/components/PremiumImage.tsx');

requireText(main,"import './features/customer-experience/premiumMobileV2.css';",'Premium Mobile V2 CSS must stay loaded as the Home presentation authority.');
for(const retired of ['homeOneRowPremium.css','homeMerchandisingUpgrade.css','referenceHomeExact.css']){if(fs.existsSync(path.join(root,'src/features/customer-experience',retired)))failures.push(`Retired overlapping Home CSS must stay absent: ${retired}`);}

requireText(css,'.go-product-card-v2__button','Premium Home product surface contract is missing.');
requireText(css,'.go-product-grid-v2{display:grid;width:100%;max-width:860px;grid-template-columns:1fr;gap:0','Home products must render as one full-width list rather than detached cards.');
requireText(css,'grid-template-columns:88px minmax(0,1fr)','Default product rows must preserve a compact horizontal image/content composition.');
requireText(css,'grid-template-columns:82px minmax(0,1fr)','Compact phone product rows must preserve a horizontal image/content composition.');
requireText(css,'grid-template-columns:74px minmax(0,1fr)','320px-class product rows must preserve a horizontal image/content composition.');
requireText(css,'.go-product-card-v2__title','Premium product title styling is missing.');
requireText(css,'-webkit-line-clamp:2','Product titles must remain readable for two lines before controlled ellipsis.');
requireText(css,'.go-product-card-v2__source','Product source styling must remain visible.');
requireText(css,'.go-product-card-v2__signals','Product trust-signal styling must remain visible.');
requireText(css,'.go-price-display','Canonical product price styling must remain visible.');
requireText(css,'justify-content:flex-end','Product price must remain visually anchored at the end of the row.');
requireText(css,'[data-tone="official"]','Official-store badge styling must remain restrained and distinct.');
requireText(css,'object-fit:cover','Product imagery must remain ready for real photography without layout changes.');
forbid(css,/\.go-product-grid-v2\s*\{[^}]*grid-template-columns\s*:\s*repeat\(/s,'Home products must not return to a multi-column card grid.');
forbid(css,/\.go-product-card-v2__button\s*\{[^}]*grid-template-columns\s*:\s*1fr\s*;/s,'Primary mobile product rows must not collapse into an unstructured single-column card.');

requireText(home,'<ProductCard','Managed Home products must render through the reusable Premium Mobile ProductCard.');
requireText(product,'go-product-card-v2__title','Home rows must render the product title as the primary decision signal.');
requireText(product,'go-product-card-v2__source','Home rows must render producer/location source context.');
requireText(product,'go-product-card-v2__signals','Home rows must render one bounded verified trust signal.');
requireText(product,'<PriceDisplay','Home rows must render canonical price permanently.');
requireText(product,'data-product-id={item.id}','Home rows must expose a stable product identity marker.');
requireText(product,'data-product-reference={item.slug}','Home rows must expose a stable navigable product reference.');
requireText(product,'<a href={buildProductUrl(item.slug)}','The entire Home product row must be a real navigable product link.');
requireText(product,"const official=item.producer.storeKind==='official'",'Official-store trust must remain backend-derived.');
requireText(product,'const visualSignal=signal??','Rows must select one strongest concise truth-backed trust signal.');
requireText(product,'<ProductBadge tone={visualSignal.tone} label={visualSignal.label}/>','Rows must render at most one primary trust badge.');
requireText(product,"!item.imagePath.startsWith('brand/official-store/')",'Official-store brand imagery must not masquerade as a product photo.');
forbid(product,/\.map\([^)]*badge|badges\.map/,'Home rows must not map an unbounded badge collection into the primary surface.');
forbid(product,/Sepete Ekle|Hemen Ön Sipariş Ver|ShoppingCart/,'Home discovery rows must not restore inline commerce controls.');
requireText(catalog,'compareAtPriceMinor?:number|null','Canonical catalog data must preserve a real compare-at price when supplied.');
requireText(catalog,"compareAtPriceMinor:optionalSafeInteger(value.variant.compareAtPriceMinor,'Karşılaştırma fiyatı')",'Catalog validation must continue validating real compare-at price data.');
requireText(product,'compareAtPrice:compareMinor!==null?compareMinor/100:null','Real compare-at data must remain available to the product row spoken label when present.');
forbid(product,/<PriceDisplay[^>]*compareAtPrice/,'Primary Home rows must not pass compare-at pricing into the visible premium discovery surface.');
forbid(price,/compareAtPriceMinor|line-through|<del\b/,'Primary Home PriceDisplay must remain a single current-price hierarchy rather than promotional strike-through framing.');
requireText(price,'Intl.NumberFormat','Price rendering must remain locale/currency aware from minor units.');
requireText(price,"normalized==='TRY'",'TRY price rendering must use the customer-facing TL notation path.');
requireText(image,"loading={eager?'eager':'lazy'}",'Product imagery must keep the LCP eager path and lazy loading elsewhere.');
requireText(image,'onError','Product imagery must keep a resilient error fallback.');
requirePattern(product,/sourceLabel\(item\)/,'Product source copy must remain data-derived rather than hardcoded.');

if(failures.length){console.error('Golden Oremar premium Home product hierarchy audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar premium Home product hierarchy audit passed: each product owns one compact horizontal link row with truthful product-photo state, source, one bounded trust signal and a canonical end-aligned price.');
