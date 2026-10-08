// The editorial product page, as İshak described it on 2026-10-03.
//
// One shared page for every product, in this order:
//   photo (gallery with a slim slide bar) -> prestige line ("Yüksekova · Odun
//   isiyle geleneksel kurutma · Sınırlı hasat") -> "Kargo bizden" -> title
//   -> price (unit price × quantity) + pack -> buttons -> "Bu lezzetin hikâyesi"
//   -> "Özellikleri ve içeriği" -> facts table (Kökeni, Üretim,
//   Ambalaj, İade, Teslimat) -> "Sağlığınız için" -> "En güzel nasıl
//   tüketilir?" -> "Üreticisiyle tanışın" -> reviews -> "Seçkinizi tamamlayın".
// Round 3 (2026-10-03): no subtitle line and no "Kargo ve teslimat bilgisi"
// section; return and delivery terms live once, in the facts table.
// Round 2 (2026-10-03): the price is shown once (no bottom bar repeating it
// after the reviews), the tagline and "Köyden sofranıza" row gave way to the
// prestige line, and no "Temsili" caption sits under the photo.
//
// Titles are short and clean (no parentheses), prices drop ",00", the pack
// reads "1 kg • Özel bez kese" (never "1 adet"), and the text for all 50
// products lives in catalog/product-editorial/product-editorial.v1.json, the
// migration that wrote it to the database and the shipped offline copy.

import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');
// Key order differs between the file and Postgres jsonb; compare contents.
const same = (a, b) => { const norm = v => JSON.stringify(Object.keys(v || {}).sort().map(k => [k, v[k]])); return norm(a) === norm(b); };

const detail = read('src/features/catalog/ProductDetailScreen.tsx');
const jsx = detail.slice(detail.indexOf(' return<article'));

