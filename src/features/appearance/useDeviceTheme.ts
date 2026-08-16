import { useCallback, useEffect, useState } from 'react';
import { syncNativeAppearance } from '../../native';
import { applyThemeToDocument, resolveInitialTheme, setPersonalTheme, type AppTheme } from './theme';

export function useDeviceTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => resolveInitialTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    void syncNativeAppearance(theme).catch(error => {
      console.warn('Native appearance sync failed', error);
    });
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setPersonalTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  return { theme, setTheme };
}
