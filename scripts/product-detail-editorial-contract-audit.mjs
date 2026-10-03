// The editorial product page, as İshak described it on 2026-10-03.
//
// One shared page for every product, in this order:
//   photo (gallery with a slim slide bar) -> prestige line ("Yüksekova · Odun
//   isiyle geleneksel kurutma · Sınırlı hasat") -> title -> subtitle -> price
//   + pack -> "Kargo ve teslimat bilgisi" -> buttons -> "Bu ürünün hikâyesi"
//   -> "Ürün bilgileri ve özellikleri" -> four facts (Kökeni, Üretim,
//   İçindekiler, Ambalaj) -> "Sağlık bilgileri" -> "Nasıl tüketilir?"
//   -> "Üreticisini tanı" -> reviews -> "Bu ürünün yanına yakışanlar".
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
  ['title', '<h1 id="product-detail-title"'],
  ['subtitle', 'className="go-buybox__subtitle"'],
  ['price', 'className="go-price-card__price"'],
  ['pack', 'className="go-price-card__pack"'],
  ['Kargo ve teslimat bilgisi', '<DetailAccordion id="delivery" title="Kargo ve teslimat bilgisi"'],
  ['buttons', 'className="go-buy__actions product-detail-commerce-dock"'],
  ['Bu ürünün hikâyesi', '<DetailAccordion id="story" title="Bu ürünün hikâyesi"'],
  ['Ürün bilgileri ve özellikleri', '<DetailAccordion id="info" title="Ürün bilgileri ve özellikleri"'],
  ['facts', '<dl className="go-facts"'],
  ['Sağlık bilgileri', "<DetailAccordion id=\"safety\" title={isNonFood?'Güvenli kullanım':'Sağlık bilgileri'}"],
  ['Nasıl tüketilir?', "<DetailAccordion id=\"usage\" title={isNonFood?'Nasıl kullanılır?':'Nasıl tüketilir?'}"],
  ['Üreticisini tanı', '>Üreticisini tanı</h2>'],
  ['reviews', '<DetailAccordion id="reviews" title="Müşteri Yorumları"'],
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
  check(/getProductRecommendations\(/.test(shelf) && /<CatalogProductCard [\s\S]{0,400}? compact\/>/.test(shelf) && /Bu ürünün yanına yakışanlar/.test(shelf), 'The recommendations shelf uses the product-based recommendations and the category page cards (square photo).');
}
check(/\{showHealth\?<DetailAccordion id="safety"/.test(jsx) && /hasHealthInfo\(safetyContent\)/.test(detail), '"Sağlık bilgileri" shows only when the product has health content.');
check(/\['Kökeni',ed\('origin',120\)\],\['Üretim',productionFact\],\[ed\('ingredientsLabel',40\)\|\|'İçindekiler',ed\('ingredients',200\)\],\['Ambalaj',ed\('packaging',120\)\]\][^;]*\.filter\(\(\[,value\]\)=>value\)/.test(detail), 'The facts block lists Kökeni, Üretim, İçindekiler and Ambalaj, each only when the product record has it.');
check(/const productionFact=\(\(\)=>\{const value=ed\('production',160\);return value&&mostlyCovered\(value,prestigeParts\.join\(' '\)\)\?'':value;\}\)\(\);/.test(detail), '"Üretim" is left out of the facts when the prestige line already says it.');
check(!/representativeNote|Temsili/.test(detail), 'No "Temsili" caption under the photo.');
check(/withoutRepeatedSentences\(ed\('about',1200\),\[storyText\]\)/.test(detail) && /\['Paket',packLine\?'':/.test(detail), 'No sentence or pack line is repeated on the page.');

// 2. Title, price and pack.
check(/const detailName=cleanTitle\(safeText\(detail\.name,300\)\)\|\|'Ürün';/.test(detail) && /function cleanTitle\(value:string\)\{return value\.replace\(\/\\s\*\\\(\[\^\)\]\*\\\)\/g,''\)/.test(detail), 'The title never shows a parenthesised qualifier.');
check(/const digits=minor%100===0\?0:2;/.test(detail) && !/function money\(/.test(detail), 'Prices drop ",00" for whole amounts and keep kuruş otherwise.');
check(/1\\s\*adet/.test(detail) && !/\{quantity\} adet/.test(detail) && !/go-dock-summary/.test(detail), 'The pack line and the bottom bar never say "1 adet".');
check(/<span className="go-price-card__pack">\{packLine\}<\/span>|className="go-price-card__pack"[^>]*>\{packLine\}/.test(jsx), 'The pack line sits under the price.');

// 3. Buttons: one large primary, two quiet secondary; flows unchanged.
const actions = jsx.slice(jsx.indexOf('className="go-buy__actions'), jsx.indexOf('</section>', jsx.indexOf('className="go-buy__actions')));
check(actions.indexOf('product-detail-commerce-cart go-buy__primary') >= 0 && actions.indexOf('product-detail-commerce-cart') < actions.indexOf('product-detail-commerce-buy') && actions.indexOf('product-detail-commerce-buy') < actions.indexOf('product-detail-commerce-gift'), 'Sepete Ekle is the primary button, followed by Hemen Satın Al and Hediye Et.');
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
    check(same(copy.editorial, { ...e, prestige: prestigeById.get(row.id) }), `${row.slug}: the shipped offline copy must carry the same editorial text and prestige line.`);
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
