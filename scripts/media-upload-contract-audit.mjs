// Media upload contract audit.
//
// Client-side image compression and the server-side verifier have to agree on
// one number. catalog-media-verify rejects any catalogue image whose width or
// height is below MIN_PRODUCT_IMAGE_EDGE. If the compressor ever shrank a photo
// under that floor, every such upload would be refused by the server - and
// nothing in the UI would explain why. This audit reads the floor straight out
// of the edge function and checks the compressor against it, so changing one
// without the other fails the build instead of failing customers.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const verifier = fs.readFileSync('supabase/functions/catalog-media-verify/index.ts', 'utf8');
const floor = Number(verifier.match(/MIN_PRODUCT_IMAGE_EDGE\s*=\s*(\d+)/)?.[1]);
check(Number.isFinite(floor) && floor > 0, 'Could not read MIN_PRODUCT_IMAGE_EDGE from catalog-media-verify.');

const { code } = await transformWithEsbuild(fs.readFileSync('src/lib/compressImage.ts', 'utf8'), 'compressImage.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-media-'));
const file = path.join(dir, 'compressImage.mjs');
fs.writeFileSync(file, code);
const media = await import(pathToFileURL(file).href);
fs.rmSync(dir, { recursive: true, force: true });

for (const [name, options] of [['PRODUCT', media.PRODUCT_IMAGE_COMPRESSION], ['CATEGORY', media.CATEGORY_IMAGE_COMPRESSION]]) {
  check(options.minShortEdge >= floor, `${name}_IMAGE_COMPRESSION.minShortEdge (${options.minShortEdge}) must be at least the verifier floor (${floor}).`);
  // Real camera shapes, including the tall 9:16 case a long-edge-only resize
  // would have pushed below the floor.
  for (const [w, h] of [[3024, 4032], [4032, 3024], [2268, 4032], [3000, 3000], [1500, 6000], [floor, floor]]) {
    const s = media.resizeScale(w, h, options);
    check(Math.min(Math.round(w * s), Math.round(h * s)) >= floor, `${name}: ${w}x${h} would be resized below the ${floor}px floor.`);
    check(s <= 1, `${name}: ${w}x${h} must never be enlarged.`);
  }
}
check(media.resizeScale(800, 1000, media.PRODUCT_IMAGE_COMPRESSION) === 1, 'An image already below the floor must be left at its original size, not enlarged to pass.');

for (const source of ['src/admin/officialStoreProductApi.ts', 'src/features/producer-products/api.ts', 'src/admin/categoryAdminApi.ts']) {
  check(fs.readFileSync(source, 'utf8').includes('compressImageForUpload('), `${source} must compress images before uploading them.`);
}

if (failures.length) {
  console.error('Media upload contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Media upload contract audit passed: client compression respects the ${floor}px verifier floor across real camera shapes, never enlarges, and is applied on every catalogue upload path.`);
