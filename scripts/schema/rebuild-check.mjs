// Proves the repo can rebuild the production schema from nothing.
//
//   PGHOST=... PGPORT=... PGUSER=postgres node scripts/schema/rebuild-check.mjs
//
// 1. Creates a fresh database on any Postgres 16+ (CI uses postgres:17).
// 2. Loads supabase/schema/replay_shim.sql: the auth, storage, vault, cron and
//    net pieces and API roles a Supabase project has before any migration.
// 3. Loads supabase/schema/baseline.sql: the exact live application schema.
// 4. Compares the result with supabase/schema/live_fingerprint.json, fact by
//    fact (5,000+ facts: every column, constraint, index, policy, trigger,
//    function body and API privilege).
// 5. Applies every repo migration newer than the baseline on top, each in its
//    own transaction, so a migration that cannot run on production's schema
//    fails here first.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const db = process.env.REBUILD_DB || 'go_rebuild_check';
const meta = JSON.parse(fs.readFileSync('supabase/schema/baseline.json', 'utf8'));
const psql = (database, extra) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database, ...extra], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
const fail = (step, error) => { console.error(`${step} failed:\n${String(error.stderr || error.message).trim().split('\n').filter(line => !/NOTICE|WARNING|HINT/.test(line)).slice(0, 10).join('\n')}`); process.exit(1); };

try { psql('postgres', ['-c', `drop database if exists ${db}`]); psql('postgres', ['-c', `create database ${db}`]); } catch (error) { fail('Creating the database', error); }
try { psql(db, ['-f', 'supabase/schema/replay_shim.sql']); } catch (error) { fail('Loading the Supabase shim', error); }
try { psql(db, ['-1', '-f', 'supabase/schema/baseline.sql']); } catch (error) { fail('Loading baseline.sql', error); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-rebuild-'));
const exported = path.join(tmp, 'catalog.json');
try { fs.writeFileSync(exported, psql(db, ['-A', '-t', '-f', 'scripts/schema/export-catalog.sql'])); } catch (error) { fail('Exporting the rebuilt catalogue', error); }
try {
  console.log(execFileSync('node', ['scripts/schema/compare-catalog.mjs', 'supabase/schema/live_fingerprint.json', exported], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim());
} catch (error) { console.error(String(error.stderr || error.stdout).trim()); process.exit(1); }

const later = fs.readdirSync('supabase/migrations').filter(f => /^\d{14}_.+\.sql$/.test(f) && f.slice(0, 14) > meta.coversRepoMigrationsThrough).sort();
for (const file of later) {
  const sql = fs.readFileSync(path.join('supabase/migrations', file), 'utf8').replace(/create\s+extension\s+(if\s+not\s+exists\s+)?"?(pg_net|pg_cron)"?[^;]*;/gi, '/* $& (provided by the shim) */');
  const target = path.join(tmp, file);
  fs.writeFileSync(target, `set search_path = "$user", public, extensions;\n${sql}\n`);
  try { psql(db, ['-1', '-f', target]); } catch (error) { fail(`Applying ${file} on top of the baseline`, error); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(later.length ? `Applied ${later.length} newer migration(s) on top of the baseline: ${later.join(', ')}.` : 'No migrations newer than the baseline.');
