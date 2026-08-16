import fs from 'node:fs';

const file = 'src/features/catalog/ProductDetailScreen.tsx';
let text = fs.readFileSync(file, 'utf8');

function replaceExact(from, to, expected = 1) {
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} occurrences, found ${count}: ${from.slice(0, 140)}`);
  text = text.split(from).join(to);
}

replaceExact(
  "import{getProductDetail,listProductReviews,publicCatalogUrl,toggleProductFavorite}from'./api';",
  "import{getProductDetail,listProductReviews,publicCatalogUrl,toggleProductFavorite}from'./api';import ProductSafetyPanel from'../content/ProductSafetyPanel';import{getProductSafety}from'../content/productSafetyApi';"
);

replaceExact(
  "const[detail,setDetail]=useState<any>(null);const[reviews,setReviews]=useState<any>(null);",
  "const[detail,setDetail]=useState<any>(null);const[safetyContent,setSafetyContent]=useState<any>(null);const[reviews,setReviews]=useState<any>(null);"
);

replaceExact(
  "useEffect(()=>{void load();},[reference]);",
  "useEffect(()=>{void load();},[reference]);\n useEffect(()=>{let active=true;setSafetyContent(null);getProductSafety(reference,'tr').then(data=>{if(active)setSafetyContent(data);}).catch(error=>{console.warn('Structured product safety content unavailable.',error);if(active)setSafetyContent(null);});return()=>{active=false;};},[reference]);"
);

replaceExact(
  "  <section className=\"mt-5 rounded-2xl border p-5\"><h2 className=\"flex items-center gap-2 text-xl font-bold\"><QrCode",
  "  <ProductSafetyPanel safety={safetyContent?.safety} summary={safetyContent?.summary} heading=\"Gıda güvenliği & kullanım\" className=\"mt-5\"/>\n  <section className=\"mt-5 rounded-2xl border p-5\"><h2 className=\"flex items-center gap-2 text-xl font-bold\"><QrCode"
);

if (!text.includes('ProductSafetyPanel')) throw new Error('ProductSafetyPanel import/integration missing');
if (!text.includes("getProductSafety(reference,'tr')")) throw new Error('Product safety hydration missing');
if (!text.includes('safetyContent?.safety')) throw new Error('Product safety rendering missing');

fs.writeFileSync(file, text);
console.log('Product detail structured safety integration applied.');
