import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');

const imports = [
  "import CatalogSearchOverlay from './features/catalog/CatalogSearchOverlay';",
  "import CatalogSearchResults from './features/catalog/CatalogSearchResults';",
  "import ProductDetailScreen from './features/catalog/ProductDetailScreen';",
  "import PublicProducerScreen from './features/catalog/PublicProducerScreen';",
  "import CategoryDirectoryScreen from './features/catalog/CategoryDirectoryScreen';",
  "import { listFavoriteReferences as serverFavoriteReferences, searchCatalog as serverCatalogSearch, toggleProductFavorite as serverToggleProductFavorite } from './features/catalog/api';",
  "import { useLiveHomeCatalog } from './features/catalog/useLiveHomeCatalog';",
  "import { useCatalogFilterOptions } from './features/catalog/useCatalogFilterOptions';",
];
const anchor = "import AccountCenter from './features/account/AccountCenter';";
if (!source.includes(anchor)) throw new Error('AccountCenter import missing; apply cumulative patches in order.');
for (const line of imports) {
  if (!source.includes(line)) source = source.replace(anchor, `${anchor}\n${line}`);
}

// Add the server-backed search results route without disturbing the existing route model.
source = source.replace(
  "type Tab = 'home' | 'categories' | 'favorites' | 'cart' | 'account' | 'product-detail' | 'events' | 'health' | 'contact' | 'about' | 'admin' | 'vendor-store';",
  "type Tab = 'home' | 'categories' | 'favorites' | 'cart' | 'account' | 'product-detail' | 'search-results' | 'producer-profile' | 'events' | 'health' | 'contact' | 'about' | 'admin' | 'vendor-store';"
);
if (!source.includes("'search-results'")) throw new Error('Could not extend Tab route for server catalog search.');

// Add search/detail references next to the existing search query state.
const searchState = "  const [searchQuery, setSearchQuery] = useState('');";
if (!source.includes('const [selectedProductReference')) {
  if (!source.includes(searchState)) throw new Error('Search state anchor not found.');
  source = source.replace(searchState, `${searchState}\n  const [selectedProductReference, setSelectedProductReference] = useState<string | null>(null);\n  const [selectedProducerReference, setSelectedProducerReference] = useState<string | null>(null);\n  const [searchCategorySlug, setSearchCategorySlug] = useState<string | null>(null);\n  const [searchProducerId, setSearchProducerId] = useState<string | null>(null);`);
}


// Hydrate home/product-card favorites from the same Supabase favorite table used by AccountCenter.
const favoriteState = '  const [favorites, setFavorites] = useState<number[]>([]);';
if (source.includes(favoriteState) && !source.includes('serverFavoriteReferences()')) {
  source = source.replace(favoriteState, "  const [favorites, setFavorites] = useState<string[]>([]);\n\n  useEffect(() => {\n    let active = true;\n    if (!currentUser) {\n      setFavorites([]);\n      return () => { active = false; };\n    }\n    serverFavoriteReferences()\n      .then((refs) => { if (active) setFavorites(refs); })\n      .catch((error) => console.error('Supabase favorites hydration failed', error));\n    return () => { active = false; };\n  }, [currentUser]);");
}


// Header filter options come from the live public catalog, not unrelated hard-coded regions.
const sortStateAnchor = "  const [sortOption, setSortOption] = useState<string>('featured');";
if (source.includes(sortStateAnchor) && !source.includes('catalogFilterOrigins')) {
  source = source.replace(sortStateAnchor, `${sortStateAnchor}
  const { categories: catalogFilterCategories, origins: catalogFilterOrigins } = useCatalogFilterOptions();`);
}

