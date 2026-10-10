import {StrictMode,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import { installStaleChunkListeners, markAppLoadedSuccessfully } from './lib/staleChunkRecovery';
import { setupServiceWorker } from './lib/serviceWorkerSetup';
import './index.css';
import './features/customer-experience/customerShellPolish.css';
import './features/customer-experience/videoReferencePremium.css';
import './features/customer-experience/marketplaceDensity.css';
import './features/customer-experience/productDetailCommerceDock.css';
import './features/customer-experience/premiumCompatibility.css';
import './features/customer-experience/videoRecordingExact.css';
import './features/customer-experience/storefrontNarrativePremium.css';
import './features/customer-experience/productDiscoveryPremium.css';
import './features/customer-experience/productDetailPrestige.css';
import './features/customer-experience/premiumMobileV2.css';
import './features/customer-experience/productDetailV3.css';
import { initNativeFeatures } from './native';
import { initNativePushListeners } from './features/notifications/nativePush';
import { applyThemeToDocument, resolveInitialTheme } from './features/appearance/theme';
import { loadAndApplyBrandAppearance } from './features/appearance/brandAppearance';
import { installCustomerShellRouteState } from './features/navigation/customerShellRouteState';
import { installPremiumMobileShellRuntime } from './features/customer-experience/premiumMobileShellRuntime';
import { installGlobalErrorTelemetry, sendClientError } from './lib/errorTelemetry';
import {installBackendPerformanceHints} from './lib/performanceHints';
const StoreComplianceControls = lazy(() => import('./features/store/StoreComplianceControls'));
import NativeAppUpdateBanner from './features/app-update/NativeAppUpdateBanner';
import {installCatalogMediaFallback} from './features/catalog/installCatalogMediaFallback';
import {AuthorizationProvider} from './features/auth/AuthorizationContext';

// Catch stale-deployment chunk failures that never reach a React boundary,
// and clear the recovery guard once the app has actually mounted.
installStaleChunkListeners();
setupServiceWorker();
window.addEventListener('load', () => markAppLoadedSuccessfully());

const PwaInstallPrompt=lazy(()=>import('./features/pwa/PwaInstallPrompt'));

installBackendPerformanceHints();
installCatalogMediaFallback();
installPremiumMobileShellRuntime();
const initialTheme = resolveInitialTheme();
applyThemeToDocument(initialTheme);
installCustomerShellRouteState();
installGlobalErrorTelemetry();

void loadAndApplyBrandAppearance().catch(error=>sendClientError('appearance.brand.init',error,'warning'));
void initNativeFeatures(initialTheme).catch(error=>sendClientError('native.init',error,'warning'));
void initNativePushListeners().catch(error=>sendClientError('native.push.init',error,'warning'));

// Home: the main stylesheet loads without blocking the first paint (see
// scripts/prerender-home.mjs); the app mounts once it is in.
const cssReady:Promise<void>=(window as unknown as{__goCss?:Promise<void>}).__goCss||Promise.resolve();
void cssReady.then(()=>createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthorizationProvider>
        <NativeAppUpdateBanner />
        <Suspense fallback={null}>
          <PwaInstallPrompt />
        </Suspense>
        <App />
        <Suspense fallback={null}>
          <StoreComplianceControls />
        </Suspense>
      </AuthorizationProvider>
    </ErrorBoundary>
  </StrictMode>,
));