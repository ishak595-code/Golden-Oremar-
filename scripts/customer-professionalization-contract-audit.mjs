import fs from'node:fs';
import path from'node:path';

const root=process.cwd();
const failures=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const requireMatch=(condition,message)=>{if(!condition)failures.push(message);};
const forbid=(source,needle,message)=>requireMatch(!source.includes(needle),message);

const detail=read('src/features/catalog/ProductDetailScreen.tsx');
const category=read('src/features/catalog/CategoryDirectoryScreen.tsx');
const searchResults=read('src/features/catalog/CatalogSearchResults.tsx');
const favorites=read('src/features/account/FavoritesPanel.tsx');
const cart=read('src/features/cart/CartCheckoutFlow.tsx');
const customerE2e=read('scripts/customer-e2e.mjs');

const titleIndex=detail.indexOf('<h1');
const priceIndex=detail.indexOf('priceReady?',titleIndex);
const shortDescriptionIndex=detail.indexOf('detail.shortDescription',titleIndex);
const variantIndex=detail.indexOf('<fieldset className="mt-5"',titleIndex);
const producerIndex=detail.indexOf('detail?.producer',Math.max(0,variantIndex));
requireMatch(titleIndex>=0&&priceIndex>titleIndex,'Product detail title/price hierarchy is missing.');
requireMatch(shortDescriptionIndex<0||priceIndex<shortDescriptionIndex,'Product detail price must remain above short description.');
requireMatch(variantIndex>priceIndex,'Variant selection must remain after the primary price block.');
requireMatch(producerIndex<0||variantIndex<producerIndex,'Variant selection must remain before secondary producer content.');
requireMatch(detail.includes('product-detail-commerce-dock'),'State-aware product commerce dock is missing.');
requireMatch(detail.includes("setStatus('Sepete eklendi.')")&&detail.includes('Sepete Git'),'Compact add-to-cart success action is missing.');
forbid(detail,'line-clamp-3','Product detail short copy must not return to artificial three-line truncation.');

for(const [needle,message] of [
 ['sunucudan doğrulanamadı','Category screen must not expose server-validation wording.'],
 ['Kategori ürün toplamı doğrulanamadı','Category screen must not expose catalog validation internals.'],
 ['{loadMoreError}</p>','Category load-more alert must not print raw technical errors.'],
])forbid(category,needle,message);
requireMatch(category.includes('mt-7 grid gap-5')&&category.includes('sm:gap-6'),'Category product grid breathing-room contract is missing.');

forbid(searchResults,'setError(err?.message','Search results must not pass raw validation/API errors to customers.');
forbid(searchResults,"count==null?'Sonuçlar doğrulanamadı'",'Search filter sheet must not expose validation terminology.');
requireMatch(searchResults.includes("setError('Arama sonuçları şu anda gösterilemiyor. Lütfen yeniden deneyin.')"),'Search results need a stable customer-safe failure message.');
requireMatch(searchResults.includes("count==null?'Sonuç sayısı alınamadı'"),'Search filter unavailable state must remain customer-readable.');

for(const [needle,message] of [
 ['mağaza kimliği','Favorites copy must not expose store-identity implementation wording.'],
 ['dinamik gösterilir','Favorites copy must not describe implementation behavior.'],
 ['Aktif satış varyantı bulunmuyor','Favorites copy must not expose variant-system terminology.'],
 ['>Çıkar</button>','Favorites action must not regress to terse ambiguous wording.'],
])forbid(favorites,needle,message);
requireMatch(favorites.includes('Favoriden çıkar'),'Favorites action should remain explicit.');
requireMatch(favorites.includes('grid gap-5 sm:grid-cols-2 sm:gap-6'),'Favorites spacing contract is missing.');

for(const [needle,message] of [
 ['Checkout şu anda tamamlanamıyor','Checkout must not expose English implementation terminology.'],
 ['Checkout hesap bilgileri doğrulanamadı','Checkout must not expose internal validation wording.'],
 ['Super Admin ödeme altyapısını','Checkout must not expose administrator/infrastructure wording.'],
 ['iki harfli ISO kodu','Checkout must not require standards jargon from customers.'],
 ['komisyon, kargo ve ödeme sunucuda doğrulanır','Checkout trust copy must not narrate backend implementation.'],
])forbid(cart,needle,message);
requireMatch(cart.includes('space-y-6')&&cart.includes('sm:p-6'),'Checkout density reduction contract is missing.');
requireMatch(cart.includes('Aynı ödeme işlemi ikinci kez tahsil edilmez.'),'Checkout duplicate-charge safety copy must remain customer-readable.');

requireMatch(customerE2e.includes("getByText('Sepete eklendi.',{exact:true})"),'Customer E2E must verify the current add-to-cart success message.');
requireMatch(customerE2e.includes("getByRole('button',{name:'Sepete Git',exact:true})"),'Customer E2E must verify direct cart navigation.');
requireMatch(customerE2e.includes('catalog_sort_backend_roundtrip')&&customerE2e.includes('catalog_stock_filter_backend_roundtrip'),'Customer E2E must verify real catalog filter RPC roundtrips.');
requireMatch(customerE2e.includes('favorite_remove_roundtrip')&&customerE2e.includes('cart_add_roundtrip'),'Customer E2E must verify persisted favorite/cart state changes.');

if(failures.length){
 console.error('Customer professionalization contract audit failed:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}
console.log('Customer professionalization contract audit passed.');
