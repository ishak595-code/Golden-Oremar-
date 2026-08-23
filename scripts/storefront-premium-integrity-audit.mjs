import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const home=read('src/features/home/HomeSection.tsx');
const main=read('src/main.tsx');
const rowCss=read('src/features/customer-experience/storefrontNarrativePremium.css');
const recs=read('src/features/catalog/ProductRecommendationsRail.tsx');
const connections=read('src/features/catalog/ProductDetailConnections.tsx');

const checks=[
 ['home sections expose narrative descriptions',home.includes('go-reference-section-copy')&&home.includes('sectionNarrative(')],
 ['seasonal merchandising is calendar-aware',home.includes("title:'Yazın Son Hasadı'")&&home.includes("title:'Sonbaharın Kiler Seçkisi'")&&home.includes("title:'Kış Sofrasının Seçkisi'")],
 ['false best-seller wording is not hardcoded in customer home',!home.includes('En Çok Satanlar')],
 ['verified discount is computed from compare price only',home.includes('discountPercent(price,originalPrice)')&&home.includes('originalPrice!==null&&originalPrice>price')],
 ['one horizontal row contract remains enforced',rowCss.includes('grid-template-columns: 5.15rem minmax(0,1fr) 6.25rem')&&rowCss.includes('border-bottom: 1px solid')],
 ['pitch and decision signals remain visible',rowCss.includes('.go-reference-product-row__pitch')&&rowCss.includes('.go-reference-product-row__signals')],
 ['ruby verification remains visible',home.includes("rubyVerified?'Yakut':'Doğrulanmış'")&&rowCss.includes('.go-reference-product-row__ruby')],
 ['product detail has category store and origin navigation',connections.includes("product.categorySlug")&&connections.includes('buildProducerUrl')&&connections.includes('buildSearchUrl({query:origin})')],
 ['recommendations separate same-category and same-store context',recs.includes('Aynı kategoriden')&&recs.includes('Aynı mağazadan')],
 ['connected discovery components are mounted',main.includes('<ProductDetailConnections />')&&main.includes('<ProductRecommendationsRail />')],
 ['premium presentation layers load after legacy layers',main.indexOf('storefrontNarrativePremium.css')>main.indexOf('homeOneRowPremium.css')&&main.indexOf('productDetailConnectionsPremium.css')>main.indexOf('storefrontNarrativePremium.css')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const[name,ok]of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){console.error(`Storefront premium integrity audit failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1);}
console.log(`Storefront premium integrity audit passed (${checks.length} checks).`);