// Voice search must query the same live catalog rather than the legacy Firestore/local product array.
const voiceStart = source.indexOf('  const processVoiceCommand = async (text: string) => {');
const triggerStart = source.indexOf('  const triggerVoiceSearch = () => {', voiceStart);
if (voiceStart < 0 || triggerStart < 0) throw new Error('Voice search function boundaries not found.');
const voiceReplacement = `  const processVoiceCommand = async (text: string) => {
    const rawText = text.toLowerCase().trim();
    const commandWords = ["sepete ekle", "sepetine ekle", "ekle", "satın al", "satin al"];
    let isCommand = false;
    let cleanProductQuery = text;

    for (const cmd of commandWords) {
      if (rawText.endsWith(cmd)) {
        isCommand = true;
        cleanProductQuery = text.substring(0, text.toLowerCase().lastIndexOf(cmd)).trim();
        break;
      }
      if (rawText.includes(cmd)) {
        isCommand = true;
        cleanProductQuery = text.replace(new RegExp(cmd, 'gi'), '').trim();
        break;
      }
    }

    if (isCommand && cleanProductQuery) {
      try {
        const result = await serverCatalogSearch({ query: cleanProductQuery, inStock: true, sort: 'relevance', limit: 5, offset: 0 });
        const matched = result.items?.[0];
        if (!matched) {
          setSpeechText('Aradığınız satılabilir ürün bulunamadı.');
          setVoiceError('Aradığınız satılabilir ürün bulunamadı.');
          setTimeout(() => setIsListening(false), 2200);
          return;
        }
        await addToCart({
          id: matched.id,
          slug: matched.slug,
          name: matched.name,
          variantId: matched.variant?.id,
        }, 1, true);
        setSpeechText(
          matched.name + ' sepetinize eklendi.'
        );
        showToast(matched.name + ' sepetinize eklendi.');
        setTimeout(() => setIsListening(false), 800);
      } catch (error: any) {
        const message = String(error?.message || 'Sesli ürün araması tamamlanamadı.');
        setVoiceError(message);
        setTimeout(() => setIsListening(false), 2500);
      }
      return;
    }

    setSearchQuery(text.trim());
    setSearchCategorySlug(null);
    setSearchProducerId(null);
    navigateToTab('search-results');
    showToast('Sesle aranan: "' + text.trim() + '"');
    setTimeout(() => setIsListening(false), 800);
  };

`;
source = source.slice(0, voiceStart) + voiceReplacement + source.slice(triggerStart);

// Never fake microphone input on unsupported devices. Report the capability truthfully.
const triggerVoiceStart = source.indexOf('  const triggerVoiceSearch = () => {');
const unsupportedVoiceStart = source.indexOf('    if (!SpeechRecognition) {', triggerVoiceStart);
const supportedVoiceTry = source.indexOf('    try {', unsupportedVoiceStart);
if (triggerVoiceStart < 0 || unsupportedVoiceStart < 0 || supportedVoiceTry < 0) {
  throw new Error('Voice capability fallback boundaries not found.');
}
const unsupportedVoiceReplacement = `    if (!SpeechRecognition) {
      setIsListening(true);
      setSpeechText('');
      setVoiceError('Bu cihazda tarayıcı sesli araması desteklenmiyor. Arama kutusunu kullanabilirsiniz.');
      setTimeout(() => setIsListening(false), 3500);
      return;
    }

`;
source = source.slice(0, unsupportedVoiceStart) + unsupportedVoiceReplacement + source.slice(supportedVoiceTry);
if (source.includes("const simulatedText = 'Karakovan Balı ekle'")) {
  throw new Error('Fake voice-search simulation remains after catalog patch.');
}

