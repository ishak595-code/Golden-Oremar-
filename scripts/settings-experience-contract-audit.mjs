// Settings: notification preferences tied to real events, saves that confirm,
// back navigation that returns to the settings list, themes that reach every
// screen, and no language offered for a UI that is not translated.
//
// October 2026: the settings screens were checked one by one. Theme and sound
// saves jumped back to the list without a word, browser and Android back left
// settings altogether, the home screen stayed dark in every light theme, and
// "Uygulama dili" offered six languages while the app is Turkish only.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const migration = read('supabase/migrations/20261004170000_notification_preferences_v2.sql');
const api = read('src/features/account/notificationPreferencesApi.ts');
const panel = read('src/features/account/NotificationPreferencesPanel.tsx');
const settings = read('src/features/account/SettingsPanel.tsx');
const premium = read('src/features/account/PremiumPreferencesPanel.tsx');
const appUrl = read('src/features/navigation/appUrl.ts');
const account = read('src/features/account/AccountCenter.tsx');
const app = read('src/App.tsx');
const profile = read('src/features/account/ProfilePanel.tsx');
const home = read('src/features/home/HomeSection.tsx');
const homeLight = read('src/features/home/homeLightThemes.css');

// 1. Notification preferences: real events, real channels, enforced in the database.
const keys = [...api.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
for (const key of ['order', 'shipment', 'payment', 'return', 'harvest', 'restock', 'message', 'review_reminder', 'review', 'campaign', 'system', 'producer']) {
  check(keys.includes(key), `notificationPreferencesApi.ts must list the ${key} category.`);
  check(migration.includes(`'${key}', jsonb_build_object(`), `get_my_notification_preferences_v2 must return the ${key} category.`);
  check(panel.includes(`key: '${key}'`), `The notification settings screen must show the ${key} category.`);
}
check(api.includes("'get_my_notification_preferences_v2'") && api.includes("'update_my_notification_preferences_v2'"), 'Notification preferences must be read and saved through the v2 RPCs.');
check(/create trigger apply_notification_preferences_v2\s+before insert on public\.notifications/.test(migration), 'Opted-out engagement notifications must be stopped by a BEFORE INSERT trigger on public.notifications.');
check(/private\.should_queue_push_v2\(new\.user_id, new\.type, new\.metadata\)/.test(migration), 'Push queuing must use should_queue_push_v2 (categories and quiet hours).');
check(/in_quiet_hours_v1/.test(migration) && /Europe\/Istanbul/.test(migration), 'Quiet hours must be evaluated in Europe/Istanbul time.');
check(/campaign_push_requires_marketing_consent/.test(migration), 'Campaign push must still require marketing consent.');
check(!/SMS'|'sms'|label=\{`\$\{row\.title\}, e-posta/i.test(panel), 'No SMS or per-category e-mail channel may be offered: the backend has neither.');
check(/role="switch"/.test(panel) && /aria-checked=\{checked\}/.test(panel), 'Notification toggles must be accessible switches.');
check(/Sessiz saatler/.test(panel), 'Quiet hours must be configurable.');
check(!/getNotificationPreferences\b|update_my_notification_preferences_v1/.test(settings), 'Settings must not use the v1 notification preferences any more.');

// 2. Saves confirm with a toast; the list is not left silently.
check(/export function showAppToast/.test(read('src/lib/appToast.ts')), 'src/lib/appToast.ts must export showAppToast.');
check(/APP_TOAST_EVENT/.test(app) && /addEventListener\(APP_TOAST_EVENT/.test(app), 'App must render the toasts that lazy screens announce.');
check(/showAppToast\(message\)/.test(panel), 'Notification changes must confirm with a toast.');
check(/onSaved\?\.\('Tema kaydedildi'\)/.test(premium) && /onSaved=\{message=>setSuccessMessage\(message\)\}/.test(settings), 'Theme and sound saves must confirm with a toast and stay on the screen.');
check(/showAppToast\('Kaydedildi'\)/.test(profile), 'Profile saves must confirm with a toast.');

// 3. Every settings screen has an address, so back returns to the list.
const subviews = s => (s.match(/SETTINGS_SUBVIEWS\s*=\s*new Set(?:<string>)?\(\[([^\]]+)\]/)?.[1] || '').replace(/\s/g, '');
check(subviews(settings) && subviews(settings) === subviews(appUrl), 'SettingsPanel and appUrl.ts must accept the same settings screens.');
check(/prefix === 'settings' && SETTINGS_SUBVIEWS\.has\(suffix\)/.test(appUrl), 'appUrl.ts must accept settings:<screen> addresses.');
check(/requestedView\.startsWith\('settings:'\)/.test(account) && /onNavigateView\(sub\?`settings:\$\{sub\}`:'settings'\)/.test(account), 'AccountCenter must route settings screens through the app router.');
check(/window\.history\.back\(\)/.test(settings) && /useBackHandler\(!onNavigate/.test(settings), 'Settings back must use history (router) or the Android back handler (local).');

// 4. Themes reach the home screen and the admin shell.
check(/import'\.\/homeLightThemes\.css'/.test(home), 'HomeSection must load homeLightThemes.css.');
for (const selector of ['.go-premium-home-v2', '.go-product-row-v4__title', '.go-category-card', 'header']) check(homeLight.includes(`:root[data-color-scheme="light"][data-app-tab="home"] ${selector}`), `homeLightThemes.css must restyle ${selector} in light themes.`);
check(/min-h-screen bg-brand-main text-brand-text/.test(read('src/admin/AdminLayout.tsx')), 'The admin shell must use the theme background.');

// 5. Language: the UI is Turkish only, so no app-language switch is offered.
check(!/Uygulama dili/.test(profile) && /E-posta dili/.test(profile), 'The profile must offer the e-mail language (receipts are translated), not an untranslated app language.');

if (failures.length) { console.error('Settings experience contract failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Settings experience contract passed.');
