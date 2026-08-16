import { useCallback, useEffect, useState } from 'react';
import { syncNativeAppearance } from '../../native';
import {
  applyPaletteToDocument,
  applyThemeToDocument,
  resolveInitialPalette,
  resolveInitialTheme,
  setPersonalPalette,
  setPersonalTheme,
  type AppTheme,
  type PremiumPalette,
} from './theme';

export function useDeviceTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => resolveInitialTheme());
  const [palette, setPaletteState] = useState<PremiumPalette>(() => resolveInitialPalette());

  useEffect(() => {
    applyThemeToDocument(theme);
    void syncNativeAppearance(theme).catch(error => {
      console.warn('Native appearance sync failed', error);
    });
  }, [theme]);

  useEffect(() => {
    applyPaletteToDocument(palette);
  }, [palette]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setPersonalTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const setPalette = useCallback((nextPalette: PremiumPalette) => {
    setPersonalPalette(nextPalette);
    setPaletteState(nextPalette);
  }, []);

  return { theme, setTheme, palette, setPalette };
}