// All product clicks now keep a stable server reference for the product-detail RPC.
// Use function boundaries rather than formatting-sensitive full-text replacement.
const productClickStart = source.indexOf('  const handleProductClick = (product: any) => {');
const giftOpenStart = source.indexOf('  const openGiftModal = (product: any) => {', productClickStart);
if (productClickStart < 0 || giftOpenStart <= productClickStart) {
  throw new Error('Product click function boundaries not found.');
}
const productClickReplacement = `  const handleProductClick = (product: any) => {
    const reference = product?.slug || product?.legacyId || String(product?.id || '');
    if (!reference) {
      showToast('Ürün referansı bulunamadı.');
      return;
    }
    setSelectedProduct(product);
    setSelectedProductReference(reference);
    navigateToTab('product-detail');
    window.scrollTo(0, 0);
  };

`;
source = source.slice(0, productClickStart) + productClickReplacement + source.slice(giftOpenStart);
if (!source.includes('setSelectedProductReference(reference);')) throw new Error('Product click migration failed.');

// Replace the legacy product-detail branch with the public, server-authoritative product detail.
const productBranchStart = source.indexOf("    if (currentTab === 'product-detail'");
const accountBranchStart = source.indexOf("    if (currentTab === 'account') {", productBranchStart);
if (productBranchStart < 0 || accountBranchStart < 0) throw new Error('Product detail render boundaries not found.');
const productBranch = `    if (currentTab === 'product-detail' && (selectedProductReference || selectedProduct)) {
      const productReference = selectedProductReference || selectedProduct?.slug || selectedProduct?.legacyId || String(selectedProduct?.id || '');
      return (
        <ProductDetailScreen
          reference={productReference}
          authenticated={!!currentUser}
          onBack={goBack}
          onLoginRequired={() => { showToast('Bu işlem için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onCartChanged={fetchCart}
          onGift={(reference) => {
            if (!currentUser) {
              showToast('Hediye siparişi için hesabınıza giriş yapın.');
              navigateToTab('account');
              return;
            }
            setGiftProduct({ id: reference, slug: reference });
            setShowGiftModal(true);
          }}
          onProducer={(_producerId, producerSlug) => {
            setSelectedProducerReference(producerSlug);
            navigateToTab('producer-profile');
          }}
        />
      );
    }

`;
source = source.slice(0, productBranchStart) + productBranch + source.slice(accountBranchStart);


// AccountCenter producer links must never reopen the legacy VendorStorePage with private-ish fields.
const legacyProducerCallback = `          onOpenProducer={(slug) => {
            const vendor =
              products.find((item: any) => item.vendor?.slug === slug)?.vendor ||
              products.find((item: any) => item.vendor_slug === slug)?.vendor;
            if (vendor) {
              setSelectedVendor(vendor);
              navigateToTab('vendor-store');
            } else {
              showToast('Üretici profili güncel katalogdan açılacak.');
            }
          }}`;
if (source.includes(legacyProducerCallback)) {
  source = source.replace(legacyProducerCallback, `          onOpenProducer={(slug) => {
            setSelectedProducerReference(slug);
            navigateToTab('producer-profile');
          }}`);
}

// Add the dedicated server-catalog results route before the account branch.
const accountPos = source.indexOf("    if (currentTab === 'account') {");
if (!source.includes('<CatalogSearchResults')) {
  const resultBranch = `    if (currentTab === 'producer-profile' && selectedProducerReference) {
      return (
        <PublicProducerScreen
          reference={selectedProducerReference}
          authenticated={!!currentUser}
          onBack={goBack}
          onLoginRequired={() => { showToast('Üreticiyi takip etmek için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (product) => {
            await addToCart(product, 1);
          }}
        />
      );
    }

    if (currentTab === 'search-results') {
      return (
        <CatalogSearchResults
          query={searchQuery}
          categorySlug={searchCategorySlug}
          producerId={searchProducerId}
          onBack={goBack}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (item) => {
            await addToCart({
              id: item.id,
              slug: item.slug,
              name: item.name,
              variantId: item.variant?.id,
            }, 1);
          }}
        />
      );
    }

`;
  source = source.slice(0, accountPos) + resultBranch + source.slice(accountPos);
}

