import fs from 'node:fs';

const target=process.argv[2]||'src/App.tsx';
let source=fs.readFileSync(target,'utf8');
const importLine="import CatalogProductCard from './features/catalog/CatalogProductCard';";
const importAnchor="import ProductDetailScreen from './features/catalog/ProductDetailScreen';";
if(!source.includes(importLine)){
 const anchor=source.indexOf(importAnchor);
 if(anchor<0)throw new Error('ProductDetailScreen import anchor not found; refusing unsafe patch.');
 const end=source.indexOf('\n',anchor);
 source=source.slice(0,end+1)+importLine+'\n'+source.slice(end+1);
}

const cardStart=source.indexOf('\nfunction ProductCard(');
if(cardStart>=0){
 const cardEnd=source.indexOf('\nfunction ProductDetail(',cardStart);
 if(cardEnd<0)throw new Error('ProductCard end boundary not found; refusing unsafe patch.');
 source=source.slice(0,cardStart)+'\n'+source.slice(cardEnd);
}

source=source.replace(/<ProductCard\b/g,'<CatalogProductCard');
for(const value of ['suggestedProduct','product','p']){
 source=source.split(`onAddToCart={() => onAddToCart(${value})}`).join('onAddToCart={onAddToCart}');
}
source=source.split('favorites.includes(suggestedProduct.id)').join('favorites.includes(String(suggestedProduct.legacyId || suggestedProduct.id))');
source=source.split('favorites.includes(product.id)').join('favorites.includes(String(product.legacyId || product.id))');
source=source.split('favorites.includes(p.id)').join('favorites.includes(String(p.legacyId || p.id))');
source=source.split('const favProducts = products.filter(p => favorites.includes(p.id));').join('const favProducts = products.filter(p => favorites.includes(String(p.legacyId || p.id)));');

if(source.includes('function ProductCard('))throw new Error('Legacy ProductCard still present.');
if(source.includes('<ProductCard'))throw new Error('Legacy ProductCard call still present.');
if(!source.includes('<CatalogProductCard'))throw new Error('CatalogProductCard integration produced no call sites.');
if(source.includes('onAddToCart={() => onAddToCart(product)}'))throw new Error('Quantity-dropping product callback remains.');
if(source.includes('onAddToCart={() => onAddToCart(p)}'))throw new Error('Quantity-dropping related product callback remains.');
if(source.includes('onAddToCart={() => onAddToCart(suggestedProduct)}'))throw new Error('Quantity-dropping suggested product callback remains.');

fs.writeFileSync(target,source);
console.log('Truthful dynamic product card integrated into',target);
