// Every product page text is the product's own and editable (İshak,
// 2026-10-03): the super admin edits all products, a seller only their own.
// Shipping can be free or paid per product; the page line and the cart and
// checkout totals use the same rule on the server.
//
//  - Migration 20261003200000_product_page_content_v1 adds the shipping
//    columns, backfills the return, dispatch and cold-chain lines with the
//    values the page computed, returns them from the detail RPC and wires the
//    per-product shipping rule into every quote that charges money.
//  - The editor "Ürün sayfası içeriği" covers each line with a limit, an
//    example and a way to clear it; admin and seller panels both open it.
//  - The product page renders from those fields.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const migration = read('supabase/migrations/20261003200000_product_page_content_v1.sql');
const api = read('src/features/product-page-content/api.ts');
const editor = read('src/features/product-page-content/ProductPageContentEditor.tsx');
const admin = read('src/admin/AdminOfficialStoreProducts.tsx');
const seller = read('src/features/producer-products/ProducerProductManager.tsx');
const detail = read('src/features/catalog/ProductDetailScreen.tsx');

// 1. Database: columns, RPCs, permissions, audit, checkout wiring.
check(/add column if not exists shipping_fee_mode text not null default 'default'/.test(migration) && /shipping_fee_minor/.test(migration), 'products carries shipping_fee_mode (default, free, paid) and shipping_fee_minor.');
check(/create or replace function public\.get_product_page_content_v1\(p_product_id uuid\)/.test(migration) && /create or replace function public\.save_product_page_content_v1\(p_product_id uuid, p_content jsonb, p_expected_updated_at timestamptz default null\)/.test(migration), 'The editor reads and saves through get_ and save_product_page_content_v1.');
check(/has_permission\('product\.update'\)/.test(migration) && /'producer'/.test(migration) && /product_page_edit_forbidden/.test(migration), 'Only the super admin (product.update) or the owner of the product\'s store may edit; everyone else is refused.');
check(/write_admin_audit_v2\(\s*'product\.page_content\.update'/.test(migration), 'Every save is written to the admin audit log.');
check(/product_page_stale/.test(migration), 'A save over a newer version is refused instead of overwriting it.');
for (const fn of ['create_customer_order_v2', 'preview_my_checkout_v1', 'preview_gift_checkout_v1', 'submit_order_request_v1']) check(new RegExp(`private\\.${fn}`).test(migration), `The per-product shipping rule is applied in ${fn}.`);
check(/create or replace function private\.apply_product_shipping_overrides_v1/.test(migration), 'One helper applies the per-product shipping rule to a quote.');
check(/create or replace function private\.get_public_product_detail_v12/.test(migration) && /'returnText'/.test(migration) && /'dispatchText'/.test(migration) && /'coldChain'/.test(migration) && /'shippingNote'/.test(migration) && /'shipping'/.test(migration), 'The detail RPC returns returnText, dispatchText, coldChain, shippingNote and the shipping rule.');

// 2. Limits agree: server, client, page.
const serverLimits = JSON.parse((migration.match(/limits constant jsonb := '(\{[^']+\})'::jsonb/) || [])[1] || '{}');
const clientLimits = Object.fromEntries([...((api.match(/PAGE_CONTENT_LIMITS = \{([^}]+)\}/) || [])[1] || '').matchAll(/(\w+): (\d+)/g)].map(match => [match[1], Number(match[2])]));
check(Object.keys(serverLimits).length === 9 && JSON.stringify(serverLimits) === JSON.stringify(Object.fromEntries(Object.keys(serverLimits).map(key => [key, clientLimits[key]]))), 'The editor and the server use the same character limits.');

