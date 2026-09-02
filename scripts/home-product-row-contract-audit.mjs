import fs from'node:fs';
import path from'node:path';

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const home=read('src/features/home/HomeSection.tsx');
const card=read('src/features/home/components/ProductCard.tsx');
const css=read('src/features/home/components/ProductCard.css');
const prestige=read('src/features/home/homePrestigeV3.css');
const merchandising=read('src/features/home/homeMerchandising.ts');
const failures=[];

function requireText(source,text,message){if(!source.includes(text))failures.push(message);}

requireText(home,'data-home-prestige-contract="single-row-v4"','Home prestige contract marker is missing.');
requireText(home,'<ul className="go-product-list-v4 flex flex-col gap-4">','Home product collections must remain native unordered lists.');
requireText(card,'return<li className="go-product-row-v4__item w-full"','Each Home product must remain a single native list item.');
requireText(card,'data-home-row-contract="single-link-v4"','Home product row contract marker is missing.');
requireText(card,'data-product-link="true"','Home product row must expose one full-row product link.');
requireText(card,'item.imagePath','Home product media must continue to use the catalog image path.');
requireText(css,'flex-direction:row!important','Home product row must remain horizontal.');
requireText(css,'.go-product-row-v4__badge','Home merchandising signals must remain inline in the row metadata.');
requireText(prestige,'.go-category-rail','Premium Home category rail styling is missing.');
requireText(merchandising,'homeMerchandisingSignal','Source-aware Home merchandising signal layer is missing.');

const anchorCount=(card.match(/<a\b/g)||[]).length;
if(anchorCount!==1)failures.push(`ProductCard must contain exactly one anchor, found ${anchorCount}.`);
if(card.includes('sr-only'))failures.push('Per-product hidden duplicate copy is prohibited in ProductCard.');
if(card.includes('role="listitem"'))failures.push('ProductCard must rely on native li semantics, not an extra listitem role.');
if(/className\s*=\s*"[^"]*go-product-card-v2/.test(card))failures.push('Legacy go-product-card-v2 must never return as a Home visual class.');
if(css.includes('.go-product-card-v2'))failures.push('Legacy go-product-card-v2 CSS selectors are prohibited in the Home row stylesheet.');
if(home.includes('categoriesAction'))failures.push('The redundant Home category rail action must stay removed.');
if(home.includes('showMerchandisingLabels'))failures.push('Merchandising must be source-aware for every Home product section, not limited to one section.');

if(failures.length){
 console.error('Home product-row contract audit failed:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}

console.log('Home product-row contract audit passed: one product equals one horizontal visual row, one link, compact category discovery and source-aware premium presentation.');
