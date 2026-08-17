import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export type NativeTheme = 'light' | 'dark';

let keyboardSignalsReady = false;

function resolveNativeTheme(theme?: string): NativeTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light' || theme === 'emerald' || theme === 'ruby' || theme === 'champagne') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

async function initNativeKeyboardSignals() {
  if (keyboardSignalsReady || !Capacitor.isNativePlatform()) return;
  keyboardSignalsReady = true;
  const root = document.documentElement;
  await Promise.all([
    Keyboard.addListener('keyboardDidShow', info => {
      root.dataset.nativeKeyboard = 'open';
      root.style.setProperty('--native-keyboard-height', `${Math.max(0, Number(info.keyboardHeight) || 0)}px`);
    }),
    Keyboard.addListener('keyboardDidHide', () => {
      delete root.dataset.nativeKeyboard;
      root.style.removeProperty('--native-keyboard-height');
    }),
  ]);
}

export const syncNativeAppearance = async (theme?: string) => {
  if (!Capacitor.isNativePlatform()) return;
  const resolved = resolveNativeTheme(theme);
  await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
};

export const initNativeFeatures = async (theme?: string) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Promise.all([
      syncNativeAppearance(theme),
      initNativeKeyboardSignals(),
    ]);
    await SplashScreen.hide();
  } catch (error) {
    console.warn('Native features init error:', error);
  }
};
