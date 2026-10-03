// The editorial product page, as İshak described it on 2026-10-03.
//
// One shared page for every product, in this order:
//   photo (gallery) -> title -> subtitle -> price + pack -> one-line tagline
//   -> "Köyden sofranıza" + "Kargo ve teslimat bilgisi" -> buttons
//   -> "Bu ürünün hikâyesi" -> "Ürün bilgileri ve özellikleri" -> four facts
//   (Kökeni, Üretim, İçindekiler, Ambalaj) -> "Sağlık bilgileri"
//   -> "Nasıl tüketilir?" -> "Üreticisini tanı" -> reviews, last.
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
  ['title', '<h1 id="product-detail-title"'],
  ['subtitle', 'className="go-buybox__subtitle"'],
  ['price', 'className="go-price-card__price"'],
  ['pack', 'className="go-price-card__pack"'],
  ['tagline', 'className="go-buybox__tagline"'],
  ['Köyden sofranıza', "'Köyden sofranıza'"],
  ['Kargo ve teslimat bilgisi', '<DetailAccordion id="delivery" title="Kargo ve teslimat bilgisi"'],
  ['buttons', 'className="go-buy__actions product-detail-commerce-dock"'],
  ['Bu ürünün hikâyesi', '<DetailAccordion id="story" title="Bu ürünün hikâyesi"'],
  ['Ürün bilgileri ve özellikleri', '<DetailAccordion id="info" title="Ürün bilgileri ve özellikleri"'],
  ['facts', '<dl className="go-facts"'],
  ['Sağlık bilgileri', "<DetailAccordion id=\"safety\" title={isNonFood?'Güvenli kullanım':'Sağlık bilgileri'}"],
  ['Nasıl tüketilir?', "<DetailAccordion id=\"usage\" title={isNonFood?'Nasıl kullanılır?':'Nasıl tüketilir?'}"],
  ['Üreticisini tanı', '>Üreticisini tanı</h2>'],
  ['reviews', '<DetailAccordion id="reviews" title="Müşteri Yorumları"'],
];
let last = -1;
for (const [name, marker] of order) {
  const at = jsx.indexOf(marker);
  check(at >= 0, `The product page is missing "${name}".`);
  check(at > last, `"${name}" is out of order on the product page.`);
  if (at >= 0) last = at;
}
const afterReviews = jsx.slice(jsx.indexOf('<DetailAccordion id="reviews"'));
check(!/<DetailAccordion id=|<section /.test(afterReviews.slice(afterReviews.indexOf('</DetailAccordion>'))), 'Reviews are the last section of the product page.');
check(/\{showHealth\?<DetailAccordion id="safety"/.test(jsx) && /hasHealthInfo\(safetyContent\)/.test(detail), '"Sağlık bilgileri" shows only when the product has health content.');
check(/\['Kökeni',ed\('origin',120\)\],\['Üretim',ed\('production',160\)\],\[ed\('ingredientsLabel',40\)\|\|'İçindekiler',ed\('ingredients',200\)\],\['Ambalaj',ed\('packaging',120\)\]\][^;]*\.filter\(\(\[,value\]\)=>value\)/.test(detail), 'The facts block lists Kökeni, Üretim, İçindekiler and Ambalaj, each only when the product record has it.');
check(/representativeNote=/.test(jsx) && jsx.indexOf('representativeNote=') < jsx.indexOf('<h1 id="product-detail-title"'), 'The representative-photo caption belongs to the gallery, above the title.');

// 2. Title, price and pack.
check(/const detailName=cleanTitle\(safeText\(detail\.name,300\)\)\|\|'Ürün';/.test(detail) && /function cleanTitle\(value:string\)\{return value\.replace\(\/\\s\*\\\(\[\^\)\]\*\\\)\/g,''\)/.test(detail), 'The title never shows a parenthesised qualifier.');
check(/const digits=minor%100===0\?0:2;/.test(detail) && !/function money\(/.test(detail), 'Prices drop ",00" for whole amounts and keep kuruş otherwise.');
check(/1\\s\*adet/.test(detail) && !/\{quantity\} adet/.test(detail) && !/go-dock-summary/.test(detail), 'The pack line and the bottom bar never say "1 adet".');
check(/<span className="go-sticky-buy__pack">\{quantity>1\?`\$\{quantity\} × `:''\}\{packLine\}<\/span>/.test(jsx), 'The bottom bar shows the pack line and the price.');

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
    check(same(copy.editorial, e), `${row.slug}: the shipped offline copy must carry the same editorial text.`);
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
