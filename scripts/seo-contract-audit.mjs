// SEO contract audit.
//
// Executes src/features/seo/seoModel.ts and locks in the properties that must
// not regress. The most important is escaping: product names and
// descriptions are written by producers and end up inside prerendered HTML
// and a <script type="application/ld+json"> block. A "simplification" of the
// escaping helpers would turn the build step into a stored-XSS vector, and
// nothing else in the test suite would notice.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const source = fs.readFileSync('src/features/seo/seoModel.ts', 'utf8');
const { code } = await transformWithEsbuild(source, 'seoModel.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-seo-audit-'));
const file = path.join(dir, 'seoModel.mjs');
fs.writeFileSync(file, code);
const seo = await import(pathToFileURL(file).href);
fs.rmSync(dir, { recursive: true, force: true });

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const ORIGIN = 'https://goldenoremar.com';
const hostile = '</script><script>alert(1)</script>"><img src=x onerror=alert(1)>';

// Escaping: JSON-LD must be unbreakable and still valid JSON.
const serialized = seo.serializeJsonLd({ name: hostile });
check(!/<\/script/i.test(serialized), 'serializeJsonLd must never emit a literal </script.');
check(!/[<>&]/.test(serialized), 'serializeJsonLd must escape <, > and &.');
check(JSON.parse(serialized).name === hostile, 'serializeJsonLd must round-trip the original value unchanged.');
check(!/[<>"']/.test(seo.escapeHtml(hostile)), 'escapeHtml must neutralise < > " and \'.');

// The rendered head for a hostile product must contain no executable markup.
const base = { slug: 'x', name: hostile, description: hostile, imageUrl: null, priceMinor: 1000, currency: 'TRY', availability: 'in_stock', brandName: hostile, categoryName: null, categorySlug: null, ratingAverage: null, ratingCount: 0 };
const head = seo.renderHeadTags(seo.productSeo(base, ORIGIN));
check(!/<script>alert/i.test(head) && !/<img\s/i.test(head), 'renderHeadTags must not emit injected markup from product data.');

// Slugs become directories at build time.
for (const bad of ['../../etc/passwd', '..', '/abs', 'a/b', '', ' ', 'a b']) check(!seo.isSafeSlug(bad), `isSafeSlug must reject ${JSON.stringify(bad)}.`);
check(seo.isSafeSlug('bal-1.5kg'), 'isSafeSlug must accept dotted slugs.');

// Structured data correctness.
const product = seo.productSeo({ ...base, name: 'Bal', description: 'Bal', priceMinor: 320000 }, ORIGIN).jsonLd.find(block => block['@type'] === 'Product');
check(product.offers?.price === '3200.00', 'Offer price must be priceMinor / 100 with two decimals.');
check(!('aggregateRating' in product), 'A product with no reviews must not claim an aggregateRating.');
const noPrice = seo.productSeo({ ...base, priceMinor: null }, ORIGIN).jsonLd.find(block => block['@type'] === 'Product');
check(!('offers' in noPrice), 'A product without a real price must not emit an Offer.');
const byAvailability = (availability) => seo.productSeo({ ...base, availability }, ORIGIN).jsonLd.find(block => block['@type'] === 'Product').offers.availability;
check(byAvailability('out_of_stock') === 'https://schema.org/OutOfStock', 'out_of_stock must map to schema.org OutOfStock.');
check(byAvailability('preorder') === 'https://schema.org/PreOrder', 'preorder must map to schema.org PreOrder.');
check(seo.productSeo(base, ORIGIN).canonical === `${ORIGIN}/urun/x`, 'Product canonical must be /urun/<slug>.');

if (failures.length) {
  console.error('SEO contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('SEO contract audit passed: JSON-LD and attribute escaping, slug path safety, offer pricing, availability mapping and no-fake-rating rules are locked in.');
