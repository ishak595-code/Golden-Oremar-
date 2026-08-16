import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import './index.css';
import { initNativeFeatures } from './native';
import { initNativePushListeners } from './features/notifications/nativePush';
import { applyThemeToDocument, resolveInitialTheme } from './features/appearance/theme';

const initialTheme = resolveInitialTheme();
applyThemeToDocument(initialTheme);

// Initialize native specific behavior (StatusBar, Splash, etc.) with the same first-paint theme.
void initNativeFeatures(initialTheme);
void initNativePushListeners().catch(error => console.warn('Native push listener init failed:', error));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
