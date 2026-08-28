import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import './index.css';
import './features/customer-experience/customerShellPolish.css';
import './features/customer-experience/videoReferencePremium.css';
import './features/customer-experience/marketplaceDensity.css';
import './features/customer-experience/productDetailCommerceDock.css';
import './features/customer-experience/premiumCompatibility.css';
import './features/customer-experience/videoRecordingExact.css';
import './features/customer-experience/storefrontNarrativePremium.css';
import './features/customer-experience/productDiscoveryPremium.css';
import './features/customer-experience/productDetailConnectionsPremium.css';
import './features/customer-experience/productDetailPrestige.css';
import './features/customer-experience/premiumMobileV2.css';
import { initNativeFeatures } from './native';
import { initNativePushListeners } from './features/notifications/nativePush';
import { applyThemeToDocument, resolveInitialTheme } from './features/appearance/theme';
import { loadAndApplyBrandAppearance } from './features/appearance/brandAppearance';
import { installCustomerShellRouteState } from './features/navigation/customerShellRouteState';
import { installPremiumMobileShellRuntime } from './features/customer-experience/premiumMobileShellRuntime';
import { installGlobalErrorTelemetry, sendClientError } from './lib/errorTelemetry';
import {installBackendPerformanceHints} from './lib/performanceHints';
import StoreComplianceControls from './features/store/StoreComplianceControls';
import NativeAppUpdateBanner from './features/app-update/NativeAppUpdateBanner';
import ProductDetailConnections from './features/catalog/ProductDetailConnections';
import ProductRecommendationsRail from './features/catalog/ProductRecommendationsRail';
import {installCatalogMediaFallback} from './features/catalog/installCatalogMediaFallback';
import {AuthorizationProvider} from './features/auth/AuthorizationContext';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthorizationProvider>
        <NativeAppUpdateBanner />
        <App />
        <ProductDetailConnections />
        <ProductRecommendationsRail />
        <StoreComplianceControls />
      </AuthorizationProvider>
    </ErrorBoundary>
  </StrictMode>,
);