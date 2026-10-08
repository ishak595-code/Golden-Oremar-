export type HomePresentationSource='featured'|'preorder'|'seasonal'|'newest'|'offers'|'curated'|'category';

type SectionCopy={eyebrow:string;title:string;subtitle:string};

const HOME_SECTION_COPY:Record<HomePresentationSource,SectionCopy>={
 featured:{eyebrow:'Golden Oremar seçkisi',title:'Sofranın imza parçaları',subtitle:'Kökeni belli, karakteri güçlü ürünler. Her biri sofrada fark yaratması için seçildi.'},
 preorder:{eyebrow:'Aceleye gelmeyenler',title:'Beklemeye değen lezzetler',subtitle:'Siparişinizle hazırlanmaya başlayan, emeği ve zamanı ürüne dönüşen özel seçimler.'},
 seasonal:{eyebrow:'Doğanın takviminden',title:'Hasadın en güzel zamanı',subtitle:'Mevsim ne sunuyorsa onu taşıyan ürünler. Sezonundayken daha canlı, sofradayken daha hatırlanır.'},
 newest:{eyebrow:'Yeni keşifler',title:'Vitrine yeni düşenler',subtitle:'Yeni üreticiler, yeni tatlar, yeni favoriler. İlk keşfedenlerden biri olun.'},
 offers:{eyebrow:'Seçili fırsatlar',title:'Değeri fiyatından önce gelenler',subtitle:'Karşılaştırmalı fiyatıyla öne çıkan ürünleri kaynağı ve niteliğiyle birlikte değerlendirin.'},
 curated:{eyebrow:'Özenle seçildi',title:'Sıradan olmayan sofralar için',subtitle:'Üreticisi, karakteri ve hikayesiyle ayrışan ürünlerden sakin ama iddialı bir seçki.'},
 category:{eyebrow:'Aynı sofradan',title:'Birlikte keşfetmeye değer',subtitle:'Aynı kategoride farklı üreticilerden öne çıkan seçenekleri tek bakışta karşılaştırın.'},
};

/* The seasonal showcase speaks of the season we are in. Months are Turkey's
   calendar seasons; a super admin's own title or description still wins. */
type Season={key:'spring'|'summer'|'autumn'|'winter';name:string;words:readonly string[]}&SectionCopy;
const SEASONS:readonly Season[]=[
 {key:'winter',name:'Kış',words:['kış'],eyebrow:'Kışın sıcak sofrası',title:'Kilerin en kıymetli hazineleri',subtitle:'Yazın emeği kışın sofraya iner. Yaylada saklanan, içinizi ısıtan seçimler; soğuk akşamların en güzel bahanesi.'},
 {key:'spring',name:'İlkbahar',words:['bahar','ilkbahar'],eyebrow:'Baharın ilk hasadı',title:'Doğa uyanırken ilk tadan siz olun',subtitle:'Karın çekildiği yamaçlardan ilk toplananlar. Mevsimi kısa, bulması zor; sofranıza baharın ilk sözünü taşıyor.'},
 {key:'summer',name:'Yaz',words:['yaz'],eyebrow:'Yaylanın yazı',title:'Güneşi içine çekmiş lezzetler',subtitle:'Yayla güneşinde olgunlaşan, sabah toplanıp yola çıkan ürünler. Yazın gerçek tadı, şehirde bulunmayanı.'},
 {key:'autumn',name:'Sonbahar',words:['sonbahar','güz'],eyebrow:'Sonbaharın bereketi',title:'Hasat zamanı, sofranızda',subtitle:'Dalında olgunlaşmış, yayladan yeni inmiş. Yılın bu birkaç haftasında en güzel hâlindeler; mevsimi kaçırmayın.'},
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
const SEEDED_SECTION_TEXT=new Set(['Öne Çıkan Ürünler','Ön Siparişe Açık','Mevsimlik Ürünler','Yeni Eklenenler','Fiyat Avantajı Olanlar','Üreticiden Seçimler','Golden Oremar vitrini için seçilmiş ürünler.','Hazırlık süresi bulunan ve ön siparişle sunulan ürünler.','Mevsimsel stok modeliyle sunulan ürünler.','Yakın zamanda yayına alınan ürünler.','Geçerli karşılaştırma fiyatı bulunan ürünler.','Vitrin için kürasyonla seçilmiş ürünler.','Kategoriler','Golden Oremar’ın seçkin ürünlerinden bugün sizin için özel olarak öne çıkan fırsat.','Golden Oremar’ın seçkin ürünlerinden sizin için öne çıkanlar.']);
export const custom=(value:string|null|undefined)=>{const text=String(value||'').trim();return text&&!SEEDED_SECTION_TEXT.has(text)?text:'';};

export function homeSectionDisplayCopy(source:HomePresentationSource,serverTitle:string,serverSubtitle:string):SectionCopy{
 const copy=source==='seasonal'?currentSeason():HOME_SECTION_COPY[source]||{eyebrow:'Golden Oremar',title:serverTitle,subtitle:serverSubtitle};
 return{eyebrow:copy.eyebrow,title:custom(serverTitle)||copy.title,subtitle:custom(serverSubtitle)||copy.subtitle};
}

/** The categories heading: the super admin's own title, else the crafted one. */
export function homeCategoriesTitle(serverTitle:string){return custom(serverTitle)||CUSTOMER_COPY.home.categoriesTitle;}
