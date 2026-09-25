// Consumer rights contract audit.
//
// The product page tells customers, before they buy, whether the 14-day right
// of withdrawal applies. Getting this wrong has a cost either way: telling a
// customer they can return fresh meat waives an exception the seller is
// entitled to, and telling them they cannot return a sealed jar misleads them
// about a right they have. This audit executes the classification against
// every product type currently in the catalogue and locks the wording rules.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const { code } = await transformWithEsbuild(fs.readFileSync('src/features/catalog/withdrawalRight.ts', 'utf8'), 'withdrawalRight.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-rights-'));
const file = path.join(dir, 'withdrawalRight.mjs');
fs.writeFileSync(file, code);
const rights = await import(pathToFileURL(file).href);
fs.rmSync(dir, { recursive: true, force: true });

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

// Every productType / safetyClass / isPerishable combination present in the
// live catalogue on 2026-09-25, with the tier the law requires.
const catalogue = [
  ['animal_fat', 'animal_fat', true, 'none'],
  ['dairy', 'dairy', true, 'none'],
  ['dairy', 'raw_milk', true, 'none'],
  ['egg', 'egg', true, 'none'],
  ['fish', 'fish', true, 'none'],
  ['poultry', 'poultry', true, 'none'],
  ['produce', 'fresh_produce', true, 'none'],
  ['produce', 'wild_mushroom', true, 'none'],
  ['red_meat', 'goat', true, 'none'],
  ['red_meat', 'lamb', true, 'none'],
  ['beverage', 'distillate', false, 'sealed_only'],
  ['beverage', 'processed_beverage', false, 'sealed_only'],
  ['beverage', 'water', false, 'sealed_only'],
  ['dairy', 'dairy', false, 'sealed_only'],        // dried yoghurt (kurut)
  ['pantry', 'dry_pantry', false, 'sealed_only'],
  ['pantry', 'honey', false, 'sealed_only'],
  ['pantry', 'salt', false, 'sealed_only'],        // rock salt is edible
  ['non_food', 'non_food_safety', false, 'standard'],
];
for (const [productType, safetyClass, isPerishable, expected] of catalogue) {
  const tier = rights.withdrawalTier({ productType, safetyClass, isPerishable });
  check(tier === expected, `${productType}/${safetyClass}/perishable=${isPerishable} must be '${expected}', got '${tier}'.`);
}

// Missing or malformed data must produce no claim rather than a guess.
for (const [label, value] of [['null', null], ['empty object', {}], ['string perishable', { isPerishable: 'true', productType: 'pantry' }], ['no productType', { isPerishable: false }]]) {
  check(rights.withdrawalTier(value) === null, `A ${label} handling profile must produce no withdrawal claim.`);
}

// Wording: the no-withdrawal notice must not read as 'no returns at all'. The
// defective-goods right survives every exception, and omitting it would
// mislead the customer about a right they keep.
check(/ayıplı|bozuk|hasarlı/i.test(rights.WITHDRAWAL_COPY.none.body), 'The no-withdrawal notice must state that the defective-goods right remains.');
check(/ayıplı/i.test(rights.WITHDRAWAL_COPY.sealed_only.body), 'The sealed-only notice must state that the defective-goods right remains.');
check(/14 gün/.test(rights.WITHDRAWAL_COPY.sealed_only.body) && /14 gün/.test(rights.WITHDRAWAL_COPY.standard.body), 'Notices granting withdrawal must state the 14-day period.');

const screen = fs.readFileSync('src/features/catalog/ProductDetailScreen.tsx', 'utf8');
check(/withdrawalTier\(/.test(screen) && /WITHDRAWAL_COPY/.test(screen), 'The product page must show the withdrawal notice before purchase.');

if (failures.length) {
  console.error('Consumer rights contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Consumer rights contract audit passed: ${catalogue.length} live product classes map to the correct withdrawal tier, missing data makes no claim, and every notice preserves the defective-goods right.`);
