// Refreshes public/offline-catalog from the live API.
//
// The storefront answers public catalogue calls from these files when
// Supabase is unreachable or out of quota (src/lib/offlineCatalog.ts). Run this
// whenever products, prices or texts change and the API is healthy:
//
//   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... node scripts/offline-catalog/export.mjs
//
// It calls the same public RPCs the app calls, as an anonymous visitor, writes
// one file per answer and records each file's md5 (Postgres jsonb text form)
// in manifest.json, so `node scripts/offline-catalog/verify.mjs` can prove the
// shipped copy was not edited by hand afterwards.

import fs from 'node:fs';
import path from 'node:path';
import { jsonbMd5 } from './jsonb.mjs';

const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'); process.exit(1); }
const OUT = 'public/offline-catalog';
const SECTIONS = ['pre_order', 'seasonal', 'new_arrivals', 'offers', 'natural'];

async function rpc(name, args = {}) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!response.ok) throw new Error(`${name} answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

const files = {
  'brand.json': await rpc('get_public_brand_appearance_v1'),
  'home_catalog.json': await rpc('get_public_home_catalog_v3'),
  'categories.json': await rpc('list_public_categories_v2'),
  'home_experience.json': await rpc('get_public_home_experience_v1', { p_locale: 'tr' }),
  'storefront_config.json': await rpc('get_public_storefront_config_v2', { p_locale: 'tr' }),
  'contact_config.json': await rpc('get_public_contact_config_v1'),
  'events_upcoming.json': await rpc('list_public_events_v1', { p_include_past: false }),
  'events_all.json': await rpc('list_public_events_v1', { p_include_past: true }),
};
for (const key of SECTIONS) files[`sections/${key}.json`] = await rpc('get_public_home_section_v1', { p_key: key, p_locale: 'tr' });
const items = files['home_catalog.json'].items || [];
const producers = new Map();
for (const item of items) {
  files[`product/${item.slug}.json`] = await rpc('get_public_product_detail_v6', { p_reference: item.slug });
  files[`safety/${item.slug}.json`] = await rpc('get_public_product_safety_v3', { p_reference: item.slug, p_locale: 'tr' });
  if (item.producer?.id && !producers.has(item.producer.id)) {
    const profile = await rpc('get_public_producer_profile_v3', { p_reference: item.producer.id });
    producers.set(item.producer.id, profile);
  }
}
files['producers.json'] = [...producers.values()].map(profile => ({ id: profile.id, slug: profile.slug }));
for (const profile of producers.values()) files[`producer/${profile.slug}.json`] = profile;

fs.rmSync(OUT, { recursive: true, force: true });
const manifest = {};
for (const [rel, value] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), JSON.stringify(value));
  manifest[rel] = jsonbMd5(value);
}
fs.writeFileSync('scripts/offline-catalog/manifest.json', JSON.stringify({ exportedAt: new Date().toISOString().slice(0, 10), source: url, files: manifest }, null, 1) + '\n');
console.log(`Exported ${Object.keys(files).length} files (${items.length} products) into ${OUT}.`);
