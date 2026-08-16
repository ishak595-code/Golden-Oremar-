import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const initNativeFeatures = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Set status bar to light/dark depending on app theme
      await StatusBar.setStyle({ style: Style.Dark });
      
      // Optionally hide it if we want fullscreen immersive
      // await StatusBar.hide();

      // Show splash screen until React is fully mounted
      await SplashScreen.hide();
    } catch (error) {
      console.warn('Native features init error:', error);
    }
  }
};