// 1. Section order.
const order = [
  ['photo', '<ProductGallery '],
  ['prestige line', '<p className="go-prestige"'],
  ['Kargo bizden', '<p className="go-prestige-note">{shippingLine}</p>'],
  ['title', '<h1 id="product-detail-title"'],
  ['price', 'className="go-price-card__price"'],
  ['pack', 'className="go-price-card__pack"'],
  ['buttons', 'className="go-buy__actions product-detail-commerce-dock"'],
  ['gift card', '<div className="go-gift-card">'],
  ['künye (village, maker, delivery, returns)', '<ul className="go-kunye go-kunye--top"'],
  ['Bu lezzetin hikâyesi', "<DetailAccordion id=\"story\" title={isNonFood?'Ustalığın hikâyesi':'Bu lezzetin hikâyesi'}"],
  ['Özellikleri ve içeriği', '<DetailAccordion id="info" title="Özellikleri ve içeriği"'],
  ['Sağlığınız için', "<DetailAccordion id=\"safety\" title={isNonFood?'Güvenle kullanın':'Sağlığınız için'}"],
  ['En güzel nasıl tüketilir?', "<DetailAccordion id=\"usage\" title={isNonFood?'Kullanım rehberi':'En güzel nasıl tüketilir?'}"],
  ['Üreticisiyle tanışın', '>Üreticisiyle tanışın</h2>'],
  ['reviews', '<DetailAccordion id="reviews" title="Müşterilerimiz anlatıyor"'],
  ['recommendations', '<ProductRecommendationsShelf '],
];
let last = -1;
for (const [name, marker] of order) {
  const at = jsx.indexOf(marker);
  check(at >= 0, `The product page is missing "${name}".`);
  check(at > last, `"${name}" is out of order on the product page.`);
  if (at >= 0) last = at;
}
const afterReviews = jsx.slice(jsx.indexOf('<DetailAccordion id="reviews"'));
{
  const rest = afterReviews.slice(afterReviews.indexOf('</DetailAccordion>'), afterReviews.indexOf('</article>'));
  check(!/<DetailAccordion id=|<section |go-sticky-buy|go-price-card|priceText\(/.test(rest), 'After the reviews only the recommendations follow: no price or purchase block repeats there.');
}
check(!/go-sticky-buy|stickyBuy/.test(detail), 'No bottom bar repeating the price and "Sepete Ekle" (the price is shown once, in the buy box).');
check(!/'Köyden sofranıza'|go-buybox__tagline|go-buybox__origin/.test(jsx), 'The framed tagline and "Köyden sofranıza" row under the photo are replaced by the prestige line.');
{
  const shelf = read('src/features/catalog/ProductRecommendationsShelf.tsx');
  check(/getProductRecommendations\(/.test(shelf) && /<CatalogProductCard [\s\S]{0,400}? compact\/>/.test(shelf) && />Seçkinizi tamamlayın<\/h2>/.test(shelf) && !/Bu ürünün yanına yakışanlar/.test(shelf), 'The recommendations shelf uses the product-based recommendations and the category page cards (square photo).');
}
check(/\{showHealth\?<DetailAccordion id="safety"/.test(jsx) && /hasHealthInfo\(safetyContent\)/.test(detail), '"Sağlığınız için" shows only when the product has health content.');
check(/\['Kökeni',\[producerLocation\?'':ed\('origin',120\)\]\],\['Teslimat',deliveryLines\],\['İade',\[returnText\]\],\['Ambalaj',\[ed\('packaging',120\)\]\],\['Üretim',\[productionFact\]\]\]/.test(detail) && !/\['Stok',/.test(detail) && !/'İçindekiler'/.test(detail), 'The künye lists the village (or Kökeni when there is no village), the maker, then Teslimat, İade, Ambalaj and Üretim (no İçindekiler or Stok row), each only when it has a value.');
check(/const computedReturn=withdrawal\?\(withdrawal\.tier==='none'\?'Cayma hakkı yok; hasarlı veya hatalı üründe iade hakkınız saklıdır':'14 gün içinde, paket açılmamışsa ücretsiz iade'\):'';/.test(detail) && /const returnText=typeof editorial\.returnText==='string'\?ed\('returnText',200\):computedReturn;/.test(detail), 'İade: "14 gün içinde, paket açılmamışsa ücretsiz iade"; perishables keep "Cayma hakkı yok; hasarlı veya hatalı üründe iade hakkınız saklıdır".');
check(/const deliveryLines=\[dispatchLine,\.\.\.\(coldChain\?\['Soğuk zincirle gönderilir'\]:\[\]\)\];/.test(detail) && /const dispatchLine=typeof editorial\.dispatchText==='string'\?ed\('dispatchText',160\):computedDispatch;/.test(detail) && /const coldChain=typeof editorial\.coldChain==='boolean'\?editorial\.coldChain:detail\?\.handlingProfile\?\.requiresColdChain===true;/.test(detail) && /const shippingLine=ed\('shippingNote',80\)\|\|\(shippingFeeMinor>0\?`Kargo ücreti \$\{priceText\(shippingFeeMinor,'TRY'\)\}`:'Kargo bizden'\);/.test(detail) && /if\(!preorder\)return'2-4 iş günü içinde kargoya verilir';/.test(detail) && /specifications\?\.preOrderTime/.test(detail), 'Teslimat: "2-4 iş günü içinde kargoya verilir" (pre-orders: their stored dispatch sentence) and "Soğuk zincirle gönderilir" for cold-chain products; the shipping fee line is shown once, under the photo.');
check(!/<DetailAccordion id="delivery"|Kargo ve teslimat bilgisi/.test(detail) && (detail.match(/'14 gün içinde, paket açılmamışsa ücretsiz iade'/g) || []).length === 1 && (detail.match(/'Cayma hakkı yok; hasarlı veya hatalı üründe iade hakkınız saklıdır'/g) || []).length === 1, 'No "Kargo ve teslimat bilgisi" section; the return text appears once, in the facts table.');
check(!/go-buybox__subtitle/.test(jsx), 'No subtitle line under the product name.');
check(/<span className="go-price-card__price" aria-live="polite">\{priceText\(totalMinor,currency\)\}<\/span>/.test(jsx) && /const totalMinor=priceReady\?priceMinor!\*quantity:null;/.test(detail), 'The big price is unit price × quantity and is announced politely when it changes.');
check(/onGift\(detail\.slug\|\|detail\.id,quantity\)/.test(detail) && /initialQuantity=\{giftProduct\.quantity\}/.test(read('src/App.tsx')), 'Hediye Et opens the gift order with the chosen quantity.');
check(/const productionFact=\(\(\)=>\{const value=ed\('production',160\);return value&&mostlyCovered\(value,prestigeParts\.join\(' '\)\)\?'':value;\}\)\(\);/.test(detail), '"Üretim" is left out of the facts when the prestige line already says it.');
check(!/representativeNote|Temsili/.test(detail), 'No "Temsili" caption under the photo.');
check(/withoutRepeatedSentences\(ed\('about',1200\),\[storyText\]\)/.test(detail) && /\['Paket',packLine\?'':/.test(detail), 'No sentence or pack line is repeated on the page.');

// 2. Title, price and pack.
check(/const detailName=cleanTitle\(safeText\(detail\.name,300\)\)\|\|'Ürün';/.test(detail) && /function cleanTitle\(value:string\)\{return value\.replace\(\/\\s\*\\\(\[\^\)\]\*\\\)\/g,''\)/.test(detail), 'The title never shows a parenthesised qualifier.');
check(/const digits=minor%100===0\?0:2;/.test(detail) && !/function money\(/.test(detail), 'Prices drop ",00" for whole amounts and keep kuruş otherwise.');
check(/1\\s\*adet/.test(detail) && !/\{quantity\} adet/.test(detail) && !/go-dock-summary/.test(detail), 'The pack line and the bottom bar never say "1 adet".');
check(/<span className="go-price-card__pack">\{packLine\}<\/span>|className="go-price-card__pack"[^>]*>\{packLine\}/.test(jsx), 'The pack line sits under the price.');

// 3. Buttons: one filled primary (Sepete Ekle), one quiet second action (Hemen Al), gifting as its own card; flows unchanged.
const actions = jsx.slice(jsx.indexOf('className="go-buy__actions'), jsx.indexOf('</section>', jsx.indexOf('className="go-buy__actions')));
check(actions.indexOf('product-detail-commerce-cart go-buy__primary') >= 0 && actions.indexOf('product-detail-commerce-buy') >= 0 && actions.indexOf('product-detail-commerce-buy') < actions.indexOf('product-detail-commerce-cart') && actions.indexOf('product-detail-commerce-cart') < actions.indexOf('product-detail-commerce-gift go-gift-card__button'), 'The bar holds the quiet "Hemen Al" and the primary "Sepete Ekle"; "Hediye Et" is a card of its own under the purchase details.');
check(/onClick=\{\(\)=>void addToCart\(\)\}/.test(actions) && /onClick=\{\(\)=>void buyNow\(\)\}/.test(actions) && /onClick=\{\(\)=>void giftNow\(\)\}/.test(actions), 'Each button keeps its own flow (cart, buy now, gift).');

// 4. Removed clutter stays removed.
check(!/experience\.kicker/.test(jsx) && !/kategorisini aç/.test(detail) && !/kind:'story'/.test(detail) && !/Etiketler/.test(detail), 'No category chip, kicker, story slide or tag chips on the product page.');
check(!/go-artwork__note/.test(read('src/features/catalog/ProductArtwork.tsx')), 'No "Temsili görsel" badge on top of the photo.');
const configurator = read('src/features/catalog/PremiumOrderConfigurator.tsx');
check(!/Sana göre hazırlansın|Sparkles/.test(configurator) && /Hazırlama tercihleri/.test(configurator), '"Hazırlama tercihleri" is a calm row inside the purchase area.');

// 5. Editorial content for all 50 products.
const editorial = JSON.parse(read('catalog/product-editorial/product-editorial.v1.json'));
const rows = editorial.rows || [];
check(rows.length === 50, `Editorial content must cover all 50 products, found ${rows.length}.`);
const MEDICAL = /şifa|tedavi|iyileştir|hastalı|bağışıklı|kanser|ilaç gibi|mucize|detoks/i;
// Prestige line: place · production · trait, one per product.
const prestigeRows = JSON.parse(read('catalog/product-editorial/product-prestige.v1.json')).rows || [];
const prestigeById = new Map(prestigeRows.map(row => [row.id, row.prestige]));
check(prestigeRows.length === 50 && prestigeById.size === 50, `The prestige line must cover all 50 products, found ${prestigeById.size}.`);
for (const row of prestigeRows) {
  const parts = String(row.prestige || '').split(' · ');
  check(parts.length === 3 && parts.every(part => part.trim() && part === part.trim()) && !MEDICAL.test(row.prestige), `${row.slug}: the prestige line is "place · production · trait" without health claims.`);
}
check(prestigeRows.find(row => row.slug === 'isli-kaya-uzumleri-tane-kuru-506')?.prestige === 'Yüksekova · Odun isiyle geleneksel kurutma · Sınırlı hasat', 'İsli Kaya Üzümü (506) reads "Yüksekova · Odun isiyle geleneksel kurutma · Sınırlı hasat".');
{
  const migration = read('supabase/migrations/20261003150000_product_editorial_prestige_v1.sql');
  const embedded = migration.match(/\$prestige\$(\[[\s\S]*?\])\$prestige\$/);
  check(Boolean(embedded) && /'formerName','prestige'\]/.test(migration) && /create or replace function private\.get_public_product_detail_v12/.test(migration), 'The prestige migration returns editorial.prestige from the detail RPC and embeds the lines.');
  if (embedded) for (const item of JSON.parse(embedded[1])) check(prestigeById.get(item.id) === item.prestige, `${item.slug}: the prestige migration and the file must hold the same line.`);
}
// Return, dispatch and cold-chain lines moved into each product's record
// (20261003200000_product_page_content_v1), backfilled with the values the
// page computed, so the page reads the same.
const terms = JSON.parse(read('catalog/product-editorial/product-page-terms.v1.json'));
const termsById = new Map(terms.map(item => [item.id, item]));
check(terms.length === 50 && terms.every(item => typeof item.returnText === 'string' && item.returnText && typeof item.dispatchText === 'string' && item.dispatchText && typeof item.coldChain === 'boolean'), 'Every product carries its return text, dispatch text and cold-chain flag.');
const ids = new Set();
for (const row of rows) {
  const e = row.editorial || {};
  ids.add(row.id);
  check(row.name && !/[()]/.test(row.name), `${row.slug}: the name must be short and without parentheses.`);
  for (const key of ['subtitle', 'tagline', 'pack', 'about', 'origin', 'production', 'formerName']) check(typeof e[key] === 'string' && e[key].trim(), `${row.slug}: editorial.${key} is missing.`);
  check(!/^\s*1\s*adet\b/i.test(e.pack || ''), `${row.slug}: the pack line must not start with "1 adet".`);
  check(!/[()]/.test(e.subtitle || '') && (e.tagline || '').endsWith('.'), `${row.slug}: subtitle without parentheses, tagline as one full sentence.`);
  for (const key of ['subtitle', 'tagline', 'about', 'production', 'ingredients']) check(!MEDICAL.test(e[key] || ''), `${row.slug}: editorial.${key} must make no health or healing claim.`);
  const offline = path.join('public/offline-catalog/product', `${row.slug}.json`);
  if (fs.existsSync(offline)) {
    const copy = JSON.parse(read(offline));
    check(copy.name === row.name, `${row.slug}: the shipped offline copy must carry the new name.`);
    const t = termsById.get(row.id) || {};
    check(same(copy.editorial, { ...e, prestige: prestigeById.get(row.id), returnText: t.returnText, dispatchText: t.dispatchText, coldChain: t.coldChain }), `${row.slug}: the shipped offline copy must carry the same editorial text, prestige line and page terms.`);
    check(same(copy.shipping, { mode: 'default', feeMinor: 0 }), `${row.slug}: the shipped offline copy must carry the default shipping rule.`);
  } else failures.push(`${row.slug}: no shipped offline copy.`);
}
check(ids.size === 50, 'Editorial rows must have unique product ids.');

// 6. The database side: the detail RPC returns the editorial text, old names
// stay searchable, and the migration wrote exactly this content.
const migration = read('supabase/migrations/20261003050000_product_editorial_v1.sql');
check(/create or replace function private\.get_public_product_detail_v12/.test(migration) && /select private\.get_public_product_detail_v12\(p_reference\)/.test(migration), 'The public product detail returns the editorial text (detail v12).');
check(/specifications->'editorial'->>'formerName'/.test(migration) && /'formerName'/.test(migration), 'The previous names stay searchable (search text and catalogue cards).');
{
  const embedded = migration.match(/\$editorial\$(\[[\s\S]*?\])\$editorial\$/);
  check(Boolean(embedded), 'The migration embeds the editorial rows.');
  if (embedded) {
    const list = JSON.parse(embedded[1]);
    const byId = new Map(list.map(item => [item.id, item]));
    for (const row of rows) {
      const item = byId.get(row.id);
      check(item && item.slug === row.slug && item.name === row.name && same(item.editorial, row.editorial), `${row.slug}: the migration and the editorial file must hold the same text.`);
    }
  }
}
const offlineCatalog = read('src/lib/offlineCatalog.ts');
check(/item\.formerName, item\.shortDescription/.test(offlineCatalog) && /item\.formerName && trLower\(item\.formerName\)\.includes\(query\)/.test(offlineCatalog), 'Offline search and suggestions also match the previous product names.');

if (failures.length) { console.error('Product detail editorial contract audit failed:'); for (const f of failures) console.error(`- ${f}`); process.exit(1); }
console.log(`Product detail editorial contract audit passed: section order, clean titles, "320 TL" prices, pack lines without "1 adet", calm buttons and editorial text for ${rows.length} products in the file, the migration and the offline copy.`);
