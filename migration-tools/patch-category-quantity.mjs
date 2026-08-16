import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

const from = `          onAddToCart={async (item) => {\n            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variant?.id }, 1);\n          }}`;
const to = `          onAddToCart={async (item, quantity) => {\n            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variant?.id }, quantity);\n          }}`;

const count = text.split(from).length - 1;
if (count !== 1) throw new Error(`Expected exactly one legacy category add-to-cart bridge, found ${count}.`);
text = text.replace(from, to);

fs.writeFileSync(file, text);
console.log('Category quantity bridge updated.');
