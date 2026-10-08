import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.join(process.cwd(), 'dist', 'assets');
const maxChunkBytes = 450 * 1024;
// 256 KiB since Oct 2026: the entry carries the representative product photo
// manifest (src/features/media/productPhotoManifest.ts, ~2 KiB of slugs for
// all 50 products); main was already within 0.3 KiB of the old 250 KiB limit.
// 260 KiB since 8 Oct 2026: the seasonal copy for the four seasons and the
// "Bugünün Önerisi" pick live in the entry (the card itself is lazy).
const maxEntryBytes = 260 * 1024;

if (!fs.existsSync(assetsDir)) {
  console.error('Bundle budget audit failed: dist/assets does not exist. Run the production build first.');
  process.exit(1);
}

const javascriptFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.js'));
if (!javascriptFiles.length) {
  console.error('Bundle budget audit failed: no JavaScript assets were produced.');
  process.exit(1);
}

const failures = [];
let largest = { file: '', bytes: 0 };

for (const file of javascriptFiles) {
  const bytes = fs.statSync(path.join(assetsDir, file)).size;
  if (bytes > largest.bytes) largest = { file, bytes };
  if (bytes > maxChunkBytes) {
    failures.push(`${file} is ${(bytes / 1024).toFixed(1)} KiB, above the ${maxChunkBytes / 1024} KiB chunk budget.`);
  }
  if (/^index-[^.]+\.js$/.test(file) && bytes > maxEntryBytes) {
    failures.push(`${file} is ${(bytes / 1024).toFixed(1)} KiB, above the ${maxEntryBytes / 1024} KiB customer entry budget.`);
  }
}

if (failures.length) {
  console.error('Bundle budget audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Bundle budget audit passed. Largest JS chunk: ${largest.file} ${(largest.bytes / 1024).toFixed(1)} KiB.`);
