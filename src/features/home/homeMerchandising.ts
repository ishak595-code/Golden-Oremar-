import type{HomePresentationSource}from'../customer-experience/customerCopy';

/* One clear label per showcase, the same on every row of it: a shopper reads
   one merchandising signal and one verification mark, never a different
   flourish on each line ("İmza seçim", "Sofrada fark", "Özenle seçildi"...).
   Every label is short enough to sit whole on the narrowest phone row: the
   row never cuts it (ProductCard.css), so keep new ones to ~12 characters. */
const SIGNALS:Record<HomePresentationSource,string>={
 featured:'İmza seçim',
 preorder:'Ön sipariş',
 seasonal:'Mevsiminde',
 newest:'Yeni',
 offers:'Fiyat avantajı',
 curated:'Seçimimiz',
 category:'Öne çıkan',
};

export function homeMerchandisingSignal(source:HomePresentationSource,_index:number){
 return SIGNALS[source]||null;
}
