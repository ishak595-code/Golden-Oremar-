import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

function replaceExact(from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  text = text.replace(from, to);
}

replaceExact(
  `  const filteredProducts = [...products].reverse().filter(p => {`,
  `  const filteredProducts = [...products].filter(p => {`,
  'preserve server catalog order',
);

replaceExact(
  `    return 0; // featured (default order, which is now reversed from data.ts)`,
  `    return 0; // featured keeps the server-provided catalog order`,
  'featured sort comment',
);

replaceExact(
  `      productsSection.scrollIntoView({ behavior: 'smooth' });`,
  `      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;\n      productsSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });`,
  'reduced motion scroll',
);

replaceExact(
`  const featuredProductNames: string[] = [];
  const naturalProductNames: string[] = [];
  const seasonalProductNames: string[] = [];
  const bestSellerProductNames: string[] = [];
  const newArrivalProductNames: string[] = [];

  const getProductsByNames = (_names: string[], _fallbackCategory: string, homeSectionKey: string) => {
    let matched = homeSectionKey === 'featured'
      ? products.filter((product: any) => product.is_featured || product.homeSection === 'featured')
      : homeSectionKey === 'pre_order'
        ? products.filter((product: any) => product.preOrder)
        : products.filter((product: any) => product.homeSection === homeSectionKey);
    const unique = new Map<string, any>();
    matched.forEach((item: any) => unique.set(String(item.id), item));
    return Array.from(unique.values()).slice(0, 12);
  };
`,
`  const getProductsForSection = (homeSectionKey: string) => {
    const matched = homeSectionKey === 'featured'
      ? products.filter((product: any) => product.is_featured || product.homeSection === 'featured')
      : homeSectionKey === 'pre_order'
        ? products.filter((product: any) => product.preOrder)
        : products.filter((product: any) => product.homeSection === homeSectionKey);
    const unique = new Map<string, any>();
    matched.forEach((item: any) => unique.set(String(item.id), item));
    return Array.from(unique.values()).slice(0, 12);
  };

  const categoriesWithProducts = liveCategories.filter((category: any) => Number(category.productCount || 0) > 0);
  const quickCategories = (categoriesWithProducts.length ? categoriesWithProducts : liveCategories).slice(0, 4);
  const isSellableForSpotlight = (product: any) => product?.stockMode === 'preorder' || product?.stock == null || Number(product.stock) > 0;
  const spotlightProduct = products.find((product: any) => product.is_featured && isSellableForSpotlight(product))
    || products.find((product: any) => isSellableForSpotlight(product))
    || null;
`,
  'replace legacy home section helpers',
);

replaceExact(
  `<option value="rating">En Çok Değerlendirilen</option>`,
  `<option value="rating">En Yüksek Puan</option>`,
  'rating label',
);

replaceExact(
  `className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-3 py-1 text-sm font-medium outline-none cursor-pointer text-brand-text"`,
  `className="min-h-11 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-medium outline-none cursor-pointer text-brand-text focus-visible:ring-2 focus-visible:ring-brand-gold"`,
  'search sort touch target',
);

replaceExact(
  `{liveCategories.filter((c: any) => ['bal-sifa', 'sut-sarkuteri', 'et-balik', 'meyve-sebze'].includes(c.id)).map((category: any) => {`,
  `{quickCategories.map((category: any) => {`,
  'dynamic quick categories',
);

replaceExact(
`                  let activeProductNames: string[] = [];
                  let fallbackCat = '';
                  if (section.id === 'featured') { activeProductNames = featuredProductNames; fallbackCat = 'Bal'; }
                  else if (section.id === 'natural') { activeProductNames = naturalProductNames; fallbackCat = 'Süt'; }
                  else if (section.id === 'seasonal') { activeProductNames = seasonalProductNames; fallbackCat = 'Dağ'; }
                  else if (section.id === 'best_sellers') { activeProductNames = bestSellerProductNames; fallbackCat = 'Süt'; }
                  else if (section.id === 'new_arrivals') { activeProductNames = newArrivalProductNames; fallbackCat = 'Kiler'; }
                  
                  const displayProducts = section.id === 'offers' 
                    ? (products.filter(p => p.homeSection === 'offers' && p.is_approved !== false).length > 0 ? products.filter(p => p.homeSection === 'offers' && p.is_approved !== false) : products.filter(p => p.originalPrice && p.is_approved !== false)).slice(0, 4)
                    : getProductsByNames(activeProductNames, fallbackCat, section.id);`,
`                  const displayProducts = section.id === 'offers'
                    ? (products.filter(p => p.homeSection === 'offers' && p.is_approved !== false).length > 0
                      ? products.filter(p => p.homeSection === 'offers' && p.is_approved !== false)
                      : products.filter(p => p.originalPrice && p.is_approved !== false)).slice(0, 4)
                    : getProductsForSection(section.id);`,
  'remove empty legacy section name routing',
);

replaceExact(
`                              {(() => {
                                const suggestedProduct = products.find(p => p.name.includes("Fahrettin'in Sütten Kesilmiş Oğlağı")) || products[0];
                                return suggestedProduct ? (
                                  <CatalogProductCard 
                                    product={suggestedProduct} 
                                    onClick={() => onProductClick(suggestedProduct)}
                                    onAddToCart={onAddToCart}
                                    onToggleFavorite={() => onToggleFavorite(suggestedProduct)}
                                    isFavorite={favorites.includes(String(suggestedProduct.legacyId || suggestedProduct.id))}
                                    onShare={() => onShare(suggestedProduct)}
                                    onGift={() => onGift(suggestedProduct)}
                                  />
                                ) : null;
                              })()}`,
`                              {spotlightProduct ? (
                                <CatalogProductCard
                                  product={spotlightProduct}
                                  onClick={() => onProductClick(spotlightProduct)}
                                  onAddToCart={onAddToCart}
                                  onToggleFavorite={() => onToggleFavorite(spotlightProduct)}
                                  isFavorite={favorites.includes(String(spotlightProduct.legacyId || spotlightProduct.id))}
                                  onShare={() => onShare(spotlightProduct)}
                                  onGift={() => onGift(spotlightProduct)}
                                />
                              ) : null}`,
  'dynamic spotlight product',
);

fs.writeFileSync(file, text);
console.log('Home storefront dynamic premium patch applied.');
