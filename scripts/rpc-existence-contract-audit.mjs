// Every database function the app calls must still exist.
//
// In September 2026 the seller traceability screen still called
// get_my_producer_dashboard_v1, which a migration had dropped a month earlier
// in favour of v2. TypeScript cannot see that: the name is a string. The
// screen simply failed for every seller who opened it.
//
// This audit replays supabase/migrations in order and tracks, for each public
// function, whether its last word was CREATE or DROP. A name the client passes
// to supabase.rpc fails if a migration dropped it last. The repo cannot yet
// rebuild the whole live schema (116 early live migrations were never saved),
// so a name no repo migration mentions must appear in
// supabase/schema/live_public_functions.txt, read from the live catalogue.

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

// 2. Final state of every public function after all migrations.
const state = new Map(); // name -> 'created' | 'dropped'
const migrations = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
const statement = /\b(create\s+(?:or\s+replace\s+)?function|drop\s+function(?:\s+if\s+exists)?)\s+(?:(public|private|[a-z_]+)\.)?"?([a-z][a-z0-9_]*)"?\s*\(?/gi;
for (const file of migrations) {
  const sql = fs.readFileSync(path.join('supabase/migrations', file), 'utf8').replace(/--[^\n]*/g, '');
  for (const m of sql.matchAll(statement)) {
    const schema = (m[2] || 'public').toLowerCase();
    if (schema !== 'public') continue;
    state.set(m[3].toLowerCase(), /^create/i.test(m[1]) ? 'created' : 'dropped');
  }
}

const live = new Set(fs.readFileSync('supabase/schema/live_public_functions.txt', 'utf8').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')));
check(live.size > 300, `The live function list looks truncated (${live.size} names).`);
check(called.size > 150, `Expected to find the app's RPC calls, found only ${called.size}; the scanner is broken.`);
let fromLiveList = 0;
for (const [name, file] of [...called].sort()) {
  const final = state.get(name);
  if (final === 'dropped') { check(false, `${file} calls ${name}, but a migration dropped it.`); continue; }
  if (final === 'created') continue;
  fromLiveList++;
  check(live.has(name), `${file} calls ${name}, which no migration creates and the live database does not have.`);
}
// A name dropped by a migration must also have left the live list, or the
// list is stale and would hide the next mistake.
for (const name of live) check(state.get(name) !== 'dropped', `live_public_functions.txt still lists ${name}, which a migration drops; refresh the list.`);

if (failures.length) {
  console.error('RPC existence contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`RPC existence contract audit passed: all ${called.size} database functions the app calls exist (${called.size - fromLiveList} from repo migrations, ${fromLiveList} only in the live catalogue list).`);
