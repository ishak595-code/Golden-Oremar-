import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const home=read('src/features/home/HomeSection.tsx');
const productCard=read('src/features/home/components/ProductCard.tsx');
const price=read('src/features/home/components/PriceDisplay.tsx');
const catalog=read('src/features/catalog/api.ts');
const css=read('src/features/customer-experience/premiumMobileV2.css');
const narrativeCss=read('src/features/customer-experience/storefrontNarrativePremium.css');
const main=read('src/main.tsx');
const recs=read('src/features/catalog/ProductRecommendationsRail.tsx');
const connections=read('src/features/catalog/ProductDetailConnections.tsx');
const removedLayers=['referenceHomeExact.css','homeMerchandisingUpgrade.css','homeOneRowPremium.css'];

const checks=[
 ['Home editorial titles and subtitles remain server-owned',home.includes('title={section.title}')&&home.includes('subtitle={section.subtitle}')],
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
