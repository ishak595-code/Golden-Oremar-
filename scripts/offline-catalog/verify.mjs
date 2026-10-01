// The shipped catalogue copy is exactly what was exported: every file in
// public/offline-catalog is listed in manifest.json with the same md5, and
// nothing else is there.
import fs from 'node:fs';
import path from 'node:path';
import { jsonbMd5 } from './jsonb.mjs';

const OUT = 'public/offline-catalog';
const manifest = JSON.parse(fs.readFileSync('scripts/offline-catalog/manifest.json', 'utf8'));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const present = walk(OUT).map(file => path.relative(OUT, file).split(path.sep).join('/'));
const failures = [];
for (const rel of present) {
  if (!manifest.files[rel]) { failures.push(`${rel} is not in manifest.json`); continue; }
  const md5 = jsonbMd5(JSON.parse(fs.readFileSync(path.join(OUT, rel), 'utf8')));
  if (md5 !== manifest.files[rel]) failures.push(`${rel} changed after export (md5 ${md5}, manifest ${manifest.files[rel]})`);
}
for (const rel of Object.keys(manifest.files)) if (!present.includes(rel)) failures.push(`${rel} is missing`);
if (failures.length) { console.error('Offline catalogue verification failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log(`Offline catalogue verified: ${present.length} files match the export of ${manifest.exportedAt}.`);
