export type HomePresentationSource='featured'|'preorder'|'seasonal'|'newest'|'offers'|'curated'|'category';

type SectionCopy={eyebrow:string;title:string;subtitle:string};

const HOME_SECTION_COPY:Record<HomePresentationSource,SectionCopy>={
 featured:{eyebrow:'Golden Oremar seçkisi',title:'Sofranıza yakışan seçkiler',subtitle:'Ürün ayrıntılarını, kaynağını ve güncel fiyatını birlikte inceleyin.'},
 preorder:{eyebrow:'Hazırlığı zaman ister',title:'Hazırlığı özen isteyen ürünler',subtitle:'Hazırlık süresi bulunan ürünleri ön sipariş bilgileriyle birlikte keşfedin.'},
 seasonal:{eyebrow:'Mevsiminde sunulur',title:'Mevsiminde sunulanlar',subtitle:'Yalnız mevsimsel stok durumuyla sunulan ürünlere göz atın.'},
 newest:{eyebrow:'Vitrine yeni katıldı',title:'Yeni eklenenleri keşfedin',subtitle:'Yakın zamanda yayına alınan ürünleri ayrıntılarıyla birlikte inceleyin.'},
 offers:{eyebrow:'Fiyatı karşılaştırın',title:'Karşılaştırmalı fiyatı olanlar',subtitle:'Güncel ve karşılaştırma fiyatı birlikte sunulan ürünleri kolayca inceleyin.'},
 curated:{eyebrow:'Özenli seçimler',title:'Üreticiden seçilenler',subtitle:'Vitrin için kürasyonla seçilmiş ürünleri kendi ritminizde keşfedin.'},
 category:{eyebrow:'Kategori seçkisi',title:'Bu kategoriden seçtiklerimiz',subtitle:'Aynı kategorideki ürünleri ayrıntıları ve güncel fiyatlarıyla inceleyin.'},
};

export const CUSTOMER_COPY={
 home:{
  categoriesTitle:'Sofranıza göre keşfedin',
  categoriesSubtitle:'Aradığınız lezzete daha kolay ulaşmak için kategoriler arasında sakin bir gezintiye çıkın.',
  categoriesAction:'Tümünü gör',
  discoverAll:'Tüm ürünleri keşfet',
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
