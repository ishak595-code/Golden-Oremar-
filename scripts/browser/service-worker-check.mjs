// Checks the built service worker the way a returning customer meets it,
// with no request interception at all (Playwright's routing would sit in
// front of the worker and hide what it really does):
//
// - it installs and takes control of the page;
// - while the API is unreachable the shipped catalogue answers, and the
//   worker keeps those files in its own cache;
// - with the network gone entirely the showcase still opens from that cache.
// (That a missing catalogue or asset file answers 404 instead of the app
// shell is a Vercel rule; public-route-contract-audit locks it.)
//
// The API host is made unresolvable inside the browser, which is what a
// network failure looks like to the app.
//
//   npm run build && npx vite preview --port 4173 --strictPort &
//   BROWSER_TOOLS=... node scripts/browser/service-worker-check.mjs

import { launch, BASE } from './lib.mjs';

const failures = [];
const check = (ok, message) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`); if (!ok) failures.push(message); };

const browser = await launch(['--host-resolver-rules=MAP *.supabase.co ~NOTFOUND, MAP *.r2.dev ~NOTFOUND']);
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const controlled = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise(resolve => { navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }); setTimeout(resolve, 8000); });
  return Boolean(navigator.serviceWorker.controller);
});
check(controlled, 'The service worker installs and controls the page.');

const fetched = new Set();
page.on('response', response => { const p = new URL(response.url()).pathname; if (p.startsWith('/offline-catalog/') && response.status() === 200) fetched.add(p); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const onlineProducts = await page.locator('a[href*="/urun/"]').count();
check(onlineProducts > 0, `With the API unreachable the showcase opens from the shipped catalogue (${onlineProducts} product links).`);
const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const name = names.find(n => n.startsWith('go-offline-catalog'));
  const entries = name ? (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname) : [];
  return { names, entries };
});
check(fetched.size > 0 && [...fetched].every(p => cached.entries.includes(p)), `The worker keeps every catalogue file the page read (${fetched.size} read, ${cached.entries.length} cached: ${cached.entries.map(e => e.replace('/offline-catalog/', '')).join(', ')}).`);
check(cached.names.some(n => n.startsWith('workbox-precache')), 'The app shell is precached.');

await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const offlineProducts = await page.locator('a[href*="/urun/"]').count();
check(offlineProducts > 0, `With no network at all the showcase still opens (${offlineProducts} product links).`);
await context.setOffline(false);

check(!errors.length, `No uncaught page errors${errors.length ? `: ${errors.join(' | ')}` : ''}.`);

await browser.close();
if (failures.length) { console.error(`\n${failures.length} service worker check(s) failed.`); process.exit(1); }
console.log('\nAll service worker checks passed.');
