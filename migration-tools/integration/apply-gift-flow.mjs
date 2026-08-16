
import fs from 'node:fs';

const target=process.argv[2]||'src/App.tsx';
let source=fs.readFileSync(target,'utf8');

const importAnchor="import AccountCenter from './features/account/AccountCenter';";
const giftImport="import GiftOrderFlow from './features/gifts/GiftOrderFlow';";
if(!source.includes(giftImport)){
  if(source.includes(importAnchor)) source=source.replace(importAnchor,`${importAnchor}\n${giftImport}`);
  else{
    const vendorAnchor="import VendorOnboarding from './pages/VendorOnboarding';";
    if(!source.includes(vendorAnchor))throw new Error('Import anchor not found; refusing unsafe patch.');
    source=source.replace(vendorAnchor,`${vendorAnchor}\n${giftImport}`);
  }
}

// Replace only the mounted legacy GiftModal usage. The old GiftModal function may then be removed separately.
const mountStart=source.indexOf('      {/* Gift Modal */}');
const voiceStart=source.indexOf('      {/* Voice Search',mountStart);
if(mountStart<0||voiceStart<0)throw new Error('Gift modal mount boundary not found; refusing unsafe patch.');

const replacement=`      {/* Real Gift Order Flow */}
      {showGiftModal && giftProduct && (
        <GiftOrderFlow
          productReference={giftProduct.slug || String(giftProduct.id)}
          onClose={() => setShowGiftModal(false)}
          onCreated={() => {
            showToast('Hediye siparişiniz oluşturuldu ve ödeme doğrulaması bekliyor.');
            setShowGiftModal(false);
            navigateToTab('account');
            setAccountView('gifts');
          }}
        />
      )}

`;

source=source.slice(0,mountStart)+replacement+source.slice(voiceStart);

// Remove the legacy GiftModal function only; AccordionItem before it and AccountSection after it are separate.
const functionStart=source.indexOf('function GiftModal(');
if(functionStart>=0){
  const accountMarker=source.indexOf('// --- Account Section ---',functionStart);
  const cartMarker=source.indexOf('function CartSection(',functionStart);
  const endMarker=accountMarker>functionStart?accountMarker:cartMarker;
  if(endMarker<=functionStart){
    throw new Error('Legacy GiftModal end boundary not found; refusing unsafe deletion.');
  }
  source=source.slice(0,functionStart)+source.slice(endMarker);
}

fs.writeFileSync(target,source);
console.log(`Golden Oremar real gift flow integrated into ${target}`);
