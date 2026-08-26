import fs from 'node:fs';

const home=fs.readFileSync('src/features/home/HomeSection.tsx','utf8');
const baseCss=fs.readFileSync('src/features/customer-experience/referenceHomeExact.css','utf8');
const finalCss=fs.readFileSync('src/features/customer-experience/videoRecordingExact.css','utf8');
const main=fs.readFileSync('src/main.tsx','utf8');
const theme=fs.readFileSync('src/features/appearance/theme.ts','utf8');

const checks=[
 ['canonical search-category-product reference layout is present',home.includes('className="go-premium-home go-reference-home"')&&home.includes('data-reference-layout="search-category-product"')],
 ['home categories remain live and Super Admin ordered',home.includes('heroCategories.map')&&home.includes('category.productCount>0')],
 ['category previews are derived from live product images',home.includes('categoryPreviewImages')&&home.includes('products.filter(product=>product.categorySlug===category.id')],
 ['home collection order remains controlled by active homeSections',home.includes('homeSections.filter(section=>section.active)')],
 ['home products render only as dedicated single-row links',home.includes('<HomeProductLinkRow')&&home.includes('go-reference-product-row')],
 ['home does not render catalog product commerce cards',!home.includes('<CatalogProductCard')&&!home.includes('onAddToCart={onAddToCart}')&&!home.includes('onGift={()=>onGift(product)}')],
 ['home row has no cart, gift, favorite, stock or status badge controls',!home.includes('ShoppingCart')&&!home.includes('<Gift')&&!home.includes('<Heart')&&!home.includes('Soğuk Zincir')&&!home.includes('Sepete Ekle')],
 ['product detail remains the destination for every home product',home.includes('aria-label={`${product.name} ürün detayını aç`}')&&home.includes('onClick={onOpen}')],
 ['full catalog remains reachable from a dedicated discovery action',home.includes('Tüm Ürünleri Keşfet')&&home.includes("tab:'categories'")],
 ['seasonal and offer sections only use real catalog signals',home.includes("product.stockMode==='seasonal'")&&home.includes("product.homeSection==='offers'")],
 ['dark prestige base surface remains enforced',baseCss.includes('--go-home-bg: #03110c')&&baseCss.includes('.go-reference-home')],
 ['final recording stylesheet is loaded after the base reference stylesheet',main.indexOf("referenceHomeExact.css")<main.indexOf("videoRecordingExact.css")],
 ['category rail preserves the partial-next-card recording behavior',finalCss.includes('width: min(24rem,72vw)')&&finalCss.includes('.go-reference-category-rail')],
 ['product list is vertical and bounded rather than a horizontal card rail',finalCss.includes('.go-reference-product-list')&&finalCss.includes('grid-template-columns: 4.15rem minmax(0,1fr) auto')&&!finalCss.includes('.go-product-card--home-rail')],
 ['notification remains visible beside cart in the home header',finalCss.includes('header button[aria-label^="Bildirimler"]')&&finalCss.includes('display: grid !important')],
 ['product detail hides the global five-tab navigation',finalCss.includes(':root[data-app-tab="product-detail"] nav[aria-label="Ana gezinme"]')&&finalCss.includes('display:none !important')],
 ['first-run theme is the official custom brand theme',theme.includes("return getStoredTheme() || 'custom';")],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
 console.error('Reference home exact audit failed:');
 for(const[name]of failed)console.error(`- ${name}`);
 process.exit(1);
}
console.log(`Reference home exact audit passed (${checks.length} checks).`);