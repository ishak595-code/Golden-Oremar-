// Locks the catalogue card snapshot (supabase/migrations/20261001160000_*):
// public browsing reads precomputed cards, but must never show something the
// live catalogue would not. These are the properties that keep it correct.

import fs from 'node:fs';

const file = 'supabase/migrations/20261001160000_catalog_card_snapshot_v1.sql';
const sql = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const failures = [];
const need = (ok, message) => { if (!ok) failures.push(message); };

need(sql, `${file} is missing.`);
const reader = sql.slice(sql.indexOf('create or replace function private.catalog_public_card_rows_v1()'));
need(/refreshed_at > now\(\) - interval '2 minutes'/.test(reader), 'Readers must only trust a snapshot refreshed in the last 2 minutes.');
need(/else\s+return query select \* from private\.catalog_public_card_rows_live_v1\(\)/.test(reader), 'Readers must fall back to the live query when the snapshot is stale.');
for (const table of ['products', 'product_variants', 'product_images', 'categories', 'producers']) {
  need(new RegExp(`after insert or update or delete on public\\.${table} for each statement execute function private\\.mark_catalog_card_snapshot_stale_v1`).test(sql), `Edits to public.${table} must mark the snapshot stale at once.`);
}
need(/where id and version=seen_version/.test(sql), 'A rebuild must not mark itself fresh when an edit happened while it ran (version guard).');
need(/pg_try_advisory_xact_lock/.test(sql), 'Rebuilds must not run concurrently.');
need(/is distinct from \(excluded\.\*\)/.test(sql), 'Rebuilds must write only changed rows.');
need(/cron\.schedule\('golden-oremar-catalog-card-snapshot','30 seconds'/.test(sql), 'The snapshot must be rebuilt every 30 seconds.');
need(!/grant [^;]* to (anon|authenticated)/i.test(sql), 'Snapshot objects must not be granted to anon or authenticated.');

if (failures.length) { console.error('Catalogue snapshot contract audit failed:'); for (const f of failures) console.error(`- ${f}`); process.exit(1); }
console.log('Catalogue snapshot contract audit passed: fresh-or-live reads, instant invalidation on edits, race-safe rebuilds every 30 seconds, no public grants.');
