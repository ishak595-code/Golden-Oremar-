import fs from 'node:fs';

const home=fs.readFileSync('src/features/home/HomeSection.tsx','utf8');
const customerCopy=fs.readFileSync('src/features/customer-experience/customerCopy.ts','utf8');
const css=fs.readFileSync('src/features/customer-experience/premiumMobileV2.css','utf8');
const runtime=fs.readFileSync('src/features/customer-experience/premiumMobileShellRuntime.ts','utf8');
const main=fs.readFileSync('src/main.tsx','utf8');
const theme=fs.readFileSync('src/features/appearance/theme.ts','utf8');
const removedLayers=[
 'src/features/customer-experience/referenceHomeExact.css',
 'src/features/customer-experience/homeMerchandisingUpgrade.css',
 'src/features/customer-experience/homeOneRowPremium.css',
];

const checks=[
 ['Premium Mobile V2 is the single canonical Home presentation layer',main.includes("premiumMobileV2.css")&&home.includes('className="go-premium-home-v2"')],
 ['superseded Home override layers are physically removed',removedLayers.every(file=>!fs.existsSync(file))&&removedLayers.every(file=>!main.includes(file.split('/').pop()))],
 ['Home remains server-composed rather than hard-coded',home.includes('useHomeExperience')&&home.includes('experience.categoryOrder')&&home.includes('experience.sections')],
 ['managed category ordering remains authoritative',home.includes('const bySlug=new Map(experience.categories.map')&&home.includes('experience.categoryOrder.flatMap')],
 ['category media remains server-owned and future-photo-ready',home.includes('category.imagePath||config?.image||null')&&home.includes('publicCatalogUrl(image)')],
 ['Home first render stays bounded and secondary sections are deferred',home.includes('experience.sections.filter(section=>!section.deferred')&&home.includes('experience.sections.filter(section=>section.deferred)')&&home.includes('<DeferredProductSection')],
 ['deferred Home loading is viewport-driven',home.includes('IntersectionObserver')&&home.includes("rootMargin:'560px 0px'")],
 ['Home products use the dedicated Premium V2 ProductCard',home.includes('<ProductCard')&&!home.includes('<CatalogProductCard')],
 ['Home discovery does not embed cart, gift or favorite commerce controls',!home.includes('ShoppingCart')&&!home.includes('<Gift')&&!home.includes('<Heart')&&!home.includes('Sepete Ekle')],
 ['product detail remains the destination for Home products',home.includes('onClick={()=>onProductClick(item)}')],
 ['full catalog remains reachable through the category destination',customerCopy.includes("discoverAll:'Tüm ürünleri keşfet'")&&home.includes('CUSTOMER_COPY.home.discoverAll')&&home.includes('onClick={()=>navigateToCategories()}')&&home.includes("url.searchParams.set('tab','categories')")],
 ['campaign content remains server-owned',home.includes('experience.campaign?<CampaignCard campaign={experience.campaign}/>')],
 ['single spacing/token scale owns Premium V2 rhythm',css.includes('--go-space-1:4px')&&css.includes('--go-space-9:48px')&&css.includes('--go-mobile-pad:20px')],
 ['prestige surface hierarchy remains tonal rather than decorative',css.includes('--go-forest-950:')&&css.includes('--go-forest-850:')&&css.includes('--go-forest-800:')&&css.includes('--go-ivory:')&&css.includes('--go-gold:')],
 ['category discovery remains a snapping horizontal rail with a visible continuation cue',css.includes('.go-category-rail')&&css.includes('scroll-snap-type:x mandatory')&&css.includes('grid-auto-columns:clamp(148px,42vw,184px)')],
 ['product titles remain readable for two lines',css.includes('.go-product-card-v2__title')&&css.includes('-webkit-line-clamp:2')&&css.includes('overflow-wrap:anywhere')],
 ['product photography contract is compact-square and cover-ready',css.includes('.go-product-card-v2__media{width:88px;height:88px')&&css.includes('.go-product-card-v2__media img')&&css.includes('object-fit:cover')],
 ['Home bottom spacing remains native safe-area aware',css.includes('var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))')&&css.includes('--go-nav-height:64px')],
 ['motion accessibility remains first-class',css.includes('@media (prefers-reduced-motion:reduce)')||css.includes('@media(prefers-reduced-motion:reduce)')],
 ['adaptive header runtime remains installed',main.includes('installPremiumMobileShellRuntime();')&&runtime.includes('requestAnimationFrame')],
 ['first-run theme remains the official custom brand theme',theme.includes("return getStoredTheme() || 'custom';")],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
 console.error('Premium Mobile V2 reference Home audit failed:');
 for(const[name]of failed)console.error(`- ${name}`);
 process.exit(1);
}
console.log(`Premium Mobile V2 reference Home audit passed (${checks.length} checks).`);
