// The repo can rebuild the production schema (closed 2026-10-01).
//
// Before: 157 live migrations were missing from the repo and 21 public
// functions were created by no repo migration, so a lost database or a test
// project could not be rebuilt from git. Now supabase/schema/baseline.sql is
// the exact live application schema, generated from the catalogue and proven
// equal to production fact by fact (scripts/schema/rebuild-check.mjs, run in
// CI by .github/workflows/schema-rebuild.yml on a plain Postgres 17).
// This audit keeps the pieces consistent without needing a database.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const meta = JSON.parse(fs.readFileSync('supabase/schema/baseline.json', 'utf8'));
const baseline = fs.readFileSync('supabase/schema/baseline.sql', 'utf8');
const fingerprint = JSON.parse(fs.readFileSync('supabase/schema/live_fingerprint.json', 'utf8')).fingerprint;

check(/^-- Golden Oremar application schema baseline\./.test(baseline), 'baseline.sql must be the generated file (header missing).');
check(/set check_function_bodies = off;/.test(baseline), 'baseline.sql must create functions with body checks off, as pg_dump does.');
const tables = (baseline.match(/^create table /gm) || []).length;
const functions = (baseline.match(/^CREATE OR REPLACE FUNCTION /gm) || []).length;
const factTables = Object.keys(fingerprint).filter(k => k.startsWith('table ') && k.endsWith(' rls')).length;
const factFunctions = Object.keys(fingerprint).filter(k => k.startsWith('function ') && !k.endsWith(' acl')).length;
check(Object.keys(fingerprint).length === meta.facts, `live_fingerprint.json has ${Object.keys(fingerprint).length} facts, baseline.json says ${meta.facts}.`);
check(tables === factTables, `baseline.sql creates ${tables} tables, the live fingerprint has ${factTables}.`);
check(functions === factFunctions, `baseline.sql creates ${functions} functions, the live fingerprint has ${factFunctions}.`);
check(/^\d{14}$/.test(meta.coversRepoMigrationsThrough), 'baseline.json must name the last repo migration the baseline contains.');
check(fs.existsSync('.github/workflows/schema-rebuild.yml') && /rebuild-check\.mjs/.test(fs.readFileSync('.github/workflows/schema-rebuild.yml', 'utf8')), 'CI must run scripts/schema/rebuild-check.mjs.');
check(!fs.readdirSync('supabase/migrations').some(f => /replay_shim/.test(f)), 'The replay shim is for local rebuilds only; it must never be a migration.');
// Privileges are part of the schema: nothing in private may be granted to anon.
check(!/grant [^;]* on (table|function) private\.[^;]* to anon;/i.test(baseline), 'baseline.sql grants anon access to a private object; the live schema must be fixed first.');

if (failures.length) {
  console.error('Schema baseline contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Schema baseline contract audit passed: ${tables} tables and ${functions} functions match the live fingerprint (${meta.facts} facts); repo migrations through ${meta.coversRepoMigrationsThrough} are contained in the baseline.`);
