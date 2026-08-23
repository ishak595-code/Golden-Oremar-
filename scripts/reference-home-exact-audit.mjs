import fs from 'node:fs';

const home=fs.readFileSync('src/features/home/HomeSection.tsx','utf8');
const card=fs.readFileSync('src/features/catalog/CatalogProductCard.tsx','utf8');
const baseCss=fs.readFileSync('src/features/customer-experience/referenceHomeExact.css','utf8');
const finalCss=fs.readFileSync('src/features/customer-experience/videoRecordingExact.css','utf8');
const main=fs.readFileSync('src/main.tsx','utf8');
const theme=fs.readFileSync('src/features/appearance/theme.ts','utf8');

const checks=[
 ['approved recording layout marker is present',home.includes('data-reference-layout="approved-recording-marketplace"')],
 ['home categories remain live and Super Admin ordered',home.includes('heroCategories.map')&&home.includes('category.productCount>0')],
 ['category previews are derived from live product images',home.includes('categoryPreviewImages')&&home.includes('products.filter(product=>product.categorySlug===category.id')],
 ['home collection order remains controlled by active homeSections',home.includes('homeSections.filter(section=>section.active)')],
 ['home rails use the dedicated uncluttered video card variant',home.includes('<CatalogProductCard homeRail')&&card.includes('data-home-product-card="video-reference"')],
 ['home no longer renders the old all-products grid',!home.includes('go-reference-catalog-grid')&&!home.includes('<CatalogProductCard compact')],
 ['full catalog remains reachable from a dedicated discovery action',home.includes('Tüm Ürünleri Keşfet')&&home.includes("tab:'categories'")],
 ['seasonal and offer sections only use real catalog signals',home.includes("product.stockMode==='seasonal'")&&home.includes("product.homeSection==='offers'")],
 ['dark prestige base surface remains enforced',baseCss.includes('--go-home-bg: #03110c')&&baseCss.includes('.go-reference-home')],
 ['final recording stylesheet is loaded after the base reference stylesheet',main.indexOf("referenceHomeExact.css")<main.indexOf("videoRecordingExact.css")],
 ['category rail preserves the partial-next-card recording behavior',finalCss.includes('width: min(24rem,72vw)')&&finalCss.includes('.go-reference-category-rail')],
 ['product rails preserve one-card-plus-next-card recording rhythm',finalCss.includes('width: min(22.5rem,78vw)')&&finalCss.includes('.go-product-card--home-rail')],
 ['notification remains visible beside cart in the home header',finalCss.includes('header button[aria-label^="Bildirimler"]')&&finalCss.includes('display: grid !important')],
 ['product detail hides the global five-tab navigation',finalCss.includes(':root[data-app-tab="product-detail"] nav[aria-label="Ana gezinme"]')&&finalCss.includes('display: none !important')],
 ['first-run theme is the official custom brand theme',theme.includes("return getStoredTheme() || 'custom';")],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
 console.error('Reference home exact audit failed:');
 for(const[name]of failed)console.error(`- ${name}`);
 process.exit(1);
}
console.log(`Reference home exact audit passed (${checks.length} checks).`);
