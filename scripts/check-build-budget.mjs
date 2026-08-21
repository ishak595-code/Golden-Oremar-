import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.join(process.cwd(), 'dist', 'assets');
const maxChunkBytes = 450 * 1024;
const maxEntryBytes = 250 * 1024;

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
