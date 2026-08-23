import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const home=read('src/features/home/HomeSection.tsx');
const homeDir=path.join(root,'src/features/home');
const homeSources=fs.readdirSync(homeDir).filter(name=>name.endsWith('.tsx')).map(name=>fs.readFileSync(path.join(homeDir,name),'utf8')).join('\n');
const main=read('src/main.tsx');
const rowCss=read('src/features/customer-experience/homeOneRowPremium.css');
const narrativeCss=read('src/features/customer-experience/storefrontNarrativePremium.css');
const recs=read('src/features/catalog/ProductRecommendationsRail.tsx');
const connections=read('src/features/catalog/ProductDetailConnections.tsx');

const obsoleteHomeCommerceTokens=['<CatalogProductCard','go-product-card--home-rail','Sepete Ekle','<Gift','<Heart','ShoppingCart'];
const checks=[
 ['home sections expose narrative descriptions',home.includes('go-reference-section-copy')&&home.includes('sectionNarrative(')],
 ['seasonal merchandising is calendar-aware',home.includes("title:'Yazın Son Hasadı'")&&home.includes("title:'Sonbaharın Kiler Seçkisi'")&&home.includes("title:'Kış Sofrasının Seçkisi'")],
 ['false best-seller wording is not hardcoded in customer home',!home.includes('En Çok Satanlar')],
 ['verified discount is computed from compare price only',home.includes('discountPercent(price,originalPrice)')&&home.includes('originalPrice!==null&&originalPrice>price')],
 ['home renders products only through dedicated detail-link rows',home.includes('function HomeProductLinkRow')&&home.includes('<HomeProductLinkRow')&&home.includes('go-reference-product-row')&&home.includes('ürün detayını aç')],
 ['obsolete PR61 commerce-card path is absent from all home TSX sources',obsoleteHomeCommerceTokens.every(token=>!homeSources.includes(token))],
 ['one horizontal row geometry has a single canonical stylesheet owner',rowCss.includes('grid-template-columns: 5.25rem minmax(0,1fr) 6rem')&&rowCss.includes('border-bottom: 1px solid #1f392f')],
 ['mobile home row stays compact rather than becoming a hero card',rowCss.includes('grid-template-columns: 4.55rem minmax(0,1fr) 5.1rem')&&rowCss.includes('min-height: 9.1rem')],
 ['pitch and decision signals remain visible',rowCss.includes('.go-reference-product-row__pitch')&&rowCss.includes('.go-reference-product-row__signals')],
 ['ruby verification remains visible',home.includes("rubyVerified?'Yakut':'Doğrulanmış'")&&rowCss.includes('.go-reference-product-row__ruby')],
 ['narrative layer cannot override product row geometry',!narrativeCss.includes('.go-reference-product-row {')&&!narrativeCss.includes('grid-template-columns')&&!narrativeCss.includes('min-height: 10rem')],
 ['product detail has category store and origin navigation',connections.includes("product.categorySlug")&&connections.includes('buildProducerUrl')&&connections.includes('buildSearchUrl({query:origin})')],
 ['recommendations separate same-category and same-store context',recs.includes('Aynı kategoriden')&&recs.includes('Aynı mağazadan')],
 ['connected discovery components are mounted',main.includes('<ProductDetailConnections />')&&main.includes('<ProductRecommendationsRail />')],
 ['premium narrative loads after the canonical one-row stylesheet',main.indexOf('storefrontNarrativePremium.css')>main.indexOf('homeOneRowPremium.css')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const[name,ok]of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){console.error(`Storefront premium integrity audit failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1);}
console.log(`Storefront premium integrity audit passed (${checks.length} checks).`);
