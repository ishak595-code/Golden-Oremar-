// Proves a rebuilt database has the same application schema as live.
//
//   node scripts/schema/compare-catalog.mjs <live.json> <rebuilt.json>
//
// Both files are scripts/schema/export-catalog.sql output. Compared: every
// table column (type, null, default, identity), constraint, index, trigger,
// policy, RLS flag, view, sequence and function body, and every privilege the
// API roles hold. Ignored: object ids and ordering, the owner's own
// privileges, Postgres 17's MAINTAIN privilege (absent on 16), and the
// platform's own default privileges and event triggers.

import fs from 'node:fs';
import crypto from 'node:crypto';

// The live side may be a full export or the committed fingerprint
// (supabase/schema/live_fingerprint.json: one md5 per fact), so CI can check
// a rebuild without any access to the live project.
const args = process.argv.slice(2);
const writeAt = args.indexOf('--write-fingerprint');
const [liveFile, rebuiltFile] = writeAt < 0 ? args : args.filter((_, i) => i !== writeAt && i !== writeAt + 1);
const load = file => { const raw = JSON.parse(fs.readFileSync(file, 'utf8')); return raw.j || raw; };
const API = new Set(['anon', 'authenticated', 'service_role', 'PUBLIC']);
const acl = list => (list || []).filter(a => API.has(a.grantee) && a.priv !== 'MAINTAIN').map(a => `${a.grantee}:${a.priv}`).sort().join(',');
const sigKey = sig => sig.replace(/^public\./, '');
// Deparse differences that are not schema differences: Postgres prints
// "extensions.gin_trgm_ops" or "gin_trgm_ops" depending on the session's
// search_path, and keeps the redundant parentheses of the expression as it
// was first written ("((a AND b) AND c)" equals "(a AND b AND c)").
const indexKey = def => def.replace(/\bextensions\./g, '');
const checkKey = def => def.replace(/[()\s]/g, '');

function facts(cat) {
  const f = new Map();
  const put = (key, value) => f.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  for (const s of cat.schemas || []) put(`schema ${s.name} acl`, acl(s.acl));
  for (const t of cat.tables || []) {
    const name = `${t.schema}.${t.name}`;
    put(`table ${name} rls`, [t.rls, t.force]);
    put(`table ${name} acl`, acl(t.acl));
    put(`table ${name} colacl`, (t.colacl || []).filter(a => API.has(a.grantee)).map(a => `${a.col}:${a.grantee}:${a.priv}`).sort().join(','));
    for (const c of t.columns || []) put(`column ${name}.${c.name}`, [c.type, c.notnull, c.default, c.identity, c.generated, c.collation]);
    for (const k of t.constraints || []) put(`constraint ${name}.${k.name}`, k.type === 'c' ? checkKey(k.def) : k.def);
    for (const i of t.indexes || []) put(`index ${indexKey(i)}`, true);
    for (const tg of t.triggers || []) put(`trigger ${name}.${tg.name}`, [tg.def, tg.enabled]);
    for (const p of t.policies || []) put(`policy ${name}.${p.name}`, [p.cmd, p.permissive, (p.roles || []).slice().sort(), p.using, p.check]);
  }
  for (const v of cat.views || []) { put(`view ${v.schema}.${v.name}`, [v.kind, v.def, v.options]); put(`view ${v.schema}.${v.name} acl`, acl(v.acl)); }
  for (const s of cat.sequences || []) put(`sequence ${s.schema}.${s.name}`, [s.type, s.inc, s.start, s.owned, acl(s.acl)]);
  for (const fn of cat.functions || []) { put(`function ${sigKey(fn.sig)}`, fn.def.trim()); put(`function ${sigKey(fn.sig)} acl`, acl(fn.acl)); }
  for (const e of cat.evt || []) if (/^(public|private|api_internal|api_public_bridge)\./.test(e.fn)) put(`event trigger ${e.name}`, [e.event, e.fn, e.tags]);
  return f;
}

const md5 = value => crypto.createHash('md5').update(value).digest('hex');
const liveRaw = load(liveFile);
const live = liveRaw.fingerprint ? new Map(Object.entries(liveRaw.fingerprint)) : new Map([...facts(liveRaw)].map(([k, v]) => [k, md5(v)]));
if (writeAt >= 0) {
  fs.writeFileSync(args[writeAt + 1], JSON.stringify({ note: 'md5 of each schema fact of the live project; see scripts/schema/compare-catalog.mjs', fingerprint: Object.fromEntries([...live].sort()) }, null, 0) + '\n');
  console.log(`Wrote ${live.size} facts to ${args[writeAt + 1]}.`);
  if (!rebuiltFile) process.exit(0);
}
const rebuiltValues = facts(load(rebuiltFile));
const rebuilt = new Map([...rebuiltValues].map(([k, v]) => [k, md5(v)]));
const problems = [];
for (const [key, value] of live) {
  if (!rebuilt.has(key)) problems.push(`missing: ${key}`);
  else if (rebuilt.get(key) !== value) problems.push(`different: ${key}\n    rebuilt: ${rebuiltValues.get(key).slice(0, 300)}`);
}
for (const key of rebuilt.keys()) if (!live.has(key)) problems.push(`extra: ${key}`);
if (problems.length) {
  console.error(`${problems.length} difference(s) out of ${live.size} facts:\n${problems.slice(0, 40).join('\n')}`);
  process.exit(1);
}
const functionCount = [...live.keys()].filter(k => k.startsWith('function ') && !k.endsWith(' acl')).length;
console.log(`Rebuilt schema matches live: all ${live.size} facts identical (tables, columns, constraints, indexes, triggers, policies, views, sequences, ${functionCount} functions and API privileges).`);