// Enter on either mobile or desktop search opens the live result list.
const blurToken = "onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}";
const enterToken = `${blurToken}\n                onKeyDown={(event) => {\n                  if (event.key === 'Enter' && searchQuery.trim()) {\n                    event.preventDefault();\n                    setSearchCategorySlug(null);\n                    setSearchProducerId(null);\n                    setIsSearchFocused(false);\n                    navigateToTab('search-results');\n                  }\n                }}`;
if (!source.includes("event.key === 'Enter' && searchQuery.trim()")) {
  const occurrences = source.split(blurToken).length - 1;
  if (occurrences < 2) throw new Error('Expected mobile and desktop search inputs were not found.');
  source = source.replaceAll(blurToken, enterToken);
}

// Replace the legacy local products.filter suggestion overlay with the server suggestion component.
const overlayStart = source.indexOf('{/* Search Suggestions (Shared context overlay) */}');
const headerClose = source.indexOf('</header>', overlayStart);
const overlayEnd = headerClose > overlayStart ? source.lastIndexOf('</div>', headerClose) : -1;
if (overlayStart < 0 || headerClose < 0 || overlayEnd <= overlayStart) throw new Error('Legacy search overlay boundaries not found.');
const overlay = `          {/* Server-backed catalog search suggestions */}
          <CatalogSearchOverlay
            query={searchQuery}
            open={isSearchFocused}
            onQueryChange={setSearchQuery}
            onProduct={(slug) => {
              setSelectedProduct(null);
              setSelectedProductReference(slug);
              setIsSearchFocused(false);
              navigateToTab('product-detail');
            }}
            onProducer={(_producerId, producerSlug) => {
              setSelectedProducerReference(producerSlug);
              setIsSearchFocused(false);
              navigateToTab('producer-profile');
            }}
            onCategory={(slug, label) => {
              setSearchCategorySlug(slug);
              setSearchProducerId(null);
              setSearchQuery(label);
              setIsSearchFocused(false);
              navigateToTab('search-results');
            }}
            onAllResults={(value) => {
              setSearchQuery(value);
              setSearchCategorySlug(null);
              setSearchProducerId(null);
              setIsSearchFocused(false);
              navigateToTab('search-results');
            }}
          />`;
source = source.slice(0, overlayStart) + overlay + source.slice(overlayEnd);


// The legacy vendor-store route used private-ish legacy fields and simulated actions.
// Keep the route name temporarily for old callers, but render only the safe public producer RPC surface.
const legacyVendorRouteStart = source.indexOf("    if (currentTab === 'vendor-store' && selectedVendor) {");
const legacyVendorRouteEnd = source.indexOf("    if (currentTab === 'categories') {", legacyVendorRouteStart);
if (legacyVendorRouteStart >= 0) {
  if (legacyVendorRouteEnd <= legacyVendorRouteStart) throw new Error('Legacy vendor-store route boundary not found.');
  const safeVendorBranch = `    if (currentTab === 'vendor-store' && selectedVendor) {
      const producerReference = selectedVendor?.slug || String(selectedVendor?.id || '');
      if (!producerReference) {
        return <div role="alert" className="mx-auto max-w-5xl p-6">Üretici referansı bulunamadı.</div>;
      }
      return (
        <PublicProducerScreen
          reference={producerReference}
          authenticated={!!currentUser}
          onBack={goBack}
          onLoginRequired={() => { showToast('Bu işlem için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (item) => {
            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variantId }, 1);
          }}
        />
      );
    }

`;
  source = source.slice(0, legacyVendorRouteStart) + safeVendorBranch + source.slice(legacyVendorRouteEnd);
}
if (source.includes('<VendorStorePage ')) {
  throw new Error('Legacy VendorStorePage route is still mounted after safe producer patch.');
}

