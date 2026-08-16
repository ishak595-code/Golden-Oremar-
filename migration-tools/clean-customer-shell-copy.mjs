import fs from 'node:fs';

const file='src/App.tsx';
let text=fs.readFileSync(file,'utf8');

const replacements=[
  ['placeholder="Şifa dolusu doğal ürünler..."','placeholder="Ürün, üretici veya köy ara..."'],
  ['placeholder="Şifa arayın: Karakovan Balı, Köy Tereyağı, Organik Işkın..."','placeholder="Ürün, üretici veya köy ara: Karakovan Balı, Köy Tereyağı, Işkın..."'],
  ['{speechText || "Doğal ürünlerimizin adını fısıldayın..."}','{speechText || "Aramak istediğiniz ürünün adını söyleyin..."}'],
  ['<p className="text-xs text-gray-400">Aradığınız şifayı kolayca konumlandırın.</p>','<p className="text-xs text-gray-400">Kategori, köken ve fiyatla sonuçları daraltın.</p>'],
  ["sortOption === 'rating' ? 'En Popüler' : 'Önerilen'","sortOption === 'rating' ? 'En Yüksek Puan' : 'Önerilen'"],
  ['<div className="text-brand-gold font-bold tracking-widest uppercase text-xs">Günün Fırsatı</div>','<div className="text-brand-gold font-bold tracking-widest uppercase text-xs">Öne Çıkan Ürün</div>'],
  ['<h2 className="text-3xl md:text-4xl font-serif text-brand-green dark:text-white">Bugünün Önerisi</h2>','<h2 className="text-3xl md:text-4xl font-serif text-brand-green dark:text-white">Katalog Seçkisi</h2>'],
  ["Golden Oremar'ın en seçkin ürünlerinden biri bugün sizin için özel olarak seçildi. Doğallığı ve lezzetiyle sofranıza değer katacak.","Golden Oremar kataloğundan öne çıkan bir ürün. Ürün, üretici, varyant ve menşe bilgilerini inceleyerek karar verebilirsiniz."],
  ['<div className="text-brand-gold font-bold tracking-widest uppercase text-xs mb-3">Sınırlı Üretim</div>','<div className="text-brand-gold font-bold tracking-widest uppercase text-xs mb-3">Mevsim Seçkisi</div>'],
  ["Golden Oremar'ın uyanışıyla gelen taze şifalı otlar, ilk sağım sütler ve doğanın en nadide hediyeleri.","Mevsimlik ürünleri, üretici bilgilerini ve mevcut ürün ayrıntılarını bu seçkide inceleyin."],
];

for(const [from,to] of replacements){
 const count=text.split(from).length-1;
 if(count!==1)throw new Error(`Expected exactly one occurrence, found ${count}: ${from}`);
 text=text.replace(from,to);
}

const forbidden=[
 'Şifa dolusu doğal ürünler',
 'Şifa arayın:',
 'Organik Işkın',
 'Doğal ürünlerimizin adını fısıldayın',
 'Aradığınız şifayı',
 "Doğallığı ve lezzetiyle",
 'taze şifalı otlar',
 '>Günün Fırsatı<',
 '>Bugünün Önerisi<',
 '>Sınırlı Üretim<',
 "sortOption === 'rating' ? 'En Popüler'",
];
for(const value of forbidden)if(text.includes(value))throw new Error(`Legacy/unverified shell copy survived: ${value}`);

const required=[
 'Ürün, üretici veya köy ara...',
 'Aramak istediğiniz ürünün adını söyleyin...',
 'Kategori, köken ve fiyatla sonuçları daraltın.',
 "sortOption === 'rating' ? 'En Yüksek Puan'",
 '>Öne Çıkan Ürün<',
 '>Katalog Seçkisi<',
 '>Mevsim Seçkisi<',
];
for(const value of required)if(!text.includes(value))throw new Error(`Required truthful copy missing: ${value}`);

fs.writeFileSync(file,text);
console.log(`Updated ${replacements.length} customer-shell copy strings.`);
