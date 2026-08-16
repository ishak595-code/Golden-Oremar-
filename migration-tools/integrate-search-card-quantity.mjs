import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

const from = `          onAddToCart={async (item) => {
            await addToCart({
              id: item.id,
              slug: item.slug,
              name: item.name,
              variantId: item.variant?.id,
            }, 1);
          }}`;

const to = `          onAddToCart={async (item, quantity) => {
            await addToCart({
              id: item.id,
              slug: item.slug,
              name: item.name,
              variantId: item.variant?.id,
            }, quantity);
          }}`;

const count = text.split(from).length - 1;
if (count !== 1) throw new Error(`Expected exactly one catalog-search cart callback, found ${count}`);
text = text.replace(from, to);

if (!text.includes('onAddToCart={async (item, quantity) => {')) {
  throw new Error('Search quantity callback was not integrated.');
}

fs.writeFileSync(file, text);
console.log('Catalog search quantity integration applied.');
