
import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');

const importLine = "import AccountCenter from './features/account/AccountCenter';";
if (!source.includes(importLine)) {
  const anchor = "import VendorOnboarding from './pages/VendorOnboarding';";
  if (!source.includes(anchor)) {
    throw new Error('VendorOnboarding import anchor not found; refusing unsafe patch.');
  }
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const accountRenderStart = source.indexOf("    if (currentTab === 'account') {");
const cartRenderStart = source.indexOf("    if (currentTab === 'cart') {", accountRenderStart);

if (accountRenderStart < 0 || cartRenderStart < 0) {
  throw new Error('Account render block boundaries not found; refusing unsafe patch.');
}

const replacement = `    if (currentTab === 'account') {
      if (accountView === 'vendor-apply') {
        return <VendorOnboarding />;
      }

      return (
        <AccountCenter
          requestedView={accountView}
          theme={settings.theme}
          onThemeChange={(nextTheme) => updateSettings({ theme: nextTheme })}
          onBack={goBack}
          onOpenProduct={(slug) => {
            const product = products.find((item: any) =>
              item.slug === slug || String(item.id) === slug
            );
            if (product) {
              handleProductClick(product);
            } else {
              showToast('Ürün güncel katalogda bulunamadı.');
            }
          }}
          onOpenProducer={(slug) => {
            const vendor =
              products.find((item: any) => item.vendor?.slug === slug)?.vendor ||
              products.find((item: any) => item.vendor_slug === slug)?.vendor;
            if (vendor) {
              setSelectedVendor(vendor);
              navigateToTab('vendor-store');
            } else {
              showToast('Üretici profili güncel katalogdan açılacak.');
            }
          }}
          onStartGift={() => navigateToTab('home')}
          onOpenContact={() => navigateToTab('contact')}
          onOpenHealth={() => navigateToTab('health')}
          onOpenEvents={() => navigateToTab('events')}
          onOpenAdmin={() => navigateToTab('admin')}
          onOpenSellerApplication={() => setAccountView('vendor-apply')}
          onOpenNotificationAction={(url) => {
            if (url?.includes('/messages/')) setAccountView('support');
            else if (url?.includes('producer')) setAccountView('seller');
            else if (url?.includes('order')) setAccountView('orders');
          }}
        />
      );
    }

`;

source = source.slice(0, accountRenderStart) + replacement + source.slice(cartRenderStart);

// Delete the entire legacy AccountSection + AccountMenuItem block.
// Verified legacy boundary: `// --- Account Section ---` -> immediately before `function CartSection`.
const legacyStart = source.indexOf('// --- Account Section ---');
const cartComponentStart = source.indexOf('function CartSection(', legacyStart);

if (legacyStart < 0 || cartComponentStart < 0 || cartComponentStart <= legacyStart) {
  throw new Error('Legacy AccountSection boundaries not found; refusing unsafe deletion.');
}

source = source.slice(0, legacyStart) + source.slice(cartComponentStart);

fs.writeFileSync(target, source);
console.log(`Golden Oremar AccountCenter integrated into ${target}`);
