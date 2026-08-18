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
      launchShowDuration: 2000,
      backgroundColor: "#16A34A",
      showSpinner: true,
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