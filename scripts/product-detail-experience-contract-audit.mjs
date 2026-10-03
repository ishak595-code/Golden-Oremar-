// The product page and the product cards, as İshak asked for on 2026-10-01
// and reshaped into the editorial page on 2026-10-03.
//
//  - Product sections (story, product information, health, how to
//    use it, reviews) open on tap, each on its own, downwards in place.
//  - The product images are a real swipe slider.
//  - Products without a photo show their own drawn artwork, not the store
//    logo repeated on every card.
//  - The microphone next to search is announced as "Sesli mikrofon", never
//    as a toggle that reads "kapalı".
//  - Clean product paths (/urun/<slug>) are tagged as the product page, so
//    its purchase dock and styles apply.

import fs from 'node:fs';

const failures = [];
const gallery_src = () => fs.readFileSync('src/features/catalog/ProductGallery.tsx', 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const detail = read('src/features/catalog/ProductDetailScreen.tsx');
check(!/<details\b/.test(detail), 'ProductDetailScreen must not use always-styled <details>; sections go through DetailAccordion.');
check(/<DetailAccordionGroup/.test(detail), 'Product sections sit in DetailAccordionGroup lists.');
// Editorial page (2026-10-03): the section names İshak chose. The order is
// checked in product-detail-editorial-contract-audit.mjs.
for (const [id, label] of [['story', 'Bu ürünün hikâyesi'], ['info', 'Ürün bilgileri ve özellikleri'], ['safety', 'Sağlık bilgileri'], ['usage', 'Nasıl tüketilir\\?'], ['reviews', 'Müşteri Yorumları']]) {
  check(new RegExp(`<DetailAccordion id="${id}"[^>]*title=[^>]*${label}`).test(detail), `The "${label.replace('\\', '')}" section must be a DetailAccordion (id ${id}).`);
}
// Round 2 (2026-10-03): after the reviews comes the product-based shelf
// "Sofranızı bu lezzetlerle tamamlayın" (and nothing else).
check(/<ProductRecommendationsShelf reference=/.test(detail) && detail.indexOf('<ProductRecommendationsShelf ') > detail.indexOf('<DetailAccordion id="reviews"') && !/<ProductRecommendationsRail\b/.test(detail), 'After the reviews: the product-based recommendations shelf, once.');
check(/<ProductGallery /.test(detail), 'The product images use ProductGallery.');
{
  // Round 3 (2026-10-03): no "Kargo ve teslimat bilgisi" section. Delivery and
  // return terms are rows of the facts table (İade, Teslimat), said once.
  check(!/<DetailAccordion id="delivery"|go-ship|go-return-line|getDomesticShippingQuote/.test(detail), 'No "Kargo ve teslimat bilgisi" section on the product page.');
  const facts = detail.slice(detail.indexOf('const returnText='), detail.indexOf('function startReview'));
  check(/'Soğuk zincirle gönderilir'/.test(facts), 'Cold-chain products read "Soğuk zincirle gönderilir" in the Teslimat row of the facts table.');
  check(!/yarın|withdrawal\.copy\.body|ShippingReadiness|go-detail-returns|Satıcı/.test(facts), 'The İade and Teslimat rows carry no long return steps, seller notes or invented dates.');
}
check(!/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u.test(detail), 'The product page uses no emoji; states are shown with line icons.');
check(/<ul className="go-kunye"/.test(detail) && detail.indexOf('<ul className="go-kunye"') > detail.indexOf('Üreticisini tanı') && detail.indexOf('<ul className="go-kunye"') < detail.indexOf('go-store-ask') && /maps\/search\/\?api=1&query=/.test(detail) && !/go-stock-line/.test(detail) && !/go-origin-strip/.test(detail) && !/go-detail-origin/.test(detail) && !/kind:'origin'/.test(detail) && !/label:'Stok'/.test(detail), 'Maker, village and verification are separate rows (the künye) under "Üreticisini tanı"; the village row opens the map; none of them is repeated as a strip, a line or a footer, and there is no "Stok: Var" row.');
check(!/go-maker-line/.test(detail) && /productMaker\(detail\?\.slug,detail\?\.makerName\)/.test(detail) && /key:'maker',label:'Üreten'/.test(detail) && !/id="world"/.test(detail) && !/<ProductDetailConnections/.test(detail), 'The maker is named once, in the künye (not again under the product name).');
check(!/go-store-card__verified/.test(detail) && !/Doğrulanmış resmi mağaza/.test(detail), 'The store card is a plain link to the store; verification is stated once, in the künye.');
check(!/Ürün Videosu<\/h2>/.test(detail) && /kind:'video'/.test(detail), 'The product video is a gallery slide, not a separate block.');
check(/\{hasTraceability\?<DetailAccordion id="trace"/.test(detail), 'The traceability section is hidden while it has nothing to show.');
check(!/aria-label="Bu ürünü hediye gönder"/.test(detail) && /async function giftNow\(\)[\s\S]{0,500}setOfflineGift\(true\)/.test(detail), 'One gift button; it works for guests through the order sheet.');
check(/go-stock-pill go-stock-pill--out/.test(detail) && /const lowStock=!soldOut&&!preorder&&tracked/.test(detail), 'Sold out is a pill next to the price; a low stock is said next to the quantity.');
check(/Sipariş üzerine hazırlanır/.test(detail) && /specifications\?.preOrderTime/.test(detail) && /const dispatchLine=/.test(detail), 'Pre-orders say so under the price and show the stored harvest and dispatch timing in the Teslimat row.');
check(!/aria-labelledby="product-withdrawal-title" className=\{`mt-6 flex gap-3/.test(detail), 'The large always-open withdrawal box must not come back.');

// Title to price: the name, the subtitle and the price; no review prompt or
// rating row in between.
const titleToPrice = detail.slice(detail.indexOf('<h1 id="product-detail-title" ref={titleRef}'), detail.indexOf('className="go-price-card"'));
check(!/go-rating-row/.test(detail) && !/İlk yorumu sen yaz/.test(detail) && !/değerlendirme bırak/i.test(detail) && titleToPrice.length > 0 && !/yorum|değerlendirme|Star/i.test(titleToPrice), 'No review call-to-action or rating row between the product name and the price.');
// Reviews keep their behaviour; the "first review" invitation is said once
// (the section's note), not again inside the empty state.
check(/'Tadına bakan ilk siz olun, ilk yorumu siz yazın'/.test(detail) && /Henüz müşteri yorumu yok/.test(detail) && !/Bu ürüne ilk yorumu yapan siz olun!/.test(detail), 'The reviews section says "Tadına bakan ilk siz olun, ilk yorumu siz yazın" once; the empty state says "Henüz müşteri yorumu yok" without repeating the invitation.');
check(/go-reviews__bars/.test(detail) && /her yorum gerçek bir siparişe bağlıdır/.test(detail), 'When there are reviews they show a rating distribution and say reviews come only from delivered orders.');
check(!/initialOpen=/.test(detail) && !/Devamını oku/.test(detail) && !/is-clamped/.test(detail) && /<p className="go-detail-story">\{storyText\}<\/p>/.test(detail), 'The story section is closed on arrival and opens to the full story; no preview, clamp or "Devamını oku".');
check(!/<DetailAccordion id="description"/.test(detail) && /<DetailAccordion id="info"[\s\S]{0,300}go-detail-about[\s\S]{0,300}go-detail-description/.test(detail), 'The description is part of "Ürün bilgileri ve özellikleri", after the editorial "about" text; there is no separate "Açıklama" section.');
const v4css = read('src/features/catalog/productDetailV4.css');
check(/\.go-detail-grid > \* \{ min-width: 0; \}/.test(v4css) && /\.go-detail-story, \.go-detail-description \{[^}]*overflow-wrap: anywhere/.test(v4css) && /className="go-detail-grid /.test(detail), 'Product text wraps long words and the two columns may shrink, so nothing widens the page (browser and Android WebView).');
check(!/is-clamped|go-story-more|go-rating-row/.test(v4css), 'The removed preview clamp and rating row leave no CSS behind.');
check(!/aria-pressed=\{isFavorite\}/.test(detail) && /aria-label=\{isFavorite\?'Favorilerden çıkar':'Favorilere ekle'\}/.test(detail), 'The favourite button is named "Favorilere ekle" / "Favorilerden çıkar" and is not an aria-pressed toggle (screen readers would add "kapalı").');
check(!/aria-pressed=\{isFavorite\}/.test(read('src/features/catalog/CatalogProductCard.tsx')) && /aria-label=\{isFavorite\?'Favorilerden çıkar':'Favorilere ekle'\}/.test(read('src/features/catalog/CatalogProductCard.tsx')), 'Product cards: the favourite button has the same names and no aria-pressed toggle.');
check(/go-gallery__thumbs/.test(gallery_src()) , 'The gallery shows thumbnails when there are two or more photos.');
check(/viewerZoom/.test(detail) && /onTouchEnd=/.test(detail), 'The full-screen viewer zooms on tap and swipes between photos.');
check(!/weightGrams[^;]*kgPrice|kgPriceMinor=[^;]*packageWeight/.test(detail), 'The kilogram price comes from the net amount on the label, never from the packed shipping weight.');

// Store follow under the ask button, inside "Üreticisini tanı".
check(/className="go-store-follow"/.test(detail) && detail.indexOf('className="go-store-follow"') > detail.indexOf('go-store-ask') && /toggleProducerFollow\(producerId\)/.test(detail) && /'Mağazayı takip et'/.test(detail) && /'Takip ediliyor'/.test(detail) && /Yeni ürünler gelince haberin olsun/.test(detail), 'A "Mağazayı takip et" button with its helper line sits under the ask button and uses toggle_producer_follow_v1.');
check(!/go-store-follow[^\n]*aria-pressed/.test(detail) && !/aria-pressed=\{following\}/.test(read('src/features/catalog/PublicProducerScreen.tsx')), 'Follow buttons are not aria-pressed toggles (screen readers would add "kapalı").');
check(/async function toggleFollow\(\)\{\n  if\(!authenticated\)\{onLoginRequired\(\);return;\}/.test(detail), 'Following a store asks guests to sign in first.');
const v3css = read('src/features/customer-experience/productDetailV3.css');
check(!/\.go-detail-accordion\{[^}]*overflow:hidden/.test(v3css) && /\.go-detail-accordion__header::before\{content:'';position:absolute;inset:-1px -1px 0 -1px;\}/.test(v3css) && /\.go-detail-accordion__header>\*\{position:relative;pointer-events:none;\}/.test(v3css), 'The whole section header row, corners and border included, is the tap target (the card does not clip it).');
check(/const write=composer\|\|<button type="button" onClick=\{onWrite\} className="go-reviews__write">/.test(detail) && (detail.match(/\{write\}\{policy\}/g)||[]).length===2 && /setReviewComposerOpen\(true\)/.test(detail), '"Değerlendirme yaz" is offered when there are no reviews, when reviews are unavailable and under the list, and opens the review form in place.');
const composerSrc = read('src/features/catalog/ProductReviewComposer.tsx');
check(/listReviewableOrderItems\(\)/.test(composerSrc) && /entry\.productId===productId/.test(composerSrc) && /submitVerifiedReview\(/.test(composerSrc) && /Teslim aldıktan sonra yorum yazabilirsiniz/.test(composerSrc) && /Yorum şu anda gönderilemiyor/.test(composerSrc), 'The review form only accepts delivered orders of this product and says so in Turkish when there is nothing to review or the service is unreachable.');

check(/function sameOriginImage\(path:string\)/.test(read('src/features/catalog/producerStorefrontApi.ts')) && /if\(sameOriginImage\(path\)\)return path;/.test(read('src/features/catalog/producerStorefrontApi.ts')), 'The store page accepts the same-origin brand images the offline catalogue copy points at, so it still opens while Supabase is unavailable.');
check(/img\.object-cover\{object-fit:cover;object-position:center center;\}/.test(read('src/features/customer-experience/productDetailV3.css')), 'Product card photos are cropped from the centre (object-fit: cover; object-position: center) everywhere.');
check((()=>{const css=read('src/features/customer-experience/videoReferencePremium.css');const dense=read('src/features/customer-experience/marketplaceDensity.css');return /\.go-product-card__media \{[^}]*aspect-ratio: 1 \/ 1;/.test(css)&&/\.go-product-card--compact \.go-product-card__media \{[^}]*aspect-ratio: 1 \/ 1;/.test(css)&&!/go-product-card__media \{ aspect-ratio: 1 \/ \.9/.test(css)&&!/go-product-card__media>button:not\(\.go-product-card__favorite\)\{min-height/.test(dense);})(), 'Category and search product cards show the whole square photo: the photo frame is square (aspect-ratio 1/1) in the grid and compact list cards.');

// Sections open and close in place (2026-10-03 fix for "it disappears when
// opened"): each section on its own, no automatic scroll after opening, no
// height/opacity animation, scroll anchoring off inside the panel.
const accordion = read('src/features/catalog/DetailAccordion.tsx');
check(!/aria-label=\{title\}/.test(accordion) && /aria-describedby=\{teaser\?teaserId:undefined\}/.test(accordion) && /<span className="go-detail-accordion__title">\{title\}<\/span>/.test(accordion) && /id=\{teaserId\} className="go-detail-accordion__teaser" aria-hidden="true"/.test(accordion), 'Section headers are named by their visible title alone; a note (reviews only) is read once, as the description, never twice.');
check(/aria-expanded=\{open\}/.test(accordion) && /aria-controls=\{panelId\}/.test(accordion) && /role="region"/.test(accordion) && /<button type="button"/.test(accordion), 'Accordion headers are native buttons with aria-expanded and aria-controls; panels are labelled regions.');
check(/mounted\?children:null/.test(accordion), 'Accordion content mounts on first open (reviews are fetched only when asked for).');
check(!/group\.toggle|setOpen\(current=>current===id\?null:id\)/.test(accordion) && !/setTimeout/.test(accordion) && !/scrollTo\(/.test(accordion) && /hidden=\{!open\}/.test(accordion), 'Opening a section never closes another one, never scrolls the page on a timer, and closed panels are hidden.');
check(/\.go-detail-accordion__panel\{overflow-anchor:none;\}/.test(v3css) && !/go-detail-accordion__panel\{[^}]*grid-template-rows/.test(v3css) && !/go-detail-accordion__body\{[^}]*(opacity|transform)/.test(v3css) && !/go-detail-accordion__clip/.test(v3css + accordion), 'Panels expand downwards in place: no grid-rows or opacity animation, no clipping wrapper, scroll anchoring off.');
check(!/teaser=/.test(detail.slice(detail.indexOf('<DetailAccordion id="story"'), detail.indexOf('<DetailAccordion id="reviews"'))), 'Only the reviews section has a note under its title; no preview text elsewhere.');

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
for (const file of ['src/features/catalog/ProductRecommendationsRail.tsx']) {
  const source = read(file);
  check(/useProductContext\(/.test(source), `${file} must use useProductContext.`);
  check(!/useLiveHomeCatalog\(|getPublicHomeCatalog\(/.test(source), `${file} must not download the whole catalogue.`);
}
check(/get_public_product_context_v1/.test(read('src/lib/offlineCatalog.ts')), 'The product context call needs an offline answer too.');

// Product stories: one limit (1500 characters) shared by the admin and producer
// forms, the admin save API and the database rule.
const storyLimit = read('src/features/catalog/productStory.ts');
check(/PRODUCT_STORY_MAX_LENGTH = 1500;/.test(storyLimit), 'PRODUCT_STORY_MAX_LENGTH must be 1500.');
for (const file of ['src/admin/AdminOfficialStoreProducts.tsx', 'src/features/producer-products/ProducerProductManager.tsx', 'src/admin/officialStoreProductApi.ts']) {
  check(/PRODUCT_STORY_MAX_LENGTH/.test(read(file)), `${file} must use PRODUCT_STORY_MAX_LENGTH for the story limit.`);
}
check(/char_length\(story\) <= 1500/.test(read('supabase/migrations/20261003030000_product_story_limit_1500_v1.sql')), 'The database story rule must allow up to 1500 characters.');

if (failures.length) {
  console.error('Product detail experience contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Product detail experience contract audit passed: tap-to-open sections that stay in place, swipe gallery, drawn artwork instead of a repeated logo, a "Sesli mikrofon" button and product-page tagging are locked in.');
