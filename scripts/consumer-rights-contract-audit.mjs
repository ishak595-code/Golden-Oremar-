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

// The cart (pre-contract information before payment) repeats the notice for
// every item, with the same rules and wording.
const meat = { isPerishable: true, productType: 'red_meat' };
const honey = { isPerishable: false, productType: 'pantry' };
const soap = { isPerishable: false, productType: 'non_food' };
const groups = rights.cartWithdrawalGroups([
  { name: 'Kuzu eti', handling: meat }, { name: 'Çiçek balı', handling: honey }, { name: 'Çiçek balı', handling: honey },
  { name: 'Keçi sütü sabunu', handling: soap }, { name: 'Bilinmeyen', handling: null }, { name: 'Tereyağı', handling: { isPerishable: true, productType: 'dairy' } },
]);
check(groups.map(g => g.tier).join() === 'none,sealed_only,standard', `Cart groups must be ordered strictest first, got ${groups.map(g => g.tier).join()}.`);
check(groups[0]?.products.join('|') === 'Kuzu eti|Tereyağı' && groups[1]?.products.join('|') === 'Çiçek balı', 'Cart groups must list each product once, under its own tier.');
check(!groups.some(g => g.products.includes('Bilinmeyen')), 'A cart item with an unknown handling profile must make no claim.');
check(groups.every(g => g.title === rights.WITHDRAWAL_COPY[g.tier].title && g.body === rights.WITHDRAWAL_COPY[g.tier].body), 'The cart must use exactly the product page wording.');
check(rights.cartWithdrawalGroups([]).length === 0, 'An empty cart shows no notice.');
const cartFlow = fs.readFileSync('src/features/cart/CartCheckoutFlow.tsx', 'utf8');
const cartNotice = fs.readFileSync('src/features/cart/CartWithdrawalNotice.tsx', 'utf8');
check(/<CartWithdrawalNotice items=\{cart\.items\}\/>/.test(cartFlow) && cartFlow.indexOf('<CartWithdrawalNotice') < cartFlow.indexOf('preview&&!preview.canCheckout'),
  'The cart summary must show the withdrawal notice next to the total, before payment.');
check(/cartWithdrawalGroups\(/.test(cartNotice) && /handlingProfile/.test(cartNotice), 'The cart notice must use the shared classification.');
check(/handlingProfile: isRecord\(raw\.handlingProfile\) \? raw\.handlingProfile : null/.test(fs.readFileSync('src/features/cart/api.ts', 'utf8')), 'The cart API must keep the handling profile of each item.');
check(/'handlingProfile',private\.product_handling_profile_v1\(product_id\)/.test(fs.readFileSync('supabase/migrations/20260926220000_cart_item_handling_profile_v1.sql', 'utf8')),
  'The cart snapshot must carry the same handling profile the product page reads.');

// Render the real cart notice with React and read what a customer would see.
// Compiled into a folder inside the repo so 'react' and 'lucide-react' resolve.
{
  const out = fs.mkdtempSync(path.join('node_modules', '.go-cart-notice-'));
  try {
    const compile = async (source, name) => (await transformWithEsbuild(fs.readFileSync(source, 'utf8'), name, { loader: name.endsWith('x') ? 'tsx' : 'ts', format: 'esm', jsx: 'automatic' })).code;
    fs.writeFileSync(path.join(out, 'withdrawalRight.mjs'), await compile('src/features/catalog/withdrawalRight.ts', 'withdrawalRight.ts'));
    fs.writeFileSync(path.join(out, 'notice.mjs'), (await compile('src/features/cart/CartWithdrawalNotice.tsx', 'CartWithdrawalNotice.tsx'))
      .replace(/from ["']\.\.\/catalog\/withdrawalRight["']/, "from './withdrawalRight.mjs'"));
    const React = (await import('react')).default;
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { CartWithdrawalNotice } = await import(pathToFileURL(path.resolve(out, 'notice.mjs')).href);
    const render = items => renderToStaticMarkup(React.createElement(CartWithdrawalNotice, { items }));
    const mixed = render([
      { productName: 'Kuzu eti', handlingProfile: { isPerishable: true, productType: 'red_meat' } },
      { productName: 'Çiçek balı', handlingProfile: { isPerishable: false, productType: 'pantry' } }]);
    const single = render([{ productName: 'Çiçek balı', handlingProfile: { isPerishable: false, productType: 'pantry' } }]);
    check(/aria-labelledby="cart-withdrawal-title"/.test(mixed) && /İade ve cayma hakkı/.test(mixed) && mixed.indexOf('Kuzu eti') > 0 && mixed.indexOf('Kuzu eti') < mixed.indexOf('Çiçek balı'),
      'Rendered cart notice lists each group with its products, strictest first, as a labelled region.');
    check(single.includes(rights.WITHDRAWAL_COPY.sealed_only.title) && single.includes(rights.WITHDRAWAL_COPY.sealed_only.body) && !/<ul/.test(single), 'A single-tier cart shows one plain notice.');
    check(render([{ productName: 'X', handlingProfile: null }]) === '', 'Unknown profiles render nothing.');
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error('Consumer rights contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Consumer rights contract audit passed: ${catalogue.length} live product classes map to the correct withdrawal tier, missing data makes no claim, and every notice (product page and cart) preserves the defective-goods right.`);
