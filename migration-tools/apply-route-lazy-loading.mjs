import fs from 'node:fs';

const file='src/App.tsx';
let text=fs.readFileSync(file,'utf8');

function removeExact(value){
 const count=text.split(value).length-1;
 if(count!==1)throw new Error(`Expected one import to remove, found ${count}: ${value}`);
 text=text.replace(value,'');
}
function replaceExact(from,to,expected=1){
 const count=text.split(from).length-1;
 if(count!==expected)throw new Error(`Expected ${expected}, found ${count}: ${from.slice(0,160)}`);
 text=text.split(from).join(to);
}

for(const importText of [
 "import { AdminPage } from './pages/AdminPage';",
 "import AccountCenter from './features/account/AccountCenter';",
 "import ProducerApplicationFlow from './features/producer-onboarding/ProducerApplicationFlow';",
 "import PublicInfoScreen from './features/storefront/PublicInfoScreen';",
 "import PublicHealthScreen from './features/content/PublicHealthScreen';",
 "import PublicEventsScreen from './features/engagement/PublicEventsScreen';",
 "import PublicContactScreen from './features/engagement/PublicContactScreen';",
 "import CategoryDirectoryScreen from './features/catalog/CategoryDirectoryScreen';",
 "import PublicProducerScreen from './features/catalog/PublicProducerScreen';",
 "import ProductDetailScreen from './features/catalog/ProductDetailScreen';",
 "import CatalogSearchResults from './features/catalog/CatalogSearchResults';",
 "import AuthScreen from './features/auth/AuthScreen';",
 "import PasswordRecoveryScreen from './features/auth/PasswordRecoveryScreen';",
 "import CartCheckoutFlow from './features/cart/CartCheckoutFlow';",
 "import GiftOrderFlow from './features/gifts/GiftOrderFlow';",
]) removeExact(importText);

const lazyBlock=`
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const AccountCenter = React.lazy(() => import('./features/account/AccountCenter'));
const ProducerApplicationFlow = React.lazy(() => import('./features/producer-onboarding/ProducerApplicationFlow'));
const PublicInfoScreen = React.lazy(() => import('./features/storefront/PublicInfoScreen'));
const PublicHealthScreen = React.lazy(() => import('./features/content/PublicHealthScreen'));
const PublicEventsScreen = React.lazy(() => import('./features/engagement/PublicEventsScreen'));
const PublicContactScreen = React.lazy(() => import('./features/engagement/PublicContactScreen'));
const CategoryDirectoryScreen = React.lazy(() => import('./features/catalog/CategoryDirectoryScreen'));
const PublicProducerScreen = React.lazy(() => import('./features/catalog/PublicProducerScreen'));
const ProductDetailScreen = React.lazy(() => import('./features/catalog/ProductDetailScreen'));
const CatalogSearchResults = React.lazy(() => import('./features/catalog/CatalogSearchResults'));
const AuthScreen = React.lazy(() => import('./features/auth/AuthScreen'));
const PasswordRecoveryScreen = React.lazy(() => import('./features/auth/PasswordRecoveryScreen'));
const CartCheckoutFlow = React.lazy(() => import('./features/cart/CartCheckoutFlow'));
const GiftOrderFlow = React.lazy(() => import('./features/gifts/GiftOrderFlow'));

function RouteLoading({ label = 'Ekran yükleniyor' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="mx-auto flex min-h-32 max-w-7xl items-center justify-center p-6 text-sm font-semibold text-gray-500">{label}</div>;
}

`;
replaceExact('// --- Types ---',lazyBlock+'// --- Types ---');

const oldAdmin=`      currentTab === 'admin' && isAdminLoggedIn ? (
        <AdminPage 
          onBack={goBack}
          onLogout={async () => { 
            await signOutCurrentSession();
            setCurrentUser(null);
            setAdminSession({ checked: true, isAdmin: false, roles: [] }); 
            navigateToTab('home'); 
          }} 
        />
      ) : (`;
const newAdmin=`      currentTab === 'admin' && isAdminLoggedIn ? (
        <React.Suspense fallback={<RouteLoading label="Yönetim yükleniyor" />}>
          <AdminPage 
            onBack={goBack}
            onLogout={async () => { 
              await signOutCurrentSession();
              setCurrentUser(null);
              setAdminSession({ checked: true, isAdmin: false, roles: [] }); 
              navigateToTab('home'); 
            }} 
          />
        </React.Suspense>
      ) : (`;
replaceExact(oldAdmin,newAdmin);

replaceExact(
 `      <main>
        {renderContent()}
      </main>`,
 `      <main>
        <React.Suspense fallback={<RouteLoading />}>
          {renderContent()}
        </React.Suspense>
      </main>`
);

const oldGift=`      {showGiftModal && giftProduct && (
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
      )}`;
const newGift=`      {showGiftModal && giftProduct && (
        <React.Suspense fallback={<RouteLoading label="Hediye sipariş ekranı yükleniyor" />}>
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
        </React.Suspense>
      )}`;
replaceExact(oldGift,newGift);

for(const path of ['./pages/AdminPage','./features/account/AccountCenter','./features/catalog/ProductDetailScreen','./features/cart/CartCheckoutFlow']){
 if(!text.includes(`React.lazy(() => import('${path}')`))throw new Error(`Lazy import missing: ${path}`);
}
if(text.includes("import { AdminPage } from './pages/AdminPage';"))throw new Error('Static AdminPage import survived');
if(text.includes("import AccountCenter from './features/account/AccountCenter';"))throw new Error('Static AccountCenter import survived');
if(!text.includes('<React.Suspense fallback={<RouteLoading />}>'))throw new Error('Main route Suspense boundary missing');

fs.writeFileSync(file,text);
console.log('Route-level lazy loading applied.');
