// Every database function the app calls must still exist.
//
// In September 2026 the seller traceability screen still called
// get_my_producer_dashboard_v1, which a migration had dropped a month earlier
// in favour of v2. TypeScript cannot see that: the name is a string. The
// screen simply failed for every seller who opened it.
//
// The source of truth is supabase/schema/baseline.sql, the exact live schema
// (rebuilt and compared with production by scripts/schema/rebuild-check.mjs),
// plus every repo migration newer than it. A name the client passes to
// supabase.rpc must exist there and must not be dropped by a newer migration.

import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [full] : [];
  });
}

// 1. Names the client calls.
const called = new Map(); // name -> first file
for (const file of walk('src')) {
  const source = fs.readFileSync(file, 'utf8');
  const add = name => { if (!called.has(name)) called.set(name, file); };
  for (const m of source.matchAll(/\brpc\(\s*['"]([a-z][a-z0-9_]*)['"]/g)) add(m[1]);
  // A file that calls rpc with a computed name (a variable or a ternary):
  // every versioned identifier literal in it is a candidate.
  if (/\brpc\(\s*[a-zA-Z_$][\w$]*\s*[,)]/.test(source)) {
    for (const m of source.matchAll(/['"]([a-z][a-z0-9_]*_v\d+)['"]/g)) add(m[1]);
  }
}

// 2. What exists: the live schema baseline (supabase/schema/baseline.sql,
//    proven equal to production by scripts/schema/rebuild-check.mjs), then
//    every repo migration newer than it, replayed in order. Its last word on
//    a name (CREATE or DROP) wins.
const meta = JSON.parse(fs.readFileSync('supabase/schema/baseline.json', 'utf8'));
const baseline = fs.readFileSync('supabase/schema/baseline.sql', 'utf8');
const inBaseline = new Set([...baseline.matchAll(/^CREATE OR REPLACE FUNCTION public\.([a-z][a-z0-9_]*)\(/gm)].map(m => m[1]));
check(inBaseline.size > 300, `The baseline lists only ${inBaseline.size} public functions; it looks truncated.`);
const state = new Map(); // name -> 'created' | 'dropped', from migrations newer than the baseline
const migrations = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f.slice(0, 14) > meta.coversRepoMigrationsThrough).sort();
const statement = /\b(create\s+(?:or\s+replace\s+)?function|drop\s+function(?:\s+if\s+exists)?)\s+(?:(public|private|[a-z_]+)\.)?"?([a-z][a-z0-9_]*)"?\s*\(?/gi;
for (const file of migrations) {
  const sql = fs.readFileSync(path.join('supabase/migrations', file), 'utf8').replace(/--[^\n]*/g, '');
  for (const m of sql.matchAll(statement)) {
    const schema = (m[2] || 'public').toLowerCase();
    if (schema !== 'public') continue;
    state.set(m[3].toLowerCase(), /^create/i.test(m[1]) ? 'created' : 'dropped');
  }
}

check(called.size > 150, `Expected to find the app's RPC calls, found only ${called.size}; the scanner is broken.`);
for (const [name, file] of [...called].sort()) {
  const final = state.get(name);
  if (final === 'dropped') { check(false, `${file} calls ${name}, but a migration newer than the baseline drops it.`); continue; }
  if (final === 'created') continue;
  check(inBaseline.has(name), `${file} calls ${name}, which does not exist in the live schema baseline or any newer migration.`);
}

if (failures.length) {
  console.error('RPC existence contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`RPC existence contract audit passed: all ${called.size} database functions the app calls exist in the live schema baseline (${inBaseline.size} public functions) or a newer migration.`);
