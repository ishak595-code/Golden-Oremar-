// Refreshes public/offline-catalog from the live API.
//
// The storefront answers public catalogue calls from these files when
// Supabase is unreachable or out of quota (src/lib/offlineCatalog.ts). A
// scheduled workflow (.github/workflows/offline-catalog-refresh.yml) runs this
// every few hours, so every product, price or text a seller publishes reaches
// the copy without anyone remembering to export it. Locally:
//
//   node scripts/offline-catalog/export.mjs [--check]
//
// It calls the same public RPCs the app calls, as an anonymous visitor, with
// the public URL and publishable key the app itself ships. All calls must
// succeed before anything is written: when the API is down (402, 5xx, no
// network) the last good copy is kept untouched and the script exits 0 with
// a notice, because keeping the old copy is the correct outcome. Files whose
// content did not change are left byte for byte as they were (timestamps such
// as generatedAt alone never count as a change), so the workflow only commits
// real catalogue changes. --check exits 2 when the copy is out of date.

import fs from 'node:fs';
import path from 'node:path';
import { jsonbMd5 } from './jsonb.mjs';

const url = process.env.VITE_SUPABASE_URL || 'https://rmfcziawxjgcnxexbrvw.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_n4P4WYheJjOzgjO90Ko_jA_vh3CS8Vg';
const OUT = process.env.OFFLINE_CATALOG_DIR || 'public/offline-catalog';
const MANIFEST = process.env.OFFLINE_CATALOG_MANIFEST || 'scripts/offline-catalog/manifest.json';
const SECTIONS = ['pre_order', 'seasonal', 'new_arrivals', 'offers', 'natural'];
const checkOnly = process.argv.includes('--check');

class Unavailable extends Error {}

async function rpc(name, args = {}) {
  let response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new Unavailable(`${name}: ${error.message}`);
  }
  if (response.status === 402 || response.status >= 500) throw new Unavailable(`${name} answered ${response.status}`);
  if (!response.ok) throw new Error(`${name} answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function collect() {
  const files = {
    'brand.json': await rpc('get_public_brand_appearance_v1'),
    'home_catalog.json': await rpc('get_public_home_catalog_v3'),
    'categories.json': await rpc('list_public_categories_v2'),
    'home_experience.json': await rpc('get_public_home_experience_v1', { p_locale: 'tr' }),
    'storefront_config.json': await rpc('get_public_storefront_config_v2', { p_locale: 'tr' }),
    'contact_config.json': await rpc('get_public_contact_config_v1'),
    'offline_ordering.json': await rpc('get_public_offline_ordering_v1'),
    'events_upcoming.json': await rpc('list_public_events_v1', { p_include_past: false }),
    'events_all.json': await rpc('list_public_events_v1', { p_include_past: true }),
  };
  for (const section of SECTIONS) files[`sections/${section}.json`] = await rpc('get_public_home_section_v1', { p_key: section, p_locale: 'tr' });
  const items = Array.isArray(files['home_catalog.json']?.items) ? files['home_catalog.json'].items : [];
  if (!items.length) throw new Error('The live home catalogue is empty; refusing to replace the copy with nothing.');
  const producers = new Map();
  for (const item of items) {
    if (!/^[a-z0-9][a-z0-9._-]{0,219}$/i.test(String(item.slug || ''))) throw new Error(`Unsafe product slug: ${item.slug}`);
    files[`product/${item.slug}.json`] = await rpc('get_public_product_detail_v6', { p_reference: item.slug });
    files[`safety/${item.slug}.json`] = await rpc('get_public_product_safety_v3', { p_reference: item.slug, p_locale: 'tr' });
    const producerId = item.producer?.id;
    if (producerId && !producers.has(producerId)) producers.set(producerId, await rpc('get_public_producer_profile_v3', { p_reference: producerId }));
  }
  files['producers.json'] = [...producers.values()].map(profile => ({ id: profile.id, slug: profile.slug }));
  for (const profile of producers.values()) files[`producer/${profile.slug}.json`] = profile;
  return { files, productCount: items.length };
}

// Content identity without the timestamps that change on every call.
const VOLATILE = new Set(['generatedAt']);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([k]) => !VOLATILE.has(k)).map(([k, v]) => [k, stable(v)])) : value;

let collected;
try {
  collected = await collect();
} catch (error) {
  if (error instanceof Unavailable) {
    console.log(`Live API unavailable (${error.message}); the last good copy is kept.`);
    process.exit(0);
  }
  console.error(`Export failed: ${error.message}`);
  process.exit(1);
}

const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const existing = new Map(walk(OUT).map(file => [path.relative(OUT, file).split(path.sep).join('/'), file]));
const changed = [], removed = [];
for (const [rel, value] of Object.entries(collected.files)) {
  const file = existing.get(rel);
  let same = false;
  if (file) { try { same = jsonbMd5(stable(JSON.parse(fs.readFileSync(file, 'utf8')))) === jsonbMd5(stable(value)); } catch { same = false; } }
  if (!same) changed.push(rel);
}
for (const rel of existing.keys()) if (!(rel in collected.files)) removed.push(rel);

if (!changed.length && !removed.length) {
  console.log(`Offline catalogue is up to date (${collected.productCount} products).`);
  process.exit(0);
}
if (checkOnly) {
  console.log(`Offline catalogue is out of date: ${changed.length} changed, ${removed.length} removed.`);
  process.exit(2);
}

for (const rel of changed) {
  const target = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(collected.files[rel]));
}
for (const rel of removed) fs.rmSync(path.join(OUT, rel));
const manifest = {};
for (const rel of Object.keys(collected.files).sort()) manifest[rel] = jsonbMd5(JSON.parse(fs.readFileSync(path.join(OUT, rel), 'utf8')));
fs.writeFileSync(MANIFEST, JSON.stringify({
  exportedAt: new Date().toISOString().slice(0, 10),
  source: url,
  note: 'md5 of each file in Postgres jsonb text form, written by scripts/offline-catalog/export.mjs from the live public API.',
  files: manifest,
}, null, 1) + '\n');
console.log(`Offline catalogue refreshed: ${changed.length} file(s) changed, ${removed.length} removed, ${collected.productCount} products.`);