// Replace the legacy local CategoriesPage route with the same live catalog source.
const categoryBranchStart = source.indexOf("    if (currentTab === 'categories') {");
const eventsBranchStart = source.indexOf("    if (currentTab === 'events') {", categoryBranchStart);
if (categoryBranchStart < 0 || eventsBranchStart < 0) throw new Error('Categories render branch boundaries not found.');
const categoryBranch = `    if (currentTab === 'categories') {
      return (
        <CategoryDirectoryScreen
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (item) => {
            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variant?.id }, 1);
          }}
        />
      );
    }

`;
source = source.slice(0, categoryBranchStart) + categoryBranch + source.slice(eventsBranchStart);



// Product-card favorite hearts use the backend favorite RPC instead of local-only state.
const favoriteFnStart = source.indexOf('  const toggleFavorite = (product: any) => {');
const favoriteRecipeStart = source.indexOf('  const toggleFavoriteRecipe = (recipe: any) => {', favoriteFnStart);
if (favoriteFnStart >= 0 && favoriteRecipeStart > favoriteFnStart) {
  const favoriteFn = `  const toggleFavorite = async (product: any) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
    }
    if (!currentUser) {
      showToast('Favorileri kaydetmek için hesabınıza giriş yapın.');
      navigateToTab('account');
      return;
    }
    try {
      const result = await serverToggleProductFavorite(product.slug || product.legacyId || product.id);
      const reference = String(result?.productReference || product.legacyId || product.id);
      setFavorites((previous) => result?.isFavorite
        ? (previous.includes(reference) ? previous : [...previous, reference])
        : previous.filter((id) => id !== reference));
      showToast(result?.isFavorite ? String(product.name || 'Ürün') + ' favorilerinize eklendi.' : String(product.name || 'Ürün') + ' favorilerinizden çıkarıldı.');
    } catch (error: any) {
      showToast(String(error?.message || 'Favori işlemi tamamlanamadı.'));
    }
  };

`;
  source = source.slice(0, favoriteFnStart) + favoriteFn + source.slice(favoriteRecipeStart);
}

// Keep the existing HomeSection layout, campaigns and content, but replace its product/category authority with Supabase.
const homeStart = source.indexOf('function HomeSection(');
if (homeStart < 0) throw new Error('HomeSection not found.');
const homeEnd = source.indexOf('\nfunction ', homeStart + 20);
const homeBoundary = homeEnd > homeStart ? homeEnd : source.length;
let home = source.slice(homeStart, homeBoundary);
const oldHomeData = "  const { staticContent, products, heroCategories, homeSections } = useData();";
if (!home.includes(oldHomeData)) throw new Error('HomeSection data-source anchor not found.');
home = home.replace(oldHomeData, `  const { staticContent, heroCategories, homeSections } = useData();
  const { products, categories: liveCategories, loading: liveCatalogLoading, error: liveCatalogError } = useLiveHomeCatalog();`);

// Category matching is exact by server slug; do not use fuzzy local category-name heuristics.
const filterStart = home.indexOf('    // Map Hero categories to actual product categories');
const originComment = home.indexOf('    // Origin / Üretim Yeri Filtreleme', filterStart);
if (filterStart >= 0 && originComment > filterStart) {
  home = home.slice(0, filterStart) + `    const matchesFilter = activeFilter ? p.categorySlug === activeFilter : true;\n\n` + home.slice(originComment);
}

// Remove hard-coded product-name fallback lists (including stale organic claims). Section assignment comes from server metadata.
const strictStart = home.indexOf('  // Define strict product mapping to guarantee requested logic');
const returnStart = home.indexOf('  return (', strictStart);
if (strictStart < 0 || returnStart < 0) throw new Error('Legacy home product mapping boundaries not found.');
const serverSectionHelper = `  const featuredProductNames: string[] = [];
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

`;
home = home.slice(0, strictStart) + serverSectionHelper + home.slice(returnStart);

