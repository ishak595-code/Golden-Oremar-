import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const forbiddenRepoArtifacts = [
  'addHealthInfo.cjs','add_fruits.cjs','add_routing.cjs','add_seo.cjs','add_systems.cjs','edit_seed_health.cjs','fix_admin_content.cjs','fix_admin_content_modal.cjs','fix_admin_products.cjs','fix_admin_products2.cjs','fix_data.cjs','fix_images.cjs','fix_other_modals.cjs','fix_preorders.cjs','implement_returns.cjs','list_urls.cjs','move_health_info.cjs','organize_data.cjs','updateImages.cjs','update_categories.cjs','update_contact.cjs','update_health301.cjs','update_images.cjs','update_products.cjs','update_products_full.cjs','count.ts','patch.js','grep_ana.txt','output.txt','temp.txt','metadata.json','src/data.ts','src/data/healthData.ts','src/pages/LegacyAdminEntry.tsx','src/features/account/useDialogA11y.ts','migration-tools','.github/workflows/admin-delta-typecheck.yml','.github/workflows/audit-legacy-admin-residue.yml','.github/workflows/seller-traceability-finance-integrate.yml','.github/workflows/verify-seller-feature.yml',
];
for (const relative of forbiddenRepoArtifacts) if (fs.existsSync(path.join(root, relative))) failures.push(`Obsolete static/demo/transitional artifact must not exist: ${relative}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.dependencies?.firebase || pkg.devDependencies?.firebase) failures.push('Firebase must not return to the dependency graph.');

const sourceExtensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const forbiddenRuntimePatterns = [
  { re: /firebase\/(?:app|auth|firestore|storage)/i, label: 'Firebase runtime import' },
  { re: /from\s+['"][^'"]*firebase[^'"]*['"]/i, label: 'Firebase package import' },
  { re: /(?:from|import\()\s*['"][^'"]*(?:\/|^)data(?:\/healthData)?(?:\.[cm]?[jt]sx?)?['"]/i, label: 'legacy static data import' },
  { re: /supabase\.rpc\(\s*['"]create_customer_order(?:_v[1-4])?['"]/i, label: 'retired customer order RPC runtime call' },
];
function walk(directory) { for (const entry of fs.readdirSync(directory,{withFileTypes:true})) { const fullPath=path.join(directory,entry.name); if(entry.isDirectory()){walk(fullPath);continue;} if(!sourceExtensions.has(path.extname(entry.name)))continue; const relative=path.relative(root,fullPath).replaceAll(path.sep,'/'),content=fs.readFileSync(fullPath,'utf8'); for(const pattern of forbiddenRuntimePatterns)if(pattern.re.test(content))failures.push(`${pattern.label}: ${relative}`); } }
walk(path.join(root,'src'));
function requireFile(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required release file is missing: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}

const appShell=requireFile('src/App.tsx');
if(appShell){
 if(/aria-label="Üst menü"/.test(appShell))failures.push('Desktop top navigation must not return to the Android/iOS application shell.');
 if(/aria-label="Menüyü aç"/.test(appShell))failures.push('Hamburger navigation must not return to the Android/iOS application shell.');
 if(!/aria-label="Ana gezinme"/.test(appShell))failures.push('Persistent native bottom navigation contract is missing from the app shell.');
 if(!/useUnreadNotificationCount/.test(appShell)||!/badge=\{unreadCount\}/.test(appShell))failures.push('Header notification badge must remain bound to the live unread notification count.');
 if(!/cartItemCount/.test(appShell)||!/badge=\{cartItemCount\}/.test(appShell))failures.push('Cart badges must remain bound to the live total cart item count.');
 if(/<BottomNavButton\s+icon=\{User\}[^>]*badge=/.test(appShell))failures.push('Account bottom navigation must not duplicate the notification unread count.');
 if(!/aria-label="Sesli arama"/.test(appShell))failures.push('Voice-search control is missing from the application header.');
 if(/LegacyAdminEntry/.test(appShell))failures.push('App must load the canonical AdminPage directly, not the retired legacy wrapper.');
 if(!/import\(['"]\.\/pages\/AdminPage['"]\)\.then\(module=>\(\{default:module\.AdminPage\}\)\)/.test(appShell))failures.push('App canonical admin lazy import is missing.');
 if(/\bCapitor\b/.test(appShell))failures.push('Misspelled Capacitor runtime identifier detected.');
}

const homeStorefront=requireFile('src/features/home/HomeSection.tsx');
if(homeStorefront){
 const forbiddenHomeFallbacks=[
  {re:/interfaceContent\.heroTitle\s*\|\|/,label:'Home hero title must not silently fall back to hard-coded copy.'},
  {re:/interfaceContent\.heroSubtitle\s*\|\|/,label:'Home hero subtitle must not silently fall back to hard-coded copy.'},
  {re:/interfaceContent\.heroButtonText\s*\|\|/,label:'Home hero CTA must not silently fall back to hard-coded copy.'},
  {re:/producerName\s*\|\|\s*product\.origin\s*\|\|\s*['"]Golden Oremar['"]/,label:'Missing producer context must not be replaced with the Golden Oremar brand.'},
  {re:/products\.find\(isSellable\)/,label:'A non-featured product must not be silently promoted into the featured slot.'},
  {re:/Doğrulanmış katalog seçkisi/,label:'Home spotlight must not make an unscoped verification claim.'},
  {re:/spotlightProduct/,label:'The retired duplicate standalone featured-product block must not return.'},
 ];
 for(const rule of forbiddenHomeFallbacks)if(rule.re.test(homeStorefront))failures.push(rule.label);
 if(!/loading:\s*storefrontLoading/.test(homeStorefront))failures.push('Home storefront must expose server storefront loading separately from catalog loading.');
 if(!/salesReadiness\.message/.test(homeStorefront))failures.push('Sales-readiness notice must use the validated server message.');
 if(!/Doğrulanmış ürün görseli henüz yayınlanmadı\./.test(homeStorefront))failures.push('Home hero must distinguish missing verified assets from an active loading state.');
 if(!/interfaceContent\.categoriesTitle/.test(homeStorefront))failures.push('Validated storefront collection heading must drive the home collection area.');
 if(!/heroCategories\.map\(config=>/.test(homeStorefront))failures.push('Managed collection cards must drive the public home collection order.');
 if(!/homeSections\.filter\(section=>section\.active\)\.map/.test(homeStorefront))failures.push('Managed active product sections must drive the public home section order.');
 if(!/eventSpotlight\.placement===placement/.test(homeStorefront))failures.push('Managed event spotlight placement must drive the public home position.');
}

const storefrontApi=requireFile('src/features/storefront/api.ts');
if(storefrontApi){
 if(!/heroTitle:\s*requiredText\(value\.interface\.heroTitle/.test(storefrontApi))failures.push('Storefront hero title must remain required at the API boundary.');
 if(!/title:\s*requiredText\(section\.title/.test(storefrontApi))failures.push('Storefront section titles must remain required at the API boundary.');
 if(!/eventSpotlight:\s*normalizeEventSpotlight\(value\.eventSpotlight\)/.test(storefrontApi))failures.push('Storefront event spotlight must remain strictly normalized.');
}

const productCard=requireFile('src/features/catalog/CatalogProductCard.tsx');
if(productCard){const compact=productCard.replace(/\s+/g,'');
 if(!/useEffect\(\(\)=>\{setQuantity\(current=>Math\.min\(Math\.max\(1,current\),maxQuantity\)\);\},\[maxQuantity\]\)/.test(compact))failures.push('Canonical product card must clamp selected quantity when live stock decreases.');
 if(!/text-brand-on-green/.test(productCard)||!/text-brand-on-gold/.test(productCard))failures.push('Canonical product card must use semantic accent foreground tokens.');
 if(!/disabled=\{cardBusy\|\|!purchaseReady\}/.test(compact))failures.push('Gift and purchase actions must remain bound to full purchase readiness.');
 if(!/actionFeedback/.test(productCard)||!/runAction/.test(productCard))failures.push('Canonical product card secondary async actions must expose caught failures instead of unhandled promises.');
 if(!/Doğrulanmış görsel henüz yayınlanmadı/.test(productCard))failures.push('Canonical product card must state missing verified imagery truthfully.');
 if(/line-through/.test(productCard))failures.push('Canonical product card must not reintroduce struck-through discount framing.');
}

const sellerPanel=requireFile('src/features/account/SellerPanel.tsx');
if(sellerPanel){const compact=sellerPanel.replace(/\s+/g,'');
 if(/useDialogA11y/.test(sellerPanel))failures.push('SellerPanel must not call the removed account dialog wrapper.');
 if(!/useAccessibleDialog/.test(sellerPanel))failures.push('SellerPanel destructive confirmation must use the canonical accessible dialog hook.');
 if(!/AccountProducerSummary/.test(sellerPanel)||!/producerStatusLabel/.test(sellerPanel))failures.push('SellerPanel must render the validated producer lifecycle instead of treating every producer record as active.');
 if(!/operational=!statusMismatch&&dashboardStatus==='active'&&dashboardVerified===true/.test(compact))failures.push('Seller active-sale operations must require matching active and verified producer state.');
 if(!/disabled=\{!operational\}/.test(compact))failures.push('Seller order and traceability actions must remain disabled outside active verified status.');
 if(!/scope="producer"/.test(sellerPanel))failures.push('Seller customer questions must remain on the canonical producer-scoped MessagesPanel.');
 if(!/!operational\?<divrole="status"/.test(compact))failures.push('Seller stock editing must explain and enforce the inactive producer gate.');
}

const adminPage=requireFile('src/pages/AdminPage.tsx');
if(adminPage){for(const marker of['ProducerProductManager','ProducerOrdersPanel','ProducerFinancePanel','ProducerProfilePanel',"roles.includes('producer')","currentUser?.role === 'vendor'"])if(adminPage.includes(marker))failures.push(`AdminPage must not contain the duplicate producer path: ${marker}`);}
const adminLayout=requireFile('src/admin/AdminLayout.tsx');
if(adminLayout){if(/vendorMenuGroups|isVendor|Satıcı menüsü|Mağaza Yönetimi/.test(adminLayout))failures.push('AdminLayout must remain admin-only; seller navigation belongs to SellerPanel.');if(!/ADMIN_MENU_GROUPS/.test(adminLayout))failures.push('AdminLayout canonical admin menu definition is missing.');}
const adminDashboard=requireFile('src/admin/AdminDashboard.tsx');
if(adminDashboard){if(/ProducerOverview|getMyProducerDashboardV2|useCustomerSession/.test(adminDashboard))failures.push('AdminDashboard must not contain a second producer dashboard or role-switched seller runtime.');if(!/getAdminOperationsOverview/.test(adminDashboard))failures.push('AdminDashboard must remain bound to the strict admin overview API.');}
const adminDashboardApi=requireFile('src/admin/dashboardApi.ts');
if(adminDashboardApi){if(/getMyProducerDashboardV2|ProducerDashboard/.test(adminDashboardApi))failures.push('Admin dashboard API must not contain the retired producer dashboard path.');if(/\|\|\s*['"]TRY['"]/.test(adminDashboardApi))failures.push('Admin dashboard API must not invent TRY when server currency is missing.');if(/new Date\(\)\.toISOString\(\)/.test(adminDashboardApi))failures.push('Admin dashboard API must not replace missing server timestamps with the current client time.');if(!/currencyCode\(value\.currency\)/.test(adminDashboardApi))failures.push('Admin dashboard finance currency must be validated at the client boundary.');if(!/net !== captured - refunded/.test(adminDashboardApi))failures.push('Admin dashboard finance summary must retain arithmetic consistency validation.');}
const sharedAdminApi=requireFile('src/admin/supabaseAdminApi.ts');
if(sharedAdminApi){if(/\?\s*[^:]+:\s*['"]Kullanıcı['"]/.test(sharedAdminApi)||/\?\s*[^:]+:\s*['"]Ürün['"]/.test(sharedAdminApi))failures.push('Shared admin API must not invent user or product names when the server payload is incomplete.');if(!/currency:currencyCode\(raw\.currency,true\)/.test(sharedAdminApi.replace(/\s+/g,'')))failures.push('Admin finance report currency must remain required at the API boundary.');if(!/net!==gross-refund/.test(sharedAdminApi.replace(/\s+/g,'')))failures.push('Shared admin finance report must retain gross/refund/net arithmetic checks.');if(!/safeInteger\(value\.rating,['"]Yorum puanı['"],1,5\)/.test(sharedAdminApi))failures.push('Admin review rating must remain strictly validated from 1 to 5.');}
const adminFinance=requireFile('src/admin/AdminFinance.tsx');
if(adminFinance){if(/Grafik TRY bazındadır|\}\s*TRY/.test(adminFinance))failures.push('Admin finance UI must not hard-code TRY instead of the validated report currency.');if(!/report\.currency/.test(adminFinance)||!/formatMinorCurrency/.test(adminFinance))failures.push('Admin finance UI must render server report currency through the shared formatter.');}

const cartApi=requireFile('src/features/cart/api.ts');if(cartApi&&!/supabase\.rpc\(\s*['"]create_customer_order_v5['"]/.test(cartApi))failures.push('Cart checkout must remain on create_customer_order_v5.');
const giftApi=requireFile('src/features/gifts/api.ts');if(giftApi&&!/supabase\.rpc\(\s*['"]create_customer_order_v5['"]/.test(giftApi))failures.push('Gift checkout must remain on create_customer_order_v5.');
const nativeRuntime=requireFile('src/native.ts');
if(nativeRuntime){if(!/dataset\.nativePlatform/.test(nativeRuntime))failures.push('Native runtime platform marker is required for Android/iOS behavior.');if(!/registerPlugin<NativeSpeechBridge>\(['"]NativeSpeech['"]\)/.test(nativeRuntime))failures.push('Native speech JavaScript bridge registration is missing.');if(!/SpeechRecognition\s*=\s*NativeSpeechRecognitionAdapter/.test(nativeRuntime))failures.push('Native speech must remain connected to the existing voice-search UX.');}
const appStyles=requireFile('src/index.css');
if(appStyles){if(/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(appStyles))failures.push('Android/iOS application typography must not depend on Google Fonts network delivery.');if(/@import\s+url\(\s*['"]?https?:\/\//i.test(appStyles))failures.push('Native app stylesheet must not import remote CSS at runtime.');if(/:root\[data-native-platform\][\s\S]*button\[aria-label="Sesli arama"\][\s\S]*display:\s*none/.test(appStyles))failures.push('Real native voice search must not be hidden from Android/iOS users.');if(!/--color-brand-on-gold:\s*var\(--text-on-gold\)/.test(appStyles)||!/--color-brand-on-green:\s*var\(--text-on-green\)/.test(appStyles))failures.push('Semantic accent foreground tokens are required for theme contrast.');if(!/\.bg-brand-gold\.text-brand-green[\s\S]*var\(--text-on-gold\)/.test(appStyles))failures.push('Legacy gold-background foreground compatibility guard is missing.');if(!/\.bg-brand-green\.text-white[\s\S]*var\(--text-on-green\)/.test(appStyles))failures.push('Legacy green-background foreground compatibility guard is missing.');}

const androidManifest=requireFile('android/app/src/main/AndroidManifest.xml');
if(androidManifest){if(!/android:allowBackup="false"/.test(androidManifest))failures.push('Android backups must remain disabled for release.');if(!/android:usesCleartextTraffic="false"/.test(androidManifest))failures.push('Android cleartext traffic must remain disabled.');if(!/android\.permission\.INTERNET/.test(androidManifest))failures.push('Android INTERNET permission is required.');if(!/android\.permission\.POST_NOTIFICATIONS/.test(androidManifest))failures.push('Android 13+ notification permission must be declared.');if(!/android\.permission\.RECORD_AUDIO/.test(androidManifest))failures.push('Android native voice search requires RECORD_AUDIO permission.');if(!/android:scheme="com\.goldenoremar\.app"/.test(androidManifest)||!/android:host="auth"/.test(androidManifest))failures.push('Android auth callback deep link contract is missing.');}
const androidMain=requireFile('android/app/src/main/java/com/goldenoremar/app/MainActivity.kt');
if(androidMain){if(!/@CapacitorPlugin\([\s\S]*name\s*=\s*"NativeSpeech"/.test(androidMain))failures.push('Android NativeSpeech Capacitor plugin is missing.');if(!/SpeechRecognizer\.createSpeechRecognizer/.test(androidMain))failures.push('Android NativeSpeech must use the platform SpeechRecognizer.');if(!/registerPlugin\(NativeSpeechPlugin::class\.java\)/.test(androidMain))failures.push('Android NativeSpeech plugin registration is missing.');}
const iosInfo=requireFile('ios/App/App/Info.plist');
if(iosInfo){if(!/<key>CFBundleDevelopmentRegion<\/key>\s*<string>tr<\/string>/.test(iosInfo))failures.push('iOS development region must remain Turkish.');if(!/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(iosInfo))failures.push('iOS export-compliance metadata is missing.');if(!/<string>com\.goldenoremar\.app<\/string>/.test(iosInfo))failures.push('iOS auth callback URL scheme is missing.');if(!/<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>/.test(iosInfo))failures.push('iOS microphone usage description is required for native voice search.');if(!/<key>NSSpeechRecognitionUsageDescription<\/key>\s*<string>[^<]+<\/string>/.test(iosInfo))failures.push('iOS speech-recognition usage description is required.');}
const iosScene=requireFile('ios/App/App/SceneDelegate.swift');
if(iosScene){if(!/class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin/.test(iosScene))failures.push('iOS NativeSpeech Capacitor plugin is missing.');if(!/SFSpeechRecognizer/.test(iosScene)||!/AVAudioEngine/.test(iosScene))failures.push('iOS NativeSpeech must use native speech and audio frameworks.');if(!/registerPluginInstance\(NativeSpeechPlugin\(\)\)/.test(iosScene))failures.push('iOS NativeSpeech plugin registration is missing.');}
const indexHtml=requireFile('index.html');
if(indexHtml){if(!/<html lang="tr">/.test(indexHtml))failures.push('Document language must remain Turkish.');if(!/name="viewport"[^>]*viewport-fit=cover/.test(indexHtml))failures.push('Safe-area viewport-fit=cover metadata is required.');if(!/name="description"/.test(indexHtml))failures.push('Production meta description is required.');if(!/property="og:title"/.test(indexHtml)||!/name="twitter:title"/.test(indexHtml))failures.push('Public share metadata is incomplete.');}

if(failures.length){console.error('Golden Oremar release audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar release audit passed: Android/iOS app-shell, native speech, managed premium storefront, canonical product/seller/admin paths, producer lifecycle gates, fail-closed admin data, currency truth, theme contrast, retired-runtime and native release metadata contracts are intact.');
