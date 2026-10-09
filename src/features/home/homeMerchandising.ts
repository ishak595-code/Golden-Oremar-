import{namesOtherSeason,type HomePresentationSource}from'../customer-experience/customerCopy';
import type{CatalogItem}from'../catalog/api';

/* One clear label per showcase, the same on every row of it: a shopper reads
   one merchandising signal and one verification mark, never a different
   flourish on each line ("İmza seçim", "Sofrada fark", "Özenle seçildi"...).
   Every label is short enough to sit whole on the narrowest phone row: the
   row never cuts it (ProductCard.css), so keep new ones to ~12 characters. */
/* A row repeats nothing its showcase already says: "Sofrada iz bırakanlar"
   and "Verilmeye değer olanlar" carry no row label at all. */
const SIGNALS:Record<HomePresentationSource,string|null>={
 featured:null,
 preorder:'Ön sipariş',
 seasonal:'Mevsiminde',
 newest:'Yeni',
 offers:'Fiyat avantajı',
 curated:null,
 category:null,
};

/** "Mevsiminde" only where it is true now: not on a pre-order waiting for
    its harvest, nor on a product whose name ties it to another season. */
export function homeMerchandisingSignal(source:HomePresentationSource,_index:number,item?:Pick<CatalogItem,'name'|'stockMode'>){
 if(source==='seasonal'&&item&&(item.stockMode==='preorder'||namesOtherSeason(item.name)))return null;
 return SIGNALS[source]??null;
}
