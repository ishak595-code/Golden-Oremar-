import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const forbiddenRepoArtifacts = [
  'addHealthInfo.cjs',
  'add_fruits.cjs',
  'add_routing.cjs',
  'add_seo.cjs',
  'add_systems.cjs',
  'edit_seed_health.cjs',
  'fix_admin_content.cjs',
  'fix_admin_content_modal.cjs',
  'fix_admin_products.cjs',
  'fix_admin_products2.cjs',
  'fix_data.cjs',
  'fix_images.cjs',
  'fix_other_modals.cjs',
  'fix_preorders.cjs',
  'implement_returns.cjs',
  'list_urls.cjs',
  'move_health_info.cjs',
  'organize_data.cjs',
  'updateImages.cjs',
  'update_categories.cjs',
  'update_contact.cjs',
  'update_health301.cjs',
  'update_images.cjs',
  'update_products.cjs',
  'update_products_full.cjs',
  'count.ts',
  'patch.js',
  'grep_ana.txt',
  'output.txt',
  'temp.txt',
  'metadata.json',
  'src/data.ts',
  'src/data/healthData.ts',
  'migration-tools',
  '.github/workflows/admin-delta-typecheck.yml',
  '.github/workflows/audit-legacy-admin-residue.yml',
  '.github/workflows/seller-traceability-finance-integrate.yml',
  '.github/workflows/verify-seller-feature.yml',
];

