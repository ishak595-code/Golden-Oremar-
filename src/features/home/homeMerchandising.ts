import type{HomePresentationSource}from'../customer-experience/customerCopy';

/* One clear label per showcase, the same on every row of it: a shopper reads
   one merchandising signal and one verification mark, never a different
   flourish on each line ("İmza seçim", "Sofrada fark", "Özenle seçildi"...). */
const SIGNALS:Record<HomePresentationSource,string>={
 featured:'İmza seçim',
 preorder:'Ön siparişe özel',
 seasonal:'Mevsiminde',
 newest:'Yeni',
 offers:'Fiyat avantajı',
 curated:'Golden Oremar seçimi',
 category:'Öne çıkan',
};

export function homeMerchandisingSignal(source:HomePresentationSource,_index:number){
 return SIGNALS[source]||null;
}
