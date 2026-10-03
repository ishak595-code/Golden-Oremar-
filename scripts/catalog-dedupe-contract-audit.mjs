// "Every product shows up twice" (İshak, 2026-10-03): the data was unique at
// every level, but each product card spoke its full summary three to four
// times to a screen reader (article label, photo button, name button and the
// visible text), and voice search could add up Chrome's repeated final
// results into "bal bal". This audit keeps one spoken summary per card, one
// card per product id on every list, and a clean voice transcript.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const card = read('src/features/catalog/CatalogProductCard.tsx');
const shelf = read('src/features/catalog/ProductRecommendationsShelf.tsx');
const results = read('src/features/catalog/CatalogSearchResults.tsx');
const catalogApi = read('src/features/catalog/api.ts');
const offline = read('src/lib/offlineCatalog.ts');
const voice = read('src/features/catalog/voiceSearchAdapter.ts');
const detail = read('src/features/catalog/ProductDetailScreen.tsx');

// 1. One spoken summary per card: the name button.
check(!/<article className="go-product-card[^"]*"[^>]*aria-label=/.test(card), 'Product card articles carry no aria-label (the name button says it once).');
check(/<button type="button" onClick=\{onClick\} aria-hidden="true" tabIndex=\{-1\}/.test(card), 'The photo button is hidden from screen readers and from the tab order; the name button opens the same page.');
check((card.match(/aria-label=\{accessibleLabel\}/g) || []).length === 3, 'Each card variant has exactly one element with the spoken summary.');
check(/const priceBlock=[^\n]*<div aria-hidden="true">/.test(card) && /go-product-card__source" aria-hidden="true"/.test(card) && /go-product-card__unit truncate" aria-hidden="true"/.test(card), 'Visible price, source and unit lines are not read a second time.');
check(/go-product-card__was/.test(card) && /go-product-card__drop/.test(card), 'Cards show an older price struck through with the drop.');

// 2. One card per product on every list.
check(/export function uniqueRecommendations/.test(shelf) && /seen\.has\(item\.id\)/.test(shelf) && /skip\.has\(item\.id\)\|\|skip\.has\(item\.slug\)/.test(shelf) && /out\.length===6/.test(shelf) && /currentId=\{productId\}/.test(detail), 'Recommendations: unique product ids, never the product on the page, at most six.');
check(/function mergeCatalogItems[^\n]*!unique\.has\(item\.id\)\)unique\.set\(item\.id,item\)/.test(results) && /items:mergeCatalogItems\(\[\],validItems\)/.test(results), 'Search results: one card per product id, on the first page and when more are loaded.');
check(/const key=`\$\{row\.kind\}:\$\{id\}`;if\(!id\|\|!label\|\|!value\|\|seen\.has\(key\)\)return\[\]/.test(catalogApi), 'Search suggestions: one per product, store or category.');
check(/const seen = new Set<string>\(\);\s*return home\.items\.filter/.test(offline), 'The shipped catalogue copy lists each product id once for search, suggestions and recommendations.');

// 3. Voice search: the final text is rebuilt, not added up.
check(/for \(let index = 0; index < event\.results\.length; index \+= 1\)/.test(voice) && !/finalText = `\$\{finalText\} \$\{transcript\}`/.test(voice) && /export function collapseRepeatedPhrase/.test(voice) && /finalText = collapseRepeatedPhrase\(finals\.join\(' '\)\)/.test(voice), 'Voice search rebuilds its final text from all results and drops a phrase said back twice.');

if (failures.length) {
  console.error('Catalog dedupe contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Catalog dedupe contract audit passed: one spoken summary per product card, one card per product on recommendations, search and suggestions, and a voice transcript that is never doubled.');
