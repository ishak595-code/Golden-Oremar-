import fs from 'node:fs';
import path from 'node:path';

const APP_ID = 'com.goldenoremar.app';
const APP_NAME = 'Golden Oremar';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content); }
function replaceExact(file, from, to, expectedCount = 1) {
  let text = read(file);
  const count = text.split(from).length - 1;
  if (count !== expectedCount) throw new Error(`${file}: expected ${expectedCount} occurrences of ${JSON.stringify(from)}, found ${count}`);
  text = text.split(from).join(to);
  write(file, text);
}

// Android canonical identity and Capacitor 8-compatible Java/Kotlin toolchain.
replaceExact('android/app/build.gradle', 'namespace = "com.market.app"', `namespace = "${APP_ID}"`);
replaceExact('android/app/build.gradle', 'applicationId "com.market.app"', `applicationId "${APP_ID}"`);
replaceExact('android/app/build.gradle', 'sourceCompatibility JavaVersion.VERSION_17', 'sourceCompatibility JavaVersion.VERSION_21');
replaceExact('android/app/build.gradle', 'targetCompatibility JavaVersion.VERSION_17', 'targetCompatibility JavaVersion.VERSION_21');
replaceExact('android/app/build.gradle', "jvmTarget = '17'", "jvmTarget = '21'");
replaceExact('android/app/src/main/res/values/strings.xml', '<string name="app_name">E-Ticaret</string>', `<string name="app_name">${APP_NAME}</string>`);
replaceExact('android/app/src/main/res/values/strings.xml', '<string name="title_activity_main">E-Ticaret</string>', `<string name="title_activity_main">${APP_NAME}</string>`);
replaceExact('android/app/src/main/res/values/strings.xml', '<string name="package_name">com.market.app</string>', `<string name="package_name">${APP_ID}</string>`);
replaceExact('android/app/src/main/res/values/strings.xml', '<string name="custom_url_scheme">com.market.app</string>', `<string name="custom_url_scheme">${APP_ID}</string>`);
replaceExact('android/app/src/main/AndroidManifest.xml', 'android:allowBackup="true"', 'android:allowBackup="false"');

const oldActivity = 'android/app/src/main/java/com/market/app/MainActivity.kt';
const newActivity = 'android/app/src/main/java/com/goldenoremar/app/MainActivity.kt';
if (!fs.existsSync(oldActivity)) throw new Error('Legacy MainActivity path missing; refusing blind move.');
const oldActivityText = read(oldActivity);
if (oldActivityText.trim() !== 'package com.market.app\n\nimport com.getcapacitor.BridgeActivity\n\nclass MainActivity : BridgeActivity()') {
  throw new Error('Legacy MainActivity content changed; refusing blind move.');
}
fs.mkdirSync(path.dirname(newActivity), { recursive: true });
write(newActivity, `package ${APP_ID}\n\nimport com.getcapacitor.BridgeActivity\n\nclass MainActivity : BridgeActivity()\n`);
fs.unlinkSync(oldActivity);

// iOS canonical identity and visible name.
replaceExact('ios/App/App.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = com.market.app;', `PRODUCT_BUNDLE_IDENTIFIER = ${APP_ID};`, 2);
replaceExact('ios/App/App/Info.plist', '<string>E-Ticaret</string>', `<string>${APP_NAME}</string>`);

// Theme-aware native status bar. Capacitor Style.Dark = light text on a dark background,
// Style.Light = dark text on a light background.
write('src/native.ts', `import { Capacitor } from '@capacitor/core';\nimport { StatusBar, Style } from '@capacitor/status-bar';\nimport { SplashScreen } from '@capacitor/splash-screen';\n\nexport type NativeTheme = 'light' | 'dark';\n\nfunction resolveNativeTheme(theme?: string): NativeTheme {\n  if (theme === 'dark' || theme === 'light') return theme;\n  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';\n  return 'light';\n}\n\nexport const syncNativeAppearance = async (theme?: string) => {\n  if (!Capacitor.isNativePlatform()) return;\n  const resolved = resolveNativeTheme(theme);\n  await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });\n};\n\nexport const initNativeFeatures = async () => {\n  if (!Capacitor.isNativePlatform()) return;\n  try {\n    await syncNativeAppearance();\n    await SplashScreen.hide();\n  } catch (error) {\n    console.warn('Native features init error:', error);\n  }\n};\n`);

