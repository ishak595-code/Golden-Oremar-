export type HomePresentationSource='featured'|'preorder'|'seasonal'|'newest'|'offers'|'curated'|'category';

type SectionCopy={eyebrow:string;title:string;subtitle:string};

/* The home page's voice: calm, selective, weighty. No "premium", no
   discounts, no bargain hunting. Each showcase is named for what it means at
   the table, not for how it was filled. */
const HOME_SECTION_COPY:Record<HomePresentationSource,SectionCopy>={
 featured:{eyebrow:'Seçilmiş olanlar',title:'Sofrada iz bırakanlar',subtitle:'Az bulunur, kökeni net, karakteri güçlü. Sofranı sıradanlıktan ayıranlar.'},
 seasonal:{eyebrow:'Şu anın hasadı',title:'Zamanı gelmiş lezzetler',subtitle:'Bu mevsimde toplanan, beklemeye değen, taze karakterli ürünler.'},
 newest:{eyebrow:'Vitrine yeni',title:'Henüz az bilinenler',subtitle:'Raflara yeni düşen, keşfedilmeyi bekleyen sakin seçimler.'},
 preorder:{eyebrow:'Sakin seçki',title:'Acele etmeyen tatlar',subtitle:'Yavaş üretilmiş, hikâyesi olan, uzun süre hatırlananlar.'},
 offers:{eyebrow:'Doğru zamanda',title:'Değeri fiyatından önce gelenler',subtitle:'Kaynağı ve emeğiyle öne çıkan, şimdi daha erişilebilir seçimler.'},
 curated:{eyebrow:'Özenle ayrıldı',title:'Verilmeye değer olanlar',subtitle:'Bir sofraya veya birine bırakıldığında anlamı artan ürünler.'},
 category:{eyebrow:'Aynı sofradan',title:'Birlikte keşfetmeye değer',subtitle:'Aynı kökten gelen, yan yana daha anlamlı duran seçimler.'},
};

/* Seasons by Turkey's calendar: the "Bugünün Önerisi" band picks products of
   the season we are in. */
type Season={key:'spring'|'summer'|'autumn'|'winter';name:string;words:readonly string[]};
const SEASONS:readonly Season[]=[
 {key:'winter',name:'Kış',words:['kış']},
 {key:'spring',name:'İlkbahar',words:['bahar','ilkbahar']},
 {key:'summer',name:'Yaz',words:['yaz']},
 {key:'autumn',name:'Sonbahar',words:['sonbahar','güz']},
];
export function currentSeason(date=new Date()):Season{const month=date.getMonth();return SEASONS[month===11||month<2?0:month<5?1:month<8?2:3];}
/** True when a product's name ties it to another season ("Bahar Çiçek Balı" in October). */
export function namesSeason(name:string,season=currentSeason()){const text=` ${name.toLocaleLowerCase('tr-TR')} `;return season.words.some(word=>text.includes(` ${word} `));}
/** True when a product's name ties it to another season ("Bahar Çiçek Balı" in October). */
export function namesOtherSeason(name:string,season=currentSeason()){return!namesSeason(name,season)&&SEASONS.some(other=>other.key!==season.key&&namesSeason(name,other));}

