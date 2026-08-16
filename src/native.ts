import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export type NativeTheme = 'light' | 'dark';

function resolveNativeTheme(theme?: string): NativeTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light' || theme === 'emerald' || theme === 'ruby' || theme === 'champagne') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export const syncNativeAppearance = async (theme?: string) => {
  if (!Capacitor.isNativePlatform()) return;
  const resolved = resolveNativeTheme(theme);
  await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
};

export const initNativeFeatures = async (theme?: string) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await syncNativeAppearance(theme);
    await SplashScreen.hide();
  } catch (error) {
    console.warn('Native features init error:', error);
  }
};
