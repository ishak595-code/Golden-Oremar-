import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import './index.css';
import './features/customer-experience/customerShellPolish.css';
import { initNativeFeatures } from './native';
import { initNativePushListeners } from './features/notifications/nativePush';
import { applyThemeToDocument, resolveInitialTheme } from './features/appearance/theme';
import { loadAndApplyBrandAppearance } from './features/appearance/brandAppearance';
import { installCustomerShellRouteState } from './features/navigation/customerShellRouteState';
import { installGlobalErrorTelemetry, sendClientError } from './lib/errorTelemetry';
import StoreComplianceControls from './features/store/StoreComplianceControls';
import NativeAppUpdateBanner from './features/app-update/NativeAppUpdateBanner';

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
      <NativeAppUpdateBanner />
      <App />
      <StoreComplianceControls />
    </ErrorBoundary>
  </StrictMode>,
);