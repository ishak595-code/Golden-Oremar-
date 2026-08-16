import fs from 'node:fs';

function patchFile(file, patches) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to, label] of patches) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${file} ${label}: expected 1 match, found ${count}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text);
}

patchFile('src/features/account/SettingsPanel.tsx', [
  [
    `import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';`,
    `import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';\nimport PremiumPersonalizationPanel from'./PremiumPersonalizationPanel';\nimport type{AppTheme,PremiumPalette}from'../appearance/theme';\nimport type{NotificationSoundId}from'../notifications/notificationSound';`,
    'settings imports',
  ],
  [
    `export default function SettingsPanel({closure,onChanged,profile,theme='light',onThemeChange}:{closure:any;onChanged:()=>Promise<void>|void;profile?:any;theme?:string;onThemeChange?:(theme:'light'|'dark')=>void}){`,
    `export default function SettingsPanel({closure,onChanged,profile,theme='light',palette='emerald',notificationSound='rain-drop',onThemeChange,onPaletteChange,onNotificationSoundChange,onPreviewNotificationSound}:{closure:any;onChanged:()=>Promise<void>|void;profile?:any;theme?:AppTheme;palette?:PremiumPalette;notificationSound?:NotificationSoundId;onThemeChange?:(theme:AppTheme)=>void;onPaletteChange?:(palette:PremiumPalette)=>void;onNotificationSoundChange?:(sound:NotificationSoundId)=>void;onPreviewNotificationSound?:(sound:NotificationSoundId)=>Promise<boolean>|boolean}){`,
    'settings props',
  ],
  [
    `  <Panel title="Görünüm" description="Bu cihazda uygulamanın aydınlık veya karanlık görünümünü seçin.">\n    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Görünüm seçimi">\n      <button type="button" role="radio" aria-checked={theme==='light'} onClick={()=>onThemeChange?.('light')} className={\`min-h-12 rounded-xl border px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold \${theme==='light'?'border-brand-gold bg-brand-gold/10 text-brand-gold':'border-gray-200 dark:border-gray-700'}\`}>Aydınlık</button>\n      <button type="button" role="radio" aria-checked={theme==='dark'} onClick={()=>onThemeChange?.('dark')} className={\`min-h-12 rounded-xl border px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold \${theme==='dark'?'border-brand-gold bg-brand-gold/10 text-brand-gold':'border-gray-200 dark:border-gray-700'}\`}>Karanlık</button>\n    </div>\n  </Panel>`,
    `  <PremiumPersonalizationPanel theme={theme} palette={palette} sound={notificationSound} onThemeChange={onThemeChange} onPaletteChange={onPaletteChange} onSoundChange={onNotificationSoundChange} onPreviewSound={onPreviewNotificationSound}/>`,
    'replace appearance panel',
  ],
]);

