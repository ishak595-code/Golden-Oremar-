// Responsive variants of the shipped product photos for the home page:
// <slug>-{160,320,640,960}.avif and <slug>-{160,320}.webp next to the existing 480/1200 webp.
// Rows draw 64-80 px (160/320 covers 2-4x screens), the editorial hero up to
// ~960 px. Run after adding photos:  npm i --no-save sharp && node scripts/product-photos/variants.mjs
import fs from 'node:fs';
import path from 'node:path';
const sharp = (await import('sharp')).default;
const dir = 'public/product-photos';
const WIDTHS = [160, 320, 640, 960];
const sources = fs.readdirSync(dir).filter(f => /\.webp$/.test(f) && !/-(160|320|480|640|960)\.webp$/.test(f));
let written = 0;
for (const file of sources) {
  const base = file.replace(/\.webp$/, '');
  const input = path.join(dir, file);
  for (const width of WIDTHS) {
    // AVIF in every size; WebP (fallback for old browsers) only where no original exists.
    for (const [ext, opts] of width <= 320 ? [['avif', { quality: 52, effort: 6 }], ['webp', { quality: 74, effort: 6 }]] : [['avif', { quality: 52, effort: 6 }]]) {
      const out = path.join(dir, `${base}-${width}.${ext}`);
      if (fs.existsSync(out)) continue;
      await sharp(input).resize(width, width, { fit: 'cover' })[ext](opts).toFile(out);
      written++;
    }
  }
}
console.log(`product photo variants: ${sources.length} photos, ${written} files written`);