for (const relative of forbiddenRepoArtifacts) {
  if (fs.existsSync(path.join(root, relative))) {
    failures.push(`Obsolete static/demo/transitional artifact must not exist: ${relative}`);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.dependencies?.firebase || pkg.devDependencies?.firebase) {
  failures.push('Firebase must not return to the dependency graph.');
}

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const forbiddenRuntimePatterns = [
  { re: /firebase\/(?:app|auth|firestore|storage)/i, label: 'Firebase runtime import' },
  { re: /from\s+['"][^'"]*firebase[^'"]*['"]/i, label: 'Firebase package import' },
  { re: /(?:from|import\()\s*['"][^'"]*(?:\/|^)data(?:\/healthData)?(?:\.[cm]?[jt]sx?)?['"]/i, label: 'legacy static data import' },
  { re: /supabase\.rpc\(\s*['"]create_customer_order(?:_v[1-4])?['"]/i, label: 'retired customer order RPC runtime call' },
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    const relative = path.relative(root, fullPath).replaceAll(path.sep, '/');
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of forbiddenRuntimePatterns) {
      if (pattern.re.test(content)) failures.push(`${pattern.label}: ${relative}`);
    }
  }
}

walk(path.join(root, 'src'));

function requireFile(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`Required release file is missing: ${relative}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

const appShell = requireFile('src/App.tsx');
if (appShell) {
  if (/aria-label="Üst menü"/.test(appShell)) failures.push('Desktop top navigation must not return to the Android/iOS application shell.');
  if (/aria-label="Menüyü aç"/.test(appShell)) failures.push('Hamburger navigation must not return to the Android/iOS application shell.');
  if (!/aria-label="Ana gezinme"/.test(appShell)) failures.push('Persistent native bottom navigation contract is missing from the app shell.');
  if (!/useUnreadNotificationCount/.test(appShell) || !/badge=\{unreadCount\}/.test(appShell)) failures.push('Header notification badge must remain bound to the live unread notification count.');
  if (!/cartItemCount/.test(appShell) || !/badge=\{cartItemCount\}/.test(appShell)) failures.push('Cart badges must remain bound to the live total cart item count.');
  if (/<BottomNavButton\s+icon=\{User\}[^>]*badge=/.test(appShell)) failures.push('Account bottom navigation must not duplicate the notification unread count.');
  if (!/aria-label="Sesli arama"/.test(appShell)) failures.push('Voice-search control is missing from the application header.');
}

const homeStorefront = requireFile('src/features/home/HomeSection.tsx');
if (homeStorefront) {
  const forbiddenHomeFallbacks = [
    { re: /interfaceContent\.heroTitle\s*\|\|/, label: 'Home hero title must not silently fall back to hard-coded copy.' },
    { re: /interfaceContent\.heroSubtitle\s*\|\|/, label: 'Home hero subtitle must not silently fall back to hard-coded copy.' },
    { re: /interfaceContent\.heroButtonText\s*\|\|/, label: 'Home hero CTA must not silently fall back to hard-coded copy.' },
    { re: /producerName\s*\|\|\s*product\.origin\s*\|\|\s*['"]Golden Oremar['"]/, label: 'Missing producer context must not be replaced with the Golden Oremar brand.' },
    { re: /products\.find\(isSellable\)/, label: 'A non-featured product must not be silently promoted into the featured slot.' },
    { re: /Doğrulanmış katalog seçkisi/, label: 'Home spotlight must not make an unscoped verification claim.' },
  ];
  for (const rule of forbiddenHomeFallbacks) {
    if (rule.re.test(homeStorefront)) failures.push(rule.label);
  }
  if (!/loading:\s*storefrontLoading/.test(homeStorefront)) failures.push('Home storefront must expose server storefront loading separately from catalog loading.');
  if (!/salesReadiness\.message/.test(homeStorefront)) failures.push('Sales-readiness notice must use the validated server message.');
  if (!/Doğrulanmış ürün görseli henüz yayınlanmadı\./.test(homeStorefront)) failures.push('Home hero must distinguish missing verified assets from an active loading state.');
  if (!/interfaceContent\.featuredTitle/.test(homeStorefront) || !/interfaceContent\.categoriesTitle/.test(homeStorefront)) failures.push('Validated storefront headings must drive home merchandising sections.');
}

const storefrontApi = requireFile('src/features/storefront/api.ts');
if (storefrontApi) {
  if (!/heroTitle:\s*requiredText\(value\.interface\.heroTitle/.test(storefrontApi)) failures.push('Storefront hero title must remain required at the API boundary.');
  if (!/title:\s*requiredText\(section\.title/.test(storefrontApi)) failures.push('Storefront section titles must remain required at the API boundary.');
}

const cartApi = requireFile('src/features/cart/api.ts');
if (cartApi && !/supabase\.rpc\(\s*['"]create_customer_order_v5['"]/.test(cartApi)) {
  failures.push('Cart checkout must remain on create_customer_order_v5.');
}

const giftApi = requireFile('src/features/gifts/api.ts');
if (giftApi && !/supabase\.rpc\(\s*['"]create_customer_order_v5['"]/.test(giftApi)) {
  failures.push('Gift checkout must remain on create_customer_order_v5.');
}

const nativeRuntime = requireFile('src/native.ts');
if (nativeRuntime) {
  if (!/dataset\.nativePlatform/.test(nativeRuntime)) failures.push('Native runtime platform marker is required for Android/iOS behavior.');
  if (!/registerPlugin<NativeSpeechBridge>\(['"]NativeSpeech['"]\)/.test(nativeRuntime)) failures.push('Native speech JavaScript bridge registration is missing.');
  if (!/SpeechRecognition\s*=\s*NativeSpeechRecognitionAdapter/.test(nativeRuntime)) failures.push('Native speech must remain connected to the existing voice-search UX.');
}

const appStyles = requireFile('src/index.css');
if (appStyles) {
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(appStyles)) failures.push('Android/iOS application typography must not depend on Google Fonts network delivery.');
  if (/@import\s+url\(\s*['"]?https?:\/\//i.test(appStyles)) failures.push('Native app stylesheet must not import remote CSS at runtime.');
  if (/:root\[data-native-platform\][\s\S]*button\[aria-label="Sesli arama"\][\s\S]*display:\s*none/.test(appStyles)) failures.push('Real native voice search must not be hidden from Android/iOS users.');
}

const androidManifest = requireFile('android/app/src/main/AndroidManifest.xml');
if (androidManifest) {
  if (!/android:allowBackup="false"/.test(androidManifest)) failures.push('Android backups must remain disabled for release.');
  if (!/android:usesCleartextTraffic="false"/.test(androidManifest)) failures.push('Android cleartext traffic must remain disabled.');
  if (!/android\.permission\.INTERNET/.test(androidManifest)) failures.push('Android INTERNET permission is required.');
  if (!/android\.permission\.POST_NOTIFICATIONS/.test(androidManifest)) failures.push('Android 13+ notification permission must be declared.');
  if (!/android\.permission\.RECORD_AUDIO/.test(androidManifest)) failures.push('Android native voice search requires RECORD_AUDIO permission.');
  if (!/android:scheme="com\.goldenoremar\.app"/.test(androidManifest) || !/android:host="auth"/.test(androidManifest)) {
    failures.push('Android auth callback deep link contract is missing.');
  }
}

const androidMain = requireFile('android/app/src/main/java/com/goldenoremar/app/MainActivity.kt');
if (androidMain) {
  if (!/@CapacitorPlugin\([\s\S]*name\s*=\s*"NativeSpeech"/.test(androidMain)) failures.push('Android NativeSpeech Capacitor plugin is missing.');
  if (!/SpeechRecognizer\.createSpeechRecognizer/.test(androidMain)) failures.push('Android NativeSpeech must use the platform SpeechRecognizer.');
  if (!/registerPlugin\(NativeSpeechPlugin::class\.java\)/.test(androidMain)) failures.push('Android NativeSpeech plugin registration is missing.');
}

const iosInfo = requireFile('ios/App/App/Info.plist');
if (iosInfo) {
  if (!/<key>CFBundleDevelopmentRegion<\/key>\s*<string>tr<\/string>/.test(iosInfo)) failures.push('iOS development region must remain Turkish.');
  if (!/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(iosInfo)) failures.push('iOS export-compliance metadata is missing.');
  if (!/<string>com\.goldenoremar\.app<\/string>/.test(iosInfo)) failures.push('iOS auth callback URL scheme is missing.');
  if (!/<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>/.test(iosInfo)) failures.push('iOS microphone usage description is required for native voice search.');
  if (!/<key>NSSpeechRecognitionUsageDescription<\/key>\s*<string>[^<]+<\/string>/.test(iosInfo)) failures.push('iOS speech-recognition usage description is required.');
}

const iosScene = requireFile('ios/App/App/SceneDelegate.swift');
if (iosScene) {
  if (!/class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin/.test(iosScene)) failures.push('iOS NativeSpeech Capacitor plugin is missing.');
  if (!/SFSpeechRecognizer/.test(iosScene) || !/AVAudioEngine/.test(iosScene)) failures.push('iOS NativeSpeech must use native speech and audio frameworks.');
  if (!/registerPluginInstance\(NativeSpeechPlugin\(\)\)/.test(iosScene)) failures.push('iOS NativeSpeech plugin registration is missing.');
}

const indexHtml = requireFile('index.html');
if (indexHtml) {
  if (!/<html lang="tr">/.test(indexHtml)) failures.push('Document language must remain Turkish.');
  if (!/name="viewport"[^>]*viewport-fit=cover/.test(indexHtml)) failures.push('Safe-area viewport-fit=cover metadata is required.');
  if (!/name="description"/.test(indexHtml)) failures.push('Production meta description is required.');
  if (!/property="og:title"/.test(indexHtml) || !/name="twitter:title"/.test(indexHtml)) failures.push('Public share metadata is incomplete.');
}

if (failures.length) {
  console.error('Golden Oremar release audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Golden Oremar release audit passed: Android/iOS app-shell, native speech, strict storefront truth, retired-runtime and native release metadata contracts are intact.');
