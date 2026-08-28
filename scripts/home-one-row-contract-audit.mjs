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
const image=read('src/features/home/components/PremiumImage.tsx');

requireText(main,"import './features/customer-experience/premiumMobileV2.css';",'Premium Mobile V2 CSS must stay loaded as the Home presentation authority.');
for(const retired of ['homeOneRowPremium.css','homeMerchandisingUpgrade.css','referenceHomeExact.css']){if(fs.existsSync(path.join(root,'src/features/customer-experience',retired)))failures.push(`Retired overlapping Home CSS must stay absent: ${retired}`);}

requireText(css,'.go-product-card-v2__button','Premium Home product surface contract is missing.');
requireText(css,'grid-template-columns:104px minmax(0,1fr)','Default mobile product cards must preserve a stable horizontal image/content composition.');
requireText(css,'grid-template-columns:96px minmax(0,1fr)','Compact phone product cards must preserve a stable horizontal image/content composition.');
requireText(css,'grid-template-columns:88px minmax(0,1fr)','320px-class product cards must preserve a stable horizontal image/content composition.');
requireText(css,'.go-product-card-v2__title','Premium product title styling is missing.');
requireText(css,'-webkit-line-clamp:2','Product titles must remain readable for two lines before controlled ellipsis.');
requireText(css,'.go-product-card-v2__source','Product source styling must remain visible.');
requireText(css,'.go-product-card-v2__signals','Product trust-signal styling must remain visible.');
requireText(css,'.go-price-display','Canonical product price styling must remain visible.');
requireText(css,'[data-tone="official"]','Official-store badge styling must remain restrained and distinct.');
requireText(css,'object-fit:cover','Product imagery must remain ready for real photography without layout changes.');
forbid(css,/\.go-product-card-v2__button\s*\{[^}]*grid-template-columns\s*:\s*1fr\s*;/s,'Primary mobile product cards must not collapse into an unstructured single-column card.');

requireText(home,'<ProductCard','Managed Home products must render through the reusable Premium Mobile ProductCard.');
requireText(product,'go-product-card-v2__title','Home cards must render the product title as the primary decision signal.');
requireText(product,'go-product-card-v2__source','Home cards must render producer/location source context.');
requireText(product,'go-product-card-v2__signals','Home cards must render bounded verified trust signals.');
requireText(product,'<PriceDisplay','Home cards must render canonical price permanently.');
requireText(product,"official?<ProductBadge",'Official-store trust must remain backend-derived.');
requireText(product,"official&&signal?<ProductBadge",'Cards must retain the explicit maximum-two trust-signal composition.');
forbid(product,/\.map\([^)]*badge|badges\.map/,'Home cards must not map an unbounded badge collection into the primary surface.');
forbid(product,/Sepete Ekle|Hemen Ön Sipariş Ver|ShoppingCart/,'Home discovery cards must not restore inline commerce controls.');
requireText(price,'compareAtPriceMinor','A real compare-at price must remain supported when supplied by the catalog.');
requireText(price,'Intl.NumberFormat','Price rendering must remain locale/currency aware from minor units.');
requireText(image,"loading={eager?'eager':'lazy'}",'Product imagery must keep the LCP eager path and lazy loading elsewhere.');
requireText(image,'onError','Product imagery must keep a resilient error fallback.');
requirePattern(product,/sourceLabel\(item\)/,'Product source copy must remain data-derived rather than hardcoded.');

if(failures.length){console.error('Golden Oremar premium Home product hierarchy audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar premium Home product hierarchy audit passed: each product keeps a stable horizontal mobile composition with image, two-line title, source, bounded real trust signals and canonical price.');