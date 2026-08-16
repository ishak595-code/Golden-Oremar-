import fs from 'node:fs';
const target=process.argv[2]||'src/App.tsx';
let source=fs.readFileSync(target,'utf8');
if(!source.includes('favoriteReferences={favorites}')){
 const needle='          authenticated={!!currentUser}\n          onBack={goBack}';
 const replacement=`          authenticated={!!currentUser}\n          favoriteReferences={favorites}\n          onFavoriteChanged={(reference: string, isFavorite: boolean) => setFavorites((previous) => isFavorite\n            ? (previous.includes(reference) ? previous : [...previous, reference])\n            : previous.filter((item) => item !== reference))}\n          onBack={goBack}`;
 if(!source.includes(needle))throw new Error('ProductDetailScreen favorite sync anchor not found; refusing unsafe patch.');
 source=source.replace(needle,replacement);
}
if(!source.includes('favoriteReferences={favorites}'))throw new Error('Favorite references were not integrated.');
if(!source.includes('onFavoriteChanged='))throw new Error('Favorite change callback was not integrated.');
fs.writeFileSync(target,source);
console.log('Product detail favorite state synchronized with App favorites.');
