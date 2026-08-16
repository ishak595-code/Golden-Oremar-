import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import './index.css';
import { initNativeFeatures } from './native';
import { applyThemeToDocument, resolveInitialTheme } from './features/appearance/theme';

const initialTheme = resolveInitialTheme();
applyThemeToDocument(initialTheme);

// Initialize native specific behavior (StatusBar, Splash, etc.) with the same first-paint theme.
void initNativeFeatures(initialTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
