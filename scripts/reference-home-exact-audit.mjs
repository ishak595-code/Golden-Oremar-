import fs from 'node:fs';

const home=fs.readFileSync('src/features/home/HomeSection.tsx','utf8');
const css=fs.readFileSync('src/features/customer-experience/referenceHomeExact.css','utf8');
const main=fs.readFileSync('src/main.tsx','utf8');
const theme=fs.readFileSync('src/features/appearance/theme.ts','utf8');

const checks=[
 ['approved home layout marker is present',home.includes('data-reference-layout="approved-dark-marketplace"')],
 ['home categories remain live and Super Admin ordered',home.includes('heroCategories.map')&&home.includes('category.productCount>0')],
 ['category previews are derived from live product images',home.includes('categoryPreviewImages')&&home.includes('products.filter(product=>product.categorySlug===category.id')],
 ['home collection cards use full visual cards, not compact row cards',!home.includes('<CatalogProductCard compact')],
 ['home collection order remains controlled by active homeSections',home.includes('homeSections.filter(section=>section.active).map')],
 ['fake empty seasonal/offer products are not synthesized',home.includes("products.filter(product=>product.stockMode==='seasonal'||product.homeSection==='seasonal')")&&home.includes("products.filter(product=>product.homeSection===id)")],
 ['approved reference stylesheet is loaded last',main.includes("import './features/customer-experience/referenceHomeExact.css';")],
 ['dark prestige home surface is enforced',css.includes('--go-home-bg: #03110c')&&css.includes('.go-reference-home')],
 ['reference category cards preserve partial-next-card rail behavior',css.includes('width: min(29rem,78vw)')&&css.includes('scroll-snap-type: x mandatory')],
 ['reference product rails use large visual cards',css.includes('.go-reference-product-rail > .go-product-card')&&css.includes('width: min(32rem,79vw)')],
 ['home notification action is removed from the compact header',css.includes('header button[aria-label^="Bildirimler"]')&&css.includes('display: none !important')],
 ['floating bottom navigation uses dark reference treatment',css.includes('nav[aria-label="Ana gezinme"]')&&css.includes('background: rgb(19 37 30 / .97)')],
 ['first-run theme is the official custom brand theme',theme.includes("return getStoredTheme() || 'custom';")],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
 console.error('Reference home exact audit failed:');
 for(const[name]of failed)console.error(`- ${name}`);
 process.exit(1);
}
console.log(`Reference home exact audit passed (${checks.length} checks).`);