export const CUSTOMER_COPY={
 home:{
  categoriesTitle:'Sofranızın karakterini seçin',
  categoriesSubtitle:'Bal, süt ürünleri, kuru gıda ve daha fazlası. İyi ürüne giden yolu kısalttık.',
  discoverAll:'Koleksiyonun tamamını keşfet',
  loadErrorTitle:'Ana sayfayı yenileyemedik',
  loadErrorFallback:'Ana sayfa şu anda yenilenemiyor.',
  retry:'Yeniden dene',
  sectionRefreshError:'Bu bölüm şu anda yenilenemiyor.',
 },
 category:{
  title:'Köyün sofrasından seçin',
  intro:'Her biri kaynağı belli, özenle seçilmiş ürünler.',
  allProductsTitle:'Tüm ürünler',
  allProductsSubtitle:'Katalogdaki tüm ürünlere birlikte göz atın.',
  loadingCategories:'Kategoriler hazırlanıyor…',
  loadingProducts:'Ürünler hazırlanıyor…',
  productSummary:(shown:number,total:number|null,loading:boolean)=>loading?'Ürünler hazırlanıyor…':total===null?`${shown} ürün listelendi`:`${shown} / ${total} ürün listelendi`,
  emptyTitle:'Bu seçimde henüz bir ürün görünmüyor',
  emptyBody:'Filtreyi değiştirerek ya da başka bir kategoriye göz atarak devam edebilirsiniz.',
  retry:'Tekrar dene',
  loadMore:'Daha fazla ürün göster',
 },
 search:{
  overlayTitle:'Aradığınız ürüne buradan ulaşın',
  overlayBody:'Ürün, üretici veya kategori adını yazın; eşleşen seçenekleri birlikte gösterelim.',
  noSuggestion:'Bu ifadeyle eşleşen bir seçenek bulamadık.',
  allResults:(query:string)=>`“${query}” için tüm sonuçları gör`,
  searching:'Aramanız hazırlanıyor…',
  resultCount:(count:number)=>`${count} ürün bulduk`,
  emptyTitle:'Aramanıza uygun ürün bulamadık',
  emptyBody:'Arama ifadesini sadeleştirerek veya filtreleri değiştirerek yeniden deneyebilirsiniz.',
  clearFilters:'Filtreleri temizle',
  loadMore:'Daha fazla ürün göster',
 },
}as const;

// The titles the store was seeded with. While a section still carries one of
// these, the crafted copy above is shown; once a super admin writes their own
// title or description in "Ana sayfa ürün vitrinleri", theirs wins.
const SEEDED_SECTION_TEXT=new Set(['Öne Çıkan Ürünler','Ön Siparişe Açık','Mevsimlik Ürünler','Yeni Eklenenler','Fiyat Avantajı Olanlar','Üreticiden Seçimler','Golden Oremar vitrini için seçilmiş ürünler.','Hazırlık süresi bulunan ve ön siparişle sunulan ürünler.','Mevsimsel stok modeliyle sunulan ürünler.','Yakın zamanda yayına alınan ürünler.','Geçerli karşılaştırma fiyatı bulunan ürünler.','Vitrin için kürasyonla seçilmiş ürünler.','Kategoriler','Golden Oremar’ın seçkin ürünlerinden bugün sizin için özel olarak öne çıkan fırsat.','Golden Oremar’ın seçkin ürünlerinden sizin için öne çıkanlar.','Sofranın imza parçaları','Beklemeye değen lezzetler','Vitrine yeni düşenler','Kökeni belli, karakteri güçlü ürünler. Her biri sofrada fark yaratması için seçildi.','Yeni üreticiler, yeni tatlar, yeni favoriler. İlk keşfedenlerden biri olun.','Siparişinizle hazırlanmaya başlayan, emeği ve zamanı ürüne dönüşen özel seçimler.']);
export const custom=(value:string|null|undefined)=>{const text=String(value||'').trim();return text&&!SEEDED_SECTION_TEXT.has(text)?text:'';};

export function homeSectionDisplayCopy(source:HomePresentationSource,serverTitle:string,serverSubtitle:string):SectionCopy{
 const copy=HOME_SECTION_COPY[source]||{eyebrow:'Golden Oremar',title:serverTitle,subtitle:serverSubtitle};
 return{eyebrow:copy.eyebrow,title:custom(serverTitle)||copy.title,subtitle:custom(serverSubtitle)||copy.subtitle};
}

/** The categories heading: the super admin's own title, else the crafted one. */
export function homeCategoriesTitle(serverTitle:string){return custom(serverTitle)||CUSTOMER_COPY.home.categoriesTitle;}
