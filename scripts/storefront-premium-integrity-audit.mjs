import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const home=read('src/features/home/HomeSection.tsx');
const customerCopy=read('src/features/customer-experience/customerCopy.ts');
const categoryDirectory=read('src/features/catalog/CategoryDirectoryScreen.tsx');
const searchOverlay=read('src/features/catalog/CatalogSearchOverlay.tsx');
const searchResults=read('src/features/catalog/CatalogSearchResults.tsx');
const productCard=read('src/features/home/components/ProductCard.tsx');
const price=read('src/features/home/components/PriceDisplay.tsx');
const catalog=read('src/features/catalog/api.ts');
const css=read('src/features/customer-experience/premiumMobileV2.css');
const narrativeCss=read('src/features/customer-experience/storefrontNarrativePremium.css');
const main=read('src/main.tsx');
const recs=read('src/features/catalog/ProductRecommendationsRail.tsx');
const connections=read('src/features/catalog/ProductDetailConnections.tsx');
const removedLayers=['referenceHomeExact.css','homeMerchandisingUpgrade.css','homeOneRowPremium.css'];

const forbiddenMarketingClaims=['En Çok Satanlar','çok satan','en çok satan','müşterilerin favorisi','en sevilen','özel fırsat','Yazın Son Hasadı','Sonbaharın Kiler Seçkisi','Kış Sofrasının Seçkisi'];
const checks=[
 ['Home editorial presentation copy is centralized while server source semantics remain authoritative',home.includes("from'../customer-experience/customerCopy'")&&home.includes('homeSectionDisplayCopy(section.source.kind,section.title,section.subtitle)')&&home.includes('experience.sections.filter(section=>!section.deferred')&&home.includes('experience.sections.filter(section=>section.deferred')],
 ['customer-facing discovery copy is managed from one presentation module',categoryDirectory.includes("from'../customer-experience/customerCopy'")&&searchOverlay.includes("from '../customer-experience/customerCopy'")&&searchResults.includes("from'../customer-experience/customerCopy'")&&customerCopy.includes('HOME_SECTION_COPY')],
 ['marketing copy cannot fabricate bestseller, popularity or seasonal-campaign claims',forbiddenMarketingClaims.every(value=>!customerCopy.toLocaleLowerCase('tr-TR').includes(value.toLocaleLowerCase('tr-TR')))],
 ['seasonal language is scoped to the verified seasonal source kind',customerCopy.includes("seasonal:{eyebrow:'Mevsiminde sunulur'")&&home.includes('section.source.kind')],
 ['Home categories remain server-owned and managed',home.includes('experience.categoryOrder.flatMap')&&home.includes('category.imagePath||config?.image||null')],
 ['false best-seller or fabricated seasonal campaign wording is absent',!home.includes('En Çok Satanlar')&&!home.includes("title:'Yazın Son Hasadı'")&&!home.includes("title:'Sonbaharın Kiler Seçkisi'")&&!home.includes("title:'Kış Sofrasının Seçkisi'")],
 ['Home products render through the single Premium Mobile V2 card primitive',home.includes('<ProductCard')&&productCard.includes('className="go-product-card-v2"')],
 ['Home cards expose product, source, trust and price hierarchy',productCard.includes('go-product-card-v2__title')&&productCard.includes('go-product-card-v2__source')&&productCard.includes('go-product-card-v2__signals')&&productCard.includes('<PriceDisplay')],
 ['trust signals are derived from real catalog fields only',productCard.includes('item.producer.originVerified')&&productCard.includes('item.handlingProfile.requiresColdChain')&&productCard.includes("item.stockMode==='preorder'")&&productCard.includes("item.stockMode==='seasonal'")],
 ['official-store status remains backend-derived',productCard.includes("item.producer.storeKind==='official'")],
 ['Home cards never exceed two visible trust badges',productCard.includes('official?<ProductBadge')&&productCard.includes('official&&signal?<ProductBadge')],
 ['product titles remain a controlled two-line hierarchy',css.includes('.go-product-card-v2__title')&&css.includes('-webkit-line-clamp:2')],
 ['product cards remain premium and restrained without decorative shadow/glow dependence',css.includes('.go-product-card-v2__button')&&css.includes('box-shadow:none')],
 ['compare-at data remains canonical while primary Home cards avoid strike-through promotion framing',catalog.includes('compareAtPriceMinor?:number|null')&&catalog.includes('optionalSafeInteger(value.variant.compareAtPriceMinor')&&!productCard.includes('compareAtPriceMinor')&&!price.includes('compareAtPriceMinor')&&!price.includes('discountPercent')&&!price.includes('% indirim')],
 ['superseded Home CSS layers remain absent from the entrypoint',removedLayers.every(name=>!main.includes(name))],
 ['narrative CSS cannot own Premium V2 product geometry',!narrativeCss.includes('.go-product-card-v2__button')&&!narrativeCss.includes('.go-product-grid-v2')],
 ['product detail retains category, store and origin navigation',connections.includes('product.categorySlug')&&connections.includes('buildProducerUrl')&&connections.includes('buildSearchUrl({query:origin})')],
 ['recommendations retain same-category and same-store context',recs.includes('Aynı kategoriden')&&recs.includes('Aynı mağazadan')],
 ['connected discovery components remain mounted',main.includes('<ProductDetailConnections />')&&main.includes('<ProductRecommendationsRail />')],
 ['Premium Mobile V2 is loaded after legacy non-Home narrative layers',main.indexOf('premiumMobileV2.css')>main.indexOf('storefrontNarrativePremium.css')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const[name,ok]of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){console.error(`Storefront premium integrity audit failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1);}
console.log(`Storefront premium integrity audit passed (${checks.length} checks).`);
