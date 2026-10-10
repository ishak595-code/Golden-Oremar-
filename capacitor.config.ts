/// <reference types="@capacitor/push-notifications" />
/// <reference types="@capacitor/keyboard" />
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goldenoremar.app',
  appName: 'Golden Oremar',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
    },
    SplashScreen: {
      // Hidden by the app as soon as the first screen is painted (main.tsx);
      // this duration is only the safety net if that never happens.
      launchShowDuration: 3000,
      backgroundColor: "#16A34A",
      showSpinner: false,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff",
    },
    Keyboard: {
      resizeOnFullScreen: true,
      autoBackdropColor: 'auto',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;