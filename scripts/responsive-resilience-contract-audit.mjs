// Responsive layout and resilience contract audit.
//
// Every rule here locks a defect that was found by running the built app in a
// real headless Chromium at 320, 360, 390, 412, 768 and 1280 px against real
// production data, and then fixed. None of them was visible to tsc, the build
// or the other audits. Each rule names the defect it prevents.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

// 1. Bottom navigation must fit a 320 px screen. Five tabs with a 64 px
//    minimum each needed 320 px inside a bar that has about 282 px there, so
//    "Hesabım" was cut in half on small phones and whenever Android's
//    display-size accessibility setting narrows the viewport.
const app = read('src/App.tsx');
const navButton = app.match(/function BottomNavButton[\s\S]*?<\/button>;\}/)?.[0] || '';
check(Boolean(navButton), 'BottomNavButton must exist in App.tsx.');
check(!/min-w-\[64px\]/.test(navButton), 'Bottom navigation tabs must not force a 64px minimum width; five of them do not fit a 320px screen.');
check(/min-w-0/.test(navButton) && /flex-auto/.test(navButton), 'Bottom navigation tabs must size from their content (flex-auto) and be allowed to shrink (min-w-0).');
check(/truncate/.test(navButton), 'Bottom navigation labels must ellipsize rather than overflow under large text settings.');

// 2. Search results must not depend on filter counts. Loading both with
//    Promise.all meant a failed or slow facet query, or a facet total that
//    disagreed with the search total by one product published in between,
//    replaced the whole product list with an error.
const search = read('src/features/catalog/CatalogSearchResults.tsx');
check(/getCatalogSearchFacets\(facetInput\(filters\)\)\.catch\(\(\)=>null\)/.test(search), 'Search must tolerate a facet failure: getCatalogSearchFacets(...) needs .catch(()=>null) inside the initial load.');
check(!/total!==nextFacets\.total\)throw/.test(search), 'A facet total that differs from the search total must drop the facets, not fail the search.');
check(/consistentFacets=nextFacets&&nextFacets\.total===total\?nextFacets:null/.test(search), 'Only facets consistent with the search total may be shown.');

// 3. Home must not be a single point of failure. A first-time visitor saw an
//    error screen whenever the home composition query failed, even though the
//    product catalogue itself loaded.
const homeApi = read('src/features/home/homeExperienceApi.ts');
const homeHook = read('src/features/home/useHomeExperience.ts');
check(/export function buildCatalogFallbackExperience/.test(homeApi), 'homeExperienceApi must provide buildCatalogFallbackExperience.');
check(/return normalizeExperience\(\{/.test(homeApi.match(/export function buildCatalogFallbackExperience[\s\S]*?\n\}/)?.[0] || ''), 'The fallback home must pass through normalizeExperience, the same validation as the real home.');
check(/item\.featured===true/.test(homeApi), 'The fallback home may only contain products the catalogue marks as featured, so its labels stay truthful.');
check(/loadCatalogFallbackExperience\(locale\)/.test(homeHook), 'useHomeExperience must try the catalogue fallback before showing an error to a visitor with no cached home.');
check(!/persistExperience\(locale,fallback/.test(homeHook), 'The fallback home must never be persisted as if it were the real home.');

// 4. Home product rows: names, badges and places must not be cut mid-word.
const rowCss = read('src/features/home/components/ProductCard.css');
const badgeRule = rowCss.match(/\.go-product-row-v4__badge\{[^}]*\}/)?.[0] || '';
check(Boolean(badgeRule) && !/display:inline-flex/.test(badgeRule), 'The row badge must not be inline-flex: text-overflow does not apply to flex containers, which cut labels mid-word ("İmza s").');
check(/\.go-product-row-v4__title\{[^}]*-webkit-line-clamp:2/.test(rowCss), 'Product names must be allowed two lines in the home row.');
check(/container-type:inline-size/.test(rowCss), 'The row meta line must adapt to the row width through a container query.');
const firstContainer = rowCss.indexOf('@container');
const baseRules = rowCss.slice(0, firstContainer < 0 ? rowCss.length : firstContainer);
const afterContainers = firstContainer < 0 ? '' : rowCss.slice(firstContainer).replace(/@container[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
check(firstContainer > 0 && /\.go-product-row-v4__badge\{/.test(baseRules) && /\.go-product-row-v4__region\{/.test(baseRules), 'Base badge and region rules must precede the container-query rules.');
check(!/\.go-product-row-v4__(badge|region)\{/.test(afterContainers), 'No base badge or region rule may follow the container-query rules; with equal specificity it would override them.');

// 5. Category cards must show each category's own icon, and whole names.
const categoryCard = read('src/features/home/components/CategoryCard.tsx');
const home = read('src/features/home/HomeSection.tsx');
check(/categoryIcon\(icon\)/.test(categoryCard) && /<Icon\/>/.test(categoryCard), 'CategoryCard must render the icon named by the category, not a fixed leaf for every category.');
check(/icon=\{config\?\.icon\|\|category\.icon\}/.test(home), 'HomeSection must pass the category icon to CategoryCard.');

// 6. Recommendation header action: never a clipped label with a hidden arrow.
const rail = read('src/features/catalog/ProductRecommendationsRail.tsx');
const railCss = read('src/features/customer-experience/productDiscoveryPremium.css');
check(/aria-label=\{actionLabel\}/.test(rail) && /Tümünü gör/.test(rail), 'The recommendation action must show a short label on phones and keep the full label as its accessible name.');
check(!/group-head > button \{\s*max-width: 8rem;\s*overflow: hidden;/.test(railCss), 'The recommendation action must not be clipped to 8rem; that cut the label mid-word and hid the arrow.');

if (failures.length) {
  console.error('Responsive and resilience contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Responsive and resilience contract audit passed: 320px navigation, facet-independent search, catalogue-backed home fallback, uncut product rows, per-category icons and an unclipped recommendation action are locked in.');
