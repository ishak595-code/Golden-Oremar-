// Representative product photos contract audit.
//
// Every slug in the generated manifest has both shipped sizes, the photo is
// only a fallback (a real uploaded photo wins), no photo disclaimer is shown
// to customers, and the hosting rules serve the folder as files with caching
// instead of the app shell.

import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (text, pattern, message) => { if (!(pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern))) failures.push(message); };

const manifest = read('src/features/media/productPhotoManifest.ts');
const slugs = [...manifest.matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1]);
for (const slug of slugs) for (const file of [`${slug}.webp`, `${slug}-480.webp`]) {
  const full = `public/product-photos/${file}`;
  if (!fs.existsSync(full) || fs.statSync(full).size < 2000) failures.push(`Manifest lists ${slug} but ${full} is missing or empty.`);
}
const sources = JSON.parse(read('scripts/product-photos/sources.json'));
if (!Array.isArray(sources) || sources.some(entry => !/^[a-z0-9][a-z0-9-]{1,200}$/.test(String(entry?.slug || '')))) failures.push('sources.json must be a list of { slug, url } with safe slugs.');

const artwork = read('src/features/catalog/ProductArtwork.tsx');
// 2026-10-03: the label is no longer stamped on the photo, and (round 2, at
// İshak's request) no "Temsili" caption or other photo disclaimer is shown
// anywhere a customer looks.
if (/go-artwork__note/.test(artwork)) failures.push('The "Temsili görsel" badge must not sit on top of the photo.');
{
  const gallery = read('src/features/catalog/ProductGallery.tsx');
  if (/go-gallery__note|representativeNote/.test(gallery) || /representativeNote=/.test(read('src/features/catalog/ProductDetailScreen.tsx'))) failures.push('No caption under the product photos.');
  // Customer-facing copy (strings in the storefront code) carries no photo disclaimer.
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const DISCLAIMER = /['"`>][^'"`<]*(Temsili|temsili görsel|sahte değildir|gerçeği gelene)[^'"`<]*['"`<]/;
  for (const file of walk('src').filter(f => /\.(tsx?|jsx?)$/.test(f))) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (DISCLAIMER.test(code)) failures.push(`${file}: no "Temsili" or similar photo disclaimer in customer-facing text.`);
  }
}
need(artwork, "/product-photos/${key}", 'Shipped photos must come from public/product-photos.');
need(read('src/features/catalog/ProductGallery.tsx'), /slide\.kind==='artwork'[\s\S]{0,200}<ProductArtwork[^>]*slug=\{productSlug\}/, 'The gallery must use the shipped photo only in place of the drawn artwork, never over a real photo.');
need(read('vercel.json'), 'product-photos/|', 'The SPA fallback must not answer for /product-photos/.');
need(read('vercel.json'), '"source": "/product-photos/(.*)"', '/product-photos/ must have cache headers.');
need(read('vite.config.ts'), "/^\\/product-photos\\//", 'The service worker must not serve the app shell for /product-photos/.');
need(read('.github/workflows/product-photos-import.yml'), 'node scripts/product-photos/import.mjs', 'The import workflow must run the import script.');
// Second (origin) photo: same pipeline, its own folder and manifest; the
// gallery shows it as slide 2 only when the file has been shipped.
need(read('scripts/product-photos/import.mjs'), "entry.kind === 'origin' ? ORIGIN_OUT : OUT", 'Origin photos are imported into public/product-photos/origin.');
need(read('.github/workflows/product-photos-import.yml'), 'src/features/media/productOriginPhotoManifest.ts', 'The import workflow commits the origin photo manifest.');
{
  const originManifest = read('src/features/media/productOriginPhotoManifest.ts');
  for (const slug of [...originManifest.matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1])) for (const file of [`${slug}.webp`, `${slug}-480.webp`]) {
    const full = `public/product-photos/origin/${file}`;
    if (!fs.existsSync(full) || fs.statSync(full).size < 2000) failures.push(`Origin manifest lists ${slug} but ${full} is missing or empty.`);
  }
  const prompts = JSON.parse(read('scripts/product-photos/origin-prompts.json'));
  if (!Array.isArray(prompts.products) || prompts.products.length < 50 || prompts.products.some(entry => !/^[a-z0-9][a-z0-9-]{1,200}$/.test(String(entry?.slug || '')) || !/no people's faces/i.test(String(entry?.prompt || '')))) failures.push('origin-prompts.json must hold one prompt per product (slug + prompt, no faces).');
}
need(read('src/features/catalog/ProductDetailScreen.tsx'), /ORIGIN_PHOTOS\.has\(originSlug\)\)gallerySlides\.splice\(1,0,\{kind:'scene'/, 'The origin photo is the second slide, and only when it has been shipped.');

if (failures.length) { console.error('Product photos contract audit failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`Product photos contract audit passed: ${slugs.length} shipped photo(s) present in both sizes, used only as a fallback without any disclaimer, served as cached files.`);
