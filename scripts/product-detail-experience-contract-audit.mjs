// The product page and the product cards, as İshak asked for on 2026-10-01.
//
//  - Product sections (story, features, product info, health and safe use,
//    reviews, recommended products) open on tap, one at a time.
//  - The product images are a real swipe slider.
//  - Products without a photo show their own drawn artwork, not the store
//    logo repeated on every card.
//  - The microphone next to search is announced as "Sesli mikrofon", never
//    as a toggle that reads "kapalı".
//  - Clean product paths (/urun/<slug>) are tagged as the product page, so
//    its purchase dock and styles apply.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const detail = read('src/features/catalog/ProductDetailScreen.tsx');
check(!/<details\b/.test(detail), 'ProductDetailScreen must not use always-styled <details>; sections go through DetailAccordion.');
check(/<DetailAccordionGroup/.test(detail), 'Product sections must sit in one DetailAccordionGroup (one open at a time).');
for (const [id, label] of [['story', 'Ürünün Hikâyesi'], ['features', 'Ürünün Özellikleri'], ['info', 'Ürünün Bilgileri'], ['safety', 'Sağlık'], ['reviews', 'Müşteri Yorumları'], ['recommended', 'Önerilen Ürünler']]) {
  check(new RegExp(`<DetailAccordion id="${id}"[^>]*title=[^>]*${label}`).test(detail), `The "${label}" section must be a DetailAccordion (id ${id}).`);
}
check(/<ProductRecommendations[^>]*embedded/.test(detail) && /<ProductRecommendationsRail embedded/.test(detail), 'Recommendations live inside the "Önerilen Ürünler" section.');
check(/<ProductGallery /.test(detail), 'The product images use ProductGallery.');
check(!/go-return-line/.test(detail) && /<DetailAccordion id="returns"[^>]*İade ve Cayma Hakkı[^>]*teaser=\{withdrawal\.copy\.title\}/.test(detail), 'Return terms live in the "İade ve Cayma Hakkı" section, whose header always shows the condition (no line under the price).');
check(!/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u.test(detail), 'The product page uses no emoji; states are shown with line icons.');
check(/className="go-stock-line/.test(detail) && detail.indexOf('go-stock-line') < detail.indexOf('<DetailAccordionGroup') && detail.indexOf('go-stock-line') > detail.indexOf('product-detail-commerce-dock'), 'Stock is one line just above the descriptions, below the buy buttons.');
check(!/Ürün Videosu<\/h2>/.test(detail) && /kind:'video'/.test(detail), 'The product video is a gallery slide, not a separate block.');
check(/\{hasTraceability\?<DetailAccordion id="trace"/.test(detail), 'The traceability section is hidden while it has nothing to show.');
check(/aria-label="Bu ürünü hediye gönder"/.test(detail) && /async function giftNow\(\)[\s\S]{0,500}setOfflineGift\(true\)/.test(detail), 'Gifting is offered at the top of the page and works for guests through the order sheet.');
check(/go-stock-pill go-stock-pill--out/.test(detail) && /go-stock-pill go-stock-pill--low/.test(detail), 'Stock state is a pill with an icon.');
check(/go-stock-pill go-stock-pill--preorder/.test(detail) && /specifications\?.preOrderTime/.test(detail), 'Pre-orders show an "Ön sipariş" pill and the stored harvest and dispatch sentence.');
check(!/aria-labelledby="product-withdrawal-title" className=\{`mt-6 flex gap-3/.test(detail), 'The large always-open withdrawal box must not come back; the line and the section replace it.');

const accordion = read('src/features/catalog/DetailAccordion.tsx');
check(/aria-expanded=\{open\}/.test(accordion) && /aria-controls=\{panelId\}/.test(accordion) && /role="region"/.test(accordion), 'Accordion headers must be buttons with aria-expanded and aria-controls, panels labelled regions.');
check(/mounted\?children:null/.test(accordion), 'Accordion content must mount on first open (recommendations are fetched only when asked for).');

const gallery = read('src/features/catalog/ProductGallery.tsx');
const css = read('src/features/customer-experience/productDetailV3.css');
check(/scroll-snap-type:x mandatory/.test(css) && /go-gallery__track/.test(gallery), 'The gallery must swipe with CSS scroll snap.');
check(/ArrowRight/.test(gallery) && /ArrowLeft/.test(gallery) && /aria-current/.test(gallery), 'The gallery must work with arrow keys and mark the current dot.');

const artwork = read('src/features/catalog/ProductArtwork.tsx');
check(/export function isBrandFallbackImage/.test(artwork), 'ProductArtwork must export isBrandFallbackImage.');
for (const file of ['src/features/home/components/ProductCard.tsx', 'src/features/catalog/CatalogProductCard.tsx', 'src/features/catalog/ProductRecommendations.tsx', 'src/features/catalog/ProductRecommendationsRail.tsx']) {
  const source = read(file);
  check(/isBrandFallbackImage/.test(source) && /<ProductArtwork /.test(source), `${file} must show ProductArtwork instead of the repeated store logo.`);
}

const search = read('src/features/catalog/CatalogSearchInput.tsx');
check(/aria-label=\{listening\?'Sesli mikrofonu durdur':'Sesli mikrofon'\}/.test(search), 'The microphone button must be named "Sesli mikrofon".');
check(!/MicOff/.test(search), 'The microphone must not show a crossed-out icon.');
const voiceAt = search.indexOf('className="go-search-bar__voice"');
const voiceButton = search.slice(search.lastIndexOf('<button', voiceAt), voiceAt);
check(!/aria-pressed/.test(voiceButton), 'The microphone must not be an aria-pressed toggle; screen readers read pressed=false as "kapalı".');

const routeState = read('src/features/navigation/customerShellRouteState.ts');
check(/parsePublicRoute\(window\.location\.href\)\.tab/.test(routeState), 'The shell tab must come from parsePublicRoute, so /urun/<slug> is tagged product-detail.');

const main = read('src/main.tsx');
check(!/<ProductDetailConnections|<ProductRecommendationsRail/.test(main), 'Recommendation rails must not be mounted globally after the app; they belong to the product page.');

// The product page's rails read one small context call, never the whole
// catalogue (which grows with every product and was fetched twice per visit).
for (const file of ['src/features/catalog/ProductDetailConnections.tsx', 'src/features/catalog/ProductRecommendationsRail.tsx']) {
  const source = read(file);
  check(/useProductContext\(/.test(source), `${file} must use useProductContext.`);
  check(!/useLiveHomeCatalog\(|getPublicHomeCatalog\(/.test(source), `${file} must not download the whole catalogue.`);
}
check(/get_public_product_context_v1/.test(read('src/lib/offlineCatalog.ts')), 'The product context call needs an offline answer too.');

if (failures.length) {
  console.error('Product detail experience contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Product detail experience contract audit passed: tap-to-open sections, swipe gallery, drawn artwork instead of a repeated logo, a "Sesli mikrofon" button and product-page tagging are locked in.');
