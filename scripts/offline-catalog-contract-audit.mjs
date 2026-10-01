// The storefront stays browsable when the backend is down.
//
// In September 2026 every Supabase call answered 402 (quota) for weeks and the
// home page showed no products. src/lib/offlineCatalog.ts now answers public,
// read-only catalogue calls from a copy shipped in public/offline-catalog.
// This audit keeps that safety net honest:
//   - the Supabase client really goes through resilientFetch;
//   - only read-only public catalogue RPCs can be answered from the copy;
//   - the copy is complete (every product has its detail and safety file) and
//     unedited (scripts/offline-catalog/verify.mjs);
//   - the copy contains no private fields.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const client = read('src/lib/supabase.ts');
check(/import \{ resilientFetch \} from '\.\/offlineCatalog'/.test(client) && /fetch:\s*resilientFetch/.test(client), 'src/lib/supabase.ts must pass resilientFetch as global.fetch.');

const source = read('src/lib/offlineCatalog.ts');
const block = source.slice(source.indexOf('const RESOLVERS'), source.indexOf('export const OFFLINE_CATALOG_RPCS'));
const rpcs = [...block.matchAll(/^\s{2}([a-z][a-z0-9_]*):/gm)].map(m => m[1]);
check(rpcs.length >= 15, `Expected the catalogue resolvers, found ${rpcs.length}.`);
const READ_ONLY = /^(get_public_|list_public_|search_catalog_|catalog_search_|public_product_|get_product_reviews_)/;
for (const rpc of rpcs) check(READ_ONLY.test(rpc), `${rpc} is answered from the shipped copy but is not a public read-only catalogue call.`);
check(/response\.status === 402 \|\| response\.status >= 500/.test(source), 'resilientFetch must fall back only on 402 or a 5xx answer (and network errors).');
check(!/status === 4(0[0-13-9]|[1-9]\d)/.test(source), 'resilientFetch must not hide client errors such as 400, 401 or 403.');

// Files the resolvers read exist.
const OUT = 'public/offline-catalog';
for (const file of ['brand.json', 'home_catalog.json', 'categories.json', 'home_experience.json', 'storefront_config.json', 'contact_config.json', 'events_upcoming.json', 'events_all.json', 'producers.json']) {
  check(fs.existsSync(path.join(OUT, file)), `${OUT}/${file} is missing.`);
}
const home = JSON.parse(read(path.join(OUT, 'home_catalog.json')));
check(Array.isArray(home.items) && home.items.length > 0, 'The shipped home catalogue has no products.');
for (const item of home.items || []) {
  check(fs.existsSync(path.join(OUT, 'product', `${item.slug}.json`)), `Product page copy missing for ${item.slug}.`);
  check(fs.existsSync(path.join(OUT, 'safety', `${item.slug}.json`)), `Safety copy missing for ${item.slug}.`);
}
const experience = JSON.parse(read(path.join(OUT, 'home_experience.json')));
for (const section of experience.sections || []) {
  if (section.deferred) check(fs.existsSync(path.join(OUT, 'sections', `${section.key}.json`)), `Deferred home section ${section.key} has no copy.`);
}
for (const producer of JSON.parse(read(path.join(OUT, 'producers.json')))) check(fs.existsSync(path.join(OUT, 'producer', `${producer.slug}.json`)), `Producer copy missing for ${producer.slug}.`);

// Nothing private is shipped.
const all = execSync(`cat $(find ${OUT} -type f -name '*.json')`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
for (const [pattern, label] of [[/"(email|phone)":\s*"[^"]*@/i, 'e-mail fields other than the public contact card'], [/"(user_id|owner_id|auth_user_id|iban|tax_number|national_id)"/i, 'private identifiers'], [/service_role|sb_secret_/i, 'secrets']]) {
  const contact = read(path.join(OUT, 'contact_config.json'));
  const rest = all.replace(contact, '');
  check(!pattern.test(rest), `The shipped copy contains ${label}.`);
}

// Shoppers must never read that the shop is a demo or test.
check(!/\bdemo\b|\btest verisi\b/i.test(all), 'The shipped copy contains "demo" or "test verisi" wording that customers would read.');

try { execSync('node scripts/offline-catalog/verify.mjs', { stdio: 'pipe' }); }
catch (error) { failures.push(String(error.stderr || error.message).trim()); }

if (failures.length) {
  console.error('Offline catalogue contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Offline catalogue contract audit passed: ${rpcs.length} read-only calls can be answered from ${home.items.length} shipped products when the backend is down.`);