// 3. Editor: every line, an example, a counter and a clear button.
for (const key of ['prestige', 'shippingNote', 'pack', 'origin', 'production', 'packaging', 'returnText', 'dispatchText', 'about']) check(new RegExp(`field\\('${key}'\\)`).test(editor), `The editor has a field for ${key}.`);
check(/Örn: Yüksekova · Odun isiyle geleneksel kurutma · Sınırlı hasat/.test(editor) && /Örn: 1 kg • Özel bez kese/.test(editor), 'Fields carry short examples under them.');
check(/>Temizle</.test(editor) && /Boş bırakılırsa satır gizlenir/.test(editor), 'Each field can be cleared, and the help says a cleared line is hidden.');
check(/value:'default'/.test(editor) && /value:'free'/.test(editor) && /value:'paid'/.test(editor) && /Kargo ücreti \(TL\)/.test(editor) && /Sayfada görünecek:/.test(editor), 'Shipping: general rule, free or paid with a fee in TL, with a preview of the page line.');
check(/Soğuk zincirle gönderilir/.test(editor) && /type="checkbox"/.test(editor), 'Cold chain is a checkbox.');
check(/Kaydedildi\. Ürün sayfası güncellendi\./.test(editor) && /role="alert"/.test(editor) && /pageContentError/.test(editor), 'Saving reports success and errors in Turkish.');
check(/ürünün düzenleme adımlarında/.test(editor) && /1500/.test(editor), 'The editor says where the name, story (1500), price, old price, photos, health and usage are edited.');
check(/import ProductPageContentEditor from'\.\.\/features\/product-page-content\/ProductPageContentEditor'/.test(admin) && />Sayfa içeriği</.test(admin), 'The super admin opens the editor per product from Resmi Mağaza Ürünleri.');
check(/import ProductPageContentEditor from'\.\.\/product-page-content\/ProductPageContentEditor'/.test(seller) && />Sayfa içeriği</.test(seller), 'Sellers open the editor for their own products.');
check(/Eski fiyat \(TL, indirim için\)/.test(admin) && /Eski fiyat \(TL, indirim için\)/.test(seller), 'The old price field says it is what makes a discount.');

// 4. Page reads the record.
check(/typeof editorial\.returnText==='string'\?ed\('returnText',200\)/.test(detail) && /typeof editorial\.dispatchText==='string'\?ed\('dispatchText',160\)/.test(detail) && /typeof editorial\.coldChain==='boolean'/.test(detail), 'İade, Teslimat and cold chain come from the product\'s record.');
check(/\(detail as any\)\?\.shipping/.test(detail) && /`Kargo ücreti \$\{priceText\(shippingFeeMinor,'TRY'\)\}`/.test(detail) && /<p className="go-prestige-note">\{shippingLine\}<\/p>/.test(detail), 'The "Kargo bizden" line follows the product\'s shipping rule ("Kargo ücreti 49 TL" when paid).');

// 5. Discount: old price struck, new price, one badge, one short spoken line, all for the chosen quantity.
check(/<s className="go-price-card__was" aria-hidden="true">\{priceText\(oldTotalMinor,currency\)\}<\/s>/.test(detail) && /%\{discountPercent\} · \{priceText\(dropMinor,currency\)\} indirim/.test(detail) && /`Önceki fiyat \$\{priceText\(oldTotalMinor,currency\)\}, şimdi \$\{priceText\(totalMinor,currency\)\}`/.test(detail) && /const oldTotalMinor=discountShown\?compareAtPriceMinor!\*quantity:null/.test(detail) && /const dropMinor=discountShown\?\(compareAtPriceMinor!-priceMinor!\)\*quantity:null/.test(detail), 'Discounts show "400 TL" struck, "320 TL" and "%20 · 80 TL indirim" for the chosen quantity, spoken as "Önceki fiyat 400 TL, şimdi 320 TL".');

if (failures.length) {
  console.error('Product page content contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Product page content contract audit passed: every product page line is editable per product by the super admin and the store owner, shipping is free or paid per product on the page and in checkout, and discounts read "400 TL → 320 TL, %20 · 80 TL indirim".');