patchFile('src/features/account/AccountCenter.tsx', [
  [
    `import ReviewsPanel from'./ReviewsPanel';`,
    `import ReviewsPanel from'./ReviewsPanel';\nimport type{AppTheme,PremiumPalette}from'../appearance/theme';\nimport type{NotificationSoundId}from'../notifications/notificationSound';`,
    'account type imports',
  ],
  [
    ` requestedView,theme,onThemeChange,onOpenProduct,onOpenProducer,onStartGift,onOpenMessages,onOpenNotificationAction,onUnreadNotificationCountChange,onOpenContact,onOpenHealth,onOpenEvents,onOpenAdmin,onOpenSellerApplication,onOpenSellerProductManager,onBack`,
    ` requestedView,theme,palette,notificationSound,onThemeChange,onPaletteChange,onNotificationSoundChange,onPreviewNotificationSound,onOpenProduct,onOpenProducer,onStartGift,onOpenMessages,onOpenNotificationAction,onUnreadNotificationCountChange,onOpenContact,onOpenHealth,onOpenEvents,onOpenAdmin,onOpenSellerApplication,onOpenSellerProductManager,onBack`,
    'account destructured props',
  ],
  [
    ` requestedView?:string; theme?:string; onThemeChange?:(theme:'light'|'dark')=>void; onOpenProduct?:(slug:string)=>void;`,
    ` requestedView?:string; theme?:AppTheme; palette?:PremiumPalette; notificationSound?:NotificationSoundId; onThemeChange?:(theme:AppTheme)=>void; onPaletteChange?:(palette:PremiumPalette)=>void; onNotificationSoundChange?:(sound:NotificationSoundId)=>void; onPreviewNotificationSound?:(sound:NotificationSoundId)=>Promise<boolean>|boolean; onOpenProduct?:(slug:string)=>void;`,
    'account prop types',
  ],
  [
    `  if(view==='settings')return<SettingsPanel closure={overview.account_closure} profile={overview.profile} onChanged={refresh} theme={theme} onThemeChange={onThemeChange}/>;`,
    `  if(view==='settings')return<SettingsPanel closure={overview.account_closure} profile={overview.profile} onChanged={refresh} theme={theme} palette={palette} notificationSound={notificationSound} onThemeChange={onThemeChange} onPaletteChange={onPaletteChange} onNotificationSoundChange={onNotificationSoundChange} onPreviewNotificationSound={onPreviewNotificationSound}/>;`,
    'settings wiring',
  ],
]);

patchFile('src/App.tsx', [
  [
    `import React, { useState, useEffect, useCallback } from 'react';`,
    `import React, { useState, useEffect, useCallback, useRef } from 'react';`,
    'react useRef',
  ],
  [
    `import { useDeviceTheme } from './features/appearance/useDeviceTheme';`,
    `import { useDeviceTheme } from './features/appearance/useDeviceTheme';import { useNotificationSound } from './features/notifications/useNotificationSound';`,
    'notification sound hook import',
  ],
  [
    `  const { theme: appearanceTheme, setTheme: setAppearanceTheme } = useDeviceTheme();`,
    `  const { theme: appearanceTheme, setTheme: setAppearanceTheme, palette: appearancePalette, setPalette: setAppearancePalette } = useDeviceTheme();`,
    'device theme destructure',
  ],
  [
    `  const authRecovery = useAuthRecoveryCoordinator();\n  const { unreadCount, setUnreadCount } = useUnreadNotificationCount(!!currentUser);`,
    `  const authRecovery = useAuthRecoveryCoordinator();\n  const { sound: notificationSound, setSound: setNotificationSound, previewSound: previewNotificationSound } = useNotificationSound();\n  const { unreadCount, setUnreadCount, hydrated: notificationsHydrated } = useUnreadNotificationCount(!!currentUser);\n  const unreadSoundBaselineRef = useRef<number | null>(null);\n\n  useEffect(() => {\n    if (!currentUser) { unreadSoundBaselineRef.current = null; return; }\n    if (!notificationsHydrated) return;\n    const previous = unreadSoundBaselineRef.current;\n    if (previous === null) { unreadSoundBaselineRef.current = unreadCount; return; }\n    if (unreadCount > previous) void previewNotificationSound();\n    unreadSoundBaselineRef.current = unreadCount;\n  }, [currentUser, notificationsHydrated, unreadCount, previewNotificationSound]);`,
    'notification hydration sound effect',
  ],
  [
    `          theme={appearanceTheme}\n          onThemeChange={setAppearanceTheme}`,
    `          theme={appearanceTheme}\n          palette={appearancePalette}\n          notificationSound={notificationSound}\n          onThemeChange={setAppearanceTheme}\n          onPaletteChange={setAppearancePalette}\n          onNotificationSoundChange={setNotificationSound}\n          onPreviewNotificationSound={previewNotificationSound}`,
    'account personalization props',
  ],
]);

console.log('Premium theme and notification sound wiring applied.');