// Quick category cards use exact live-category slugs and public product images.
const catProductsStart = home.indexOf('                  const catProducts = products.filter(p => {');
const catProductsEnd = home.indexOf('                  }).slice(0, 3);', catProductsStart);
if (catProductsStart >= 0 && catProductsEnd > catProductsStart) {
  const end = catProductsEnd + '                  }).slice(0, 3);'.length;
  home = home.slice(0, catProductsStart) + `                  const catProducts = products.filter((p: any) => p.categorySlug === category.id).slice(0, 3);` + home.slice(end);
}
home = home.replace("{CATEGORIES.filter(c => ['bal-sifa', 'sut-sarkuteri', 'et-balik', 'meyve-sebze'].includes(c.id)).map((category) => {", "{liveCategories.filter((c: any) => ['bal-sifa', 'sut-sarkuteri', 'et-balik', 'meyve-sebze'].includes(c.id)).map((category: any) => {");

// Surface live-catalog loading/error state without hiding the rest of the useful HomeSection content.
const fragmentOpen = `  return (\n    <>`;
if (home.includes(fragmentOpen) && !home.includes('liveCatalogError &&')) {
  home = home.replace(fragmentOpen, `  return (\n    <>\n      {liveCatalogError ? <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{liveCatalogError}</div> : null}\n      {liveCatalogLoading ? <div role="status" aria-live="polite" className="mx-auto mt-4 max-w-7xl rounded-xl border p-3 text-center text-sm text-gray-500">Canlı ürün kataloğu yükleniyor…</div> : null}`);
}

for (const forbidden of ["Büyük İskender Çörek Otu Tohumu (Organik)", "Köylü İşi Organik Acı Kırmızı Biber (Pul/İsot)"]) {
  if (home.includes(forbidden)) throw new Error(`Stale home product claim still present: ${forbidden}`);
}
source = source.slice(0, homeStart) + home + source.slice(homeBoundary);


// Home cards compare the server favorite reference (legacy id when present, otherwise UUID).
source = source.replaceAll('favorites.includes(product.id)', 'favorites.includes(String(product.legacyId || product.id))');

// Remove stale unverified organic claims from legacy SEO copy while retaining the actual brand message.
source = source.replace('Golden Oremar ile VIP organik ürünler, şifalı bitkiler ve eşsiz doğa hasatları.', 'Golden Oremar ile doğrulanmış köy ürünleri, şifalı bitkiler ve seçkin doğa hasatları.');
source = source.replace('Dağlık Oremar bölgesinden gelen özel bal, organik meyveler ve doğal şifa ürünleri kategorileri.', 'Oremar bölgesinden gelen özel bal, köy ürünleri ve doğal ürün kategorileri.');


// Live header filter values: exact category slugs and only origins that exist in published products.
source = source.replace('{CATEGORIES.map((cat: any) => (', '{catalogFilterCategories.map((cat: any) => (');
source = source.replace("{['Tümü', 'Dağlıca Meraları', 'Berçelan Yaylası', 'Yüksekova', 'Toros Dağları', 'Artvin, Türkiye', 'Ege Köyleri'].map((origin) => {", "{['Tümü', ...catalogFilterOrigins].map((origin) => {");
for (const staleOrigin of ['Toros Dağları', 'Artvin, Türkiye', 'Ege Köyleri']) {
  if (source.includes(staleOrigin)) throw new Error(`Stale unrelated origin filter remains: ${staleOrigin}`);
}

// Search results use their own server-side sort/filter controls; keep the old home controls off this route.
// Bottom navigation remains visible so mobile users can always leave results.

for (const forbidden of [
  "products.filter(p => p.is_approved !== false && (p.name?.toLowerCase().includes(searchQuery",
  "['Karakovan Balı', 'Taze Kaşar Peyniri', 'Organik Işkın', 'Doğal Ürünler']",
]) {
  if (source.includes(forbidden)) throw new Error(`Legacy local search marker still active after catalog patch: ${forbidden}`);
}

fs.writeFileSync(target, source);
console.log(`Golden Oremar server catalog search + product detail integrated into ${target}`);
