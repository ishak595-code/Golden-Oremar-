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
  title:'Lezzetleri kendi ritminizde keşfedin',
  intro:'Kategoriler arasında gezinin; size uygun ürünleri fiyat, stok ve ürün ayrıntılarıyla kolayca karşılaştırın.',
  allProductsTitle:'Tüm ürünleri keşfet',
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

export function homeSectionDisplayCopy(source:HomePresentationSource,serverTitle:string,serverSubtitle:string):SectionCopy{
 const copy=HOME_SECTION_COPY[source];
 return copy||{eyebrow:'Golden Oremar',title:serverTitle,subtitle:serverSubtitle};
}
