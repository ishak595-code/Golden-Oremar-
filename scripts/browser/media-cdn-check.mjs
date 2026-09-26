// Images come from the CDN (Cloudflare R2), and fall back to Supabase.
//
// Needs a build made with a CDN base, served on another port:
//   VITE_MEDIA_CDN_BASE=https://media.cdn-test.example npx vite build --outDir dist-cdn
//   npx vite preview --outDir dist-cdn --port 4174 --strictPort &
//   APP_URL=http://localhost:4174 BROWSER_TOOLS=/tmp/go-browser node scripts/browser/media-cdn-check.mjs
//
// Three situations a customer can meet:
//   1. CDN healthy: every catalogue image comes from the CDN, zero bytes from
//      Supabase Storage (the whole point: no Supabase egress).
//   2. CDN misses (not mirrored yet, or refused by the budget): each image is
//      retried from Supabase and still shows. No placeholder.
//   3. CDN and Supabase both fail: the fallbacks that existed before (the
//      component's own "Fotoğraf yakında" or the global placeholder), never a
//      broken image icon.

import fs from 'node:fs';
import path from 'node:path';
import { BASE, FIXTURES, launch, routeSupabase } from './lib.mjs';

const CDN = 'https://media.cdn-test.example';
const image = fs.readFileSync(path.join(FIXTURES, 'product.jpg'));
const browser = await launch();
const results = [];
const record = (ok, label) => results.push([ok, label]);

async function visit(route, { cdn, origin }) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  const seen = { cdn: 0, origin: 0 };
  await routeSupabase(page);
  await page.route(`${CDN}/**`, r => { seen.cdn++; return cdn ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: image }) : r.fulfill({ status: 404, body: 'missing' }); });
  await page.route('**/storage/v1/**', r => { seen.origin++; return origin ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: image }) : r.fulfill({ status: 404, body: '{}' }); });
  await page.goto(BASE + route);
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  const images = await page.evaluate(() => [...document.images]
    .filter(img => img.getBoundingClientRect().width > 0 && !img.src.startsWith('data:image/svg'))
    .map(img => ({ src: img.currentSrc || img.src, broken: img.complete && img.naturalWidth === 0, pendingLazy: !img.complete && img.loading === 'lazy', placeholder: img.classList.contains('go-catalog-media-fallback') })));
  await context.close();
  return { seen, images };
}

for (const route of ['/kategori/bal-sifa', '/urun/daglica-karakovan-petek-bali-101', '/']) {
  const healthy = await visit(route, { cdn: true, origin: true });
  const fromCdn = healthy.images.filter(i => i.src.startsWith(CDN));
  record(healthy.seen.cdn > 0 && healthy.seen.origin === 0 && fromCdn.length > 0 && fromCdn.every(i => !i.broken),
    `${route} CDN healthy: ${fromCdn.length} images from CDN, ${healthy.seen.origin} Supabase storage requests${fromCdn.filter(i => i.broken).map(i => ` NOT LOADED ${i.src}`).join('')}`);

  const miss = await visit(route, { cdn: false, origin: true });
  const catalog = miss.images.filter(i => i.src.includes('/storage/v1/object/public/'));
  record(miss.seen.cdn > 0 && catalog.length > 0 && catalog.every(i => !i.broken) && !miss.images.some(i => i.placeholder),
    `${route} CDN miss: ${catalog.length} images recovered from Supabase, placeholders ${miss.images.filter(i => i.placeholder).length}`);

  const down = await visit(route, { cdn: false, origin: false });
  // Components with their own fallback hide the image and show "Fotoğraf
  // yakında"; the rest get the global placeholder. Either way nothing broken.
  const broken = down.images.filter(i => i.broken && !i.placeholder && (i.src.startsWith(CDN) || i.src.includes("/storage/v1/"))); // third-party thumbnails (YouTube) are blocked by the harness, not our concern here
  record(broken.length === 0 && down.seen.origin > 0,
    `${route} both down: origin tried ${down.seen.origin}x, visible broken images ${broken.length}${broken.map(i => ` [${i.src.slice(0, 120)}]`).join("")}, placeholders ${down.images.filter(i => i.placeholder).length}`);
}
await browser.close();

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(failed ? `\n${failed} media CDN check(s) failed.` : `\nAll ${results.length} media CDN checks passed.`);
process.exit(failed ? 1 : 0);