// App: import theme sync helper.
replaceExact(
  'src/App.tsx',
  "import GiftOrderFlow from './features/gifts/GiftOrderFlow';import { query } from 'firebase/firestore';",
  "import GiftOrderFlow from './features/gifts/GiftOrderFlow';import { syncNativeAppearance } from './native';import { query } from 'firebase/firestore';"
);

// App: fix Android back priority and remove only listeners owned by this effect.
const oldBackEffect = `  useEffect(() => {\n    if (Capacitor.isNativePlatform()) {\n      CapApp.addListener('backButton', ({ canGoBack }) => {\n        if (!canGoBack || tabHistory.length <= 1) {\n          CapApp.exitApp();\n        } else {\n          goBack();\n        }\n      });\n\n      Network.addListener('networkStatusChange', status => {\n        if (!status.connected) {\n          showToast('İnternet bağlantısı kesildi.');\n        }\n      });\n    }\n\n    return () => {\n      if (Capacitor.isNativePlatform()) {\n        CapApp.removeAllListeners();\n        Network.removeAllListeners();\n      }\n    };\n  }, [tabHistory, currentTab, accountView]);`;
const newBackEffect = `  useEffect(() => {\n    if (!Capacitor.isNativePlatform()) return;\n\n    let disposed = false;\n    let appBackHandle: { remove: () => Promise<void> } | undefined;\n    let networkHandle: { remove: () => Promise<void> } | undefined;\n\n    void CapApp.addListener('backButton', () => {\n      if (isSearchFocused) {\n        setIsSearchFocused(false);\n        return;\n      }\n      if (showGiftModal) {\n        setShowGiftModal(false);\n        return;\n      }\n      if (showNotifications) {\n        setShowNotifications(false);\n        return;\n      }\n      if (isFilterPanelOpen) {\n        setIsFilterPanelOpen(false);\n        return;\n      }\n      if (isSortPanelOpen) {\n        setIsSortPanelOpen(false);\n        return;\n      }\n      if (currentTab === 'account' && accountView !== 'menu') {\n        setAccountView('menu');\n        return;\n      }\n      if (tabHistory.length > 1) {\n        goBack();\n        return;\n      }\n      void CapApp.exitApp();\n    }).then(handle => {\n      if (disposed) void handle.remove();\n      else appBackHandle = handle;\n    });\n\n    void Network.addListener('networkStatusChange', status => {\n      if (!status.connected) showToast('İnternet bağlantısı kesildi.');\n    }).then(handle => {\n      if (disposed) void handle.remove();\n      else networkHandle = handle;\n    });\n\n    return () => {\n      disposed = true;\n      if (appBackHandle) void appBackHandle.remove();\n      if (networkHandle) void networkHandle.remove();\n    };\n  }, [tabHistory, currentTab, accountView, isSearchFocused, showGiftModal, showNotifications, isFilterPanelOpen, isSortPanelOpen]);`;
replaceExact('src/App.tsx', oldBackEffect, newBackEffect);

const oldThemeEffect = `  useEffect(() => {\n    document.documentElement.setAttribute('data-theme', settings.theme);\n  }, [settings.theme]);`;
const newThemeEffect = `  useEffect(() => {\n    document.documentElement.setAttribute('data-theme', settings.theme);\n    void syncNativeAppearance(settings.theme).catch(error => {\n      console.warn('Native appearance sync failed', error);\n    });\n  }, [settings.theme]);`;
replaceExact('src/App.tsx', oldThemeEffect, newThemeEffect);

// Guard against partial identity/toolchain migration in source configuration.
const identityFiles = [
  'capacitor.config.ts',
  'android/app/build.gradle',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/res/values/strings.xml',
  newActivity,
  'ios/App/App/Info.plist',
  'ios/App/App.xcodeproj/project.pbxproj',
];
for (const file of identityFiles) {
  const text = read(file);
  if (text.includes('com.market.app')) throw new Error(`${file}: legacy package id survived`);
  if (text.includes('E-Ticaret')) throw new Error(`${file}: legacy display name survived`);
}
const androidGradle = read('android/app/build.gradle');
if (androidGradle.includes('JavaVersion.VERSION_17') || androidGradle.includes("jvmTarget = '17'")) {
  throw new Error('android/app/build.gradle: legacy Java/Kotlin 17 target survived');
}
if (!androidGradle.includes('JavaVersion.VERSION_21') || !androidGradle.includes("jvmTarget = '21'")) {
  throw new Error('android/app/build.gradle: Java/Kotlin 21 target missing');
}
if (fs.existsSync(oldActivity)) throw new Error('Legacy MainActivity path survived');

console.log('Native shell hardening applied successfully.');
