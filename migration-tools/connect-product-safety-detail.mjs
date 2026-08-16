import fs from 'node:fs';

const file = 'src/features/catalog/ProductDetailScreen.tsx';
let text = fs.readFileSync(file, 'utf8');

const importAnchor = "import{getProductDetail,listProductReviews,publicCatalogUrl,toggleProductFavorite}from'./api';";
const safetyImport = "import ProductSafetyPanel from'./ProductSafetyPanel';";
if (!text.includes(safetyImport)) {
  const count = text.split(importAnchor).length - 1;
  if (count !== 1) throw new Error(`Expected one product API import anchor, found ${count}`);
  text = text.replace(importAnchor, `${importAnchor}\n${safetyImport}`);
}

const traceAnchor = '  <section className="mt-5 rounded-2xl border p-5"><h2 className="flex items-center gap-2 text-xl font-bold"><QrCode className="h-5 w-5 text-brand-gold"/>Lot / İzlenebilirlik</h2>';
const safetyMount = '  <ProductSafetyPanel reference={detail.slug||detail.id}/>';
if (!text.includes(safetyMount)) {
  const count = text.split(traceAnchor).length - 1;
  if (count !== 1) throw new Error(`Expected one traceability anchor, found ${count}`);
  text = text.replace(traceAnchor, `${safetyMount}\n${traceAnchor}`);
}

if (!text.includes(safetyImport) || !text.includes(safetyMount)) {
  throw new Error('Product safety integration contract missing after patch');
}

fs.writeFileSync(file, text);
console.log('Product safety detail integration applied.');
