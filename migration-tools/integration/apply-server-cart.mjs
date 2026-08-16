import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');

const accountImport = "import AccountCenter from './features/account/AccountCenter';";
const cartImport = "import CartCheckoutFlow from './features/cart/CartCheckoutFlow';";
const cartApiImport = "import { getCart as getServerCart, publicCatalogUrl as serverCatalogUrl, removeCartItem as removeServerCartItem, resolveDefaultVariant, setCartItem as setServerCartItem } from './features/cart/api';";

function addImport(line) {
  if (source.includes(line)) return;
  if (source.includes(accountImport)) source = source.replace(accountImport, `${accountImport}\n${line}`);
  else {
    const anchor = "import VendorOnboarding from './pages/VendorOnboarding';";
    if (!source.includes(anchor)) throw new Error('Import anchor not found; refusing unsafe cart patch.');
    source = source.replace(anchor, `${anchor}\n${line}`);
  }
}
addImport(cartImport);
addImport(cartApiImport);

// Replace the legacy Firestore cart helpers while keeping the public helper names used by product cards.
const helperStart = source.indexOf('  const fetchCart = async () => {');
const favoriteStart = source.indexOf('  const toggleFavorite = (product: any) => {', helperStart);
if (helperStart < 0 || favoriteStart < 0) throw new Error('Legacy cart helper boundaries not found; refusing unsafe patch.');

const helperReplacement = `  const applyServerCartSnapshot = (snapshot: any) => {
    const nextItems = (snapshot?.items || []).map((item: any) => ({
      id: item.productId,
      slug: item.slug,
      name: item.productName,
      price: Number(item.priceMinor || 0) / 100,
      image: serverCatalogUrl(item.imagePath),
      quantity: item.quantity,
      variantId: item.variantId,
      variantName: item.variantName,
      cartItemId: item.cartItemId,
      selectedOptions: item.selectedOptions || {},
      sellableQuantity: item.sellableQuantity,
      producer: item.producer,
      _serverCart: true,
    }));
    setCart(nextItems);
    return snapshot;
  };

  const fetchCart = async () => {
    try {
      const snapshot = await getServerCart();
      applyServerCartSnapshot(snapshot);
    } catch (err: any) {
      // Authentication migration is handled separately; never fall back to Firestore.
      if (!String(err?.message || '').includes('authentication_required')) {
        console.error('Failed to fetch Supabase cart', err);
      }
      setCart([]);
    }
  };

  useEffect(() => {
    void fetchCart();
  }, [currentUser]);

  const addToCart = async (product: any, quantity: number = 1, silent: boolean = false) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
    }
    try {
      const reference = product.slug || String(product.id);
      const existing = cart.find((item: any) => item.slug === product.slug || String(item.id) === String(product.id));
      let variantId = product.variantId || existing?.variantId;
      let selectedOptions = existing?.selectedOptions || {};
      if (!variantId) {
        const resolved = await resolveDefaultVariant(reference);
        variantId = resolved.variant.id;
        selectedOptions = resolved.variant.options || {};
      }
      const nextQuantity = Math.min(99, Math.max(1, Number(existing?.quantity || 0) + quantity));
      const snapshot = await setServerCartItem({ variantId, quantity: nextQuantity, selectedOptions });
      applyServerCartSnapshot(snapshot);
      if (!silent) showToast(\`${'${product.name || product.title}'} özenle sepetinize eklendi!\`);
    } catch (err: any) {
      const message = String(err?.message || 'Ürün sepete eklenemedi.');
      if (message.includes('authentication_required')) {
        showToast('Sepeti kaydetmek için hesabınıza giriş yapın.');
        navigateToTab('account');
        return;
      }
      showToast(message.includes('insufficient_stock') ? 'Bu ürün için yeterli stok kalmadı.' : message);
    }
  };

  const updateCartQuantity = async (productId: string | number, delta: number) => {
    const item = cart.find((row: any) => String(row.id) === String(productId));
    if (!item?.variantId) return;
    try {
      const nextQuantity = Math.max(0, Math.min(99, Number(item.quantity || 1) + delta));
      const snapshot = await setServerCartItem({ variantId: item.variantId, quantity: nextQuantity, selectedOptions: item.selectedOptions || {} });
      applyServerCartSnapshot(snapshot);
    } catch (err: any) {
      showToast(String(err?.message || 'Sepet güncellenemedi.'));
    }
  };

  const removeFromCart = async (productId: string | number) => {
    const item = cart.find((row: any) => String(row.id) === String(productId));
    if (!item?.cartItemId) return;
    try {
      const snapshot = await removeServerCartItem(item.cartItemId);
      applyServerCartSnapshot(snapshot);
      showToast('Ürün sepetten çıkarıldı.');
    } catch (err: any) {
      showToast(String(err?.message || 'Ürün sepetten çıkarılamadı.'));
    }
  };

`;
source = source.slice(0, helperStart) + helperReplacement + source.slice(favoriteStart);

// Remove the obsolete Firestore checkout function. Checkout is now owned by CartCheckoutFlow.
const checkoutStart = source.indexOf('  const handleCheckout = async () => {');
const renderMarker = source.indexOf('  // Render Content', checkoutStart);
if (checkoutStart >= 0 && renderMarker > checkoutStart) {
  source = source.slice(0, checkoutStart) + source.slice(renderMarker);
}

// Replace only the current cart render branch.
const cartBranchStart = source.indexOf("    if (currentTab === 'cart') {");
const vendorBranchStart = source.indexOf("    if (currentTab === 'vendor-store'", cartBranchStart);
if (cartBranchStart < 0 || vendorBranchStart < 0) throw new Error('Cart render branch boundaries not found; refusing unsafe patch.');
const cartBranch = `    if (currentTab === 'cart') {
      return (
        <CartCheckoutFlow
          onBack={() => navigateToTab('home')}
          onOpenAddresses={() => { navigateToTab('account'); setAccountView('addresses'); }}
          onOrderCreated={() => {
            setCart([]);
            setAccountView('orders');
          }}
        />
      );
    }

`;
source = source.slice(0, cartBranchStart) + cartBranch + source.slice(vendorBranchStart);

fs.writeFileSync(target, source);
console.log(`Golden Oremar Supabase cart + checkout integrated into ${target}`);
