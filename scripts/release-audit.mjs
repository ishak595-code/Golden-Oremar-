import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function exists(relative){return fs.existsSync(path.join(root,relative));}
function requireFile(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required release file is missing: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function compact(value){return value.replace(/\s+/g,'');}
function requirePattern(content,re,message){if(!re.test(content))failures.push(message);}
function forbidPattern(content,re,message){if(re.test(content))failures.push(message);}

const forbiddenRepoArtifacts=[
 'addHealthInfo.cjs','add_fruits.cjs','add_routing.cjs','add_seo.cjs','add_systems.cjs','edit_seed_health.cjs','fix_admin_content.cjs','fix_admin_content_modal.cjs','fix_admin_products.cjs','fix_admin_products2.cjs','fix_data.cjs','fix_images.cjs','fix_other_modals.cjs','fix_preorders.cjs','implement_returns.cjs','list_urls.cjs','move_health_info.cjs','organize_data.cjs','updateImages.cjs','update_categories.cjs','update_contact.cjs','update_health301.cjs','update_images.cjs','update_products.cjs','update_products_full.cjs','count.ts','patch.js','grep_ana.txt','output.txt','temp.txt','metadata.json','src/data.ts','src/data/healthData.ts','src/pages/LegacyAdminEntry.tsx','src/features/account/useDialogA11y.ts','migration-tools','.github/workflows/admin-delta-typecheck.yml','.github/workflows/audit-legacy-admin-residue.yml','.github/workflows/seller-traceability-finance-integrate.yml','.github/workflows/verify-seller-feature.yml','firestore.rules','server.ts','reset_admin.ts','reset_password.ts','check_pass.ts','test_login.ts','check_db.ts',
];
for(const relative of forbiddenRepoArtifacts)if(exists(relative))failures.push(`Obsolete static/demo/transitional artifact must not exist: ${relative}`);

const pkg=JSON.parse(requireFile('package.json')||'{}');
if(pkg.dependencies?.firebase||pkg.devDependencies?.firebase)failures.push('Firebase must not return to the dependency graph.');
if(!pkg.scripts?.['audit:security']||!String(pkg.scripts?.['audit:release']||'').includes('security-contract-audit.mjs'))failures.push('Credential and retired-auth security audit must remain in the release gate.');
if(!pkg.devDependencies?.['@types/react']||!pkg.devDependencies?.['@types/react-dom'])failures.push('React TypeScript declarations are required for real JSX type checking.');

const sourceExtensions=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const forbiddenRuntimePatterns=[
 {re:/firebase\/(?:app|auth|firestore|storage)/i,label:'Firebase runtime import'},
 {re:/from\s+['"][^'"]*firebase[^'"]*['"]/i,label:'Firebase package import'},
 {re:/(?:from|import\()\s*['"][^'"]*(?:\/|^)data(?:\/healthData)?(?:\.[cm]?[jt]sx?)?['"]/i,label:'legacy static data import'},
 {re:/supabase\.rpc\(\s*['"]create_customer_order(?:_v[1-4])?['"]/i,label:'retired customer order RPC runtime call'},
];
function walkSource(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const fullPath=path.join(directory,entry.name);if(entry.isDirectory()){walkSource(fullPath);continue;}if(!sourceExtensions.has(path.extname(entry.name)))continue;const relative=path.relative(root,fullPath).replaceAll(path.sep,'/'),content=fs.readFileSync(fullPath,'utf8');for(const pattern of forbiddenRuntimePatterns)if(pattern.re.test(content))failures.push(`${pattern.label}: ${relative}`);}}
if(exists('src'))walkSource(path.join(root,'src'));

const appShell=requireFile('src/App.tsx');
if(appShell){const c=compact(appShell);
 forbidPattern(appShell,/aria-label="Üst menü"/,'Desktop top navigation must not return to the Android/iOS application shell.');
 forbidPattern(appShell,/aria-label="Menüyü aç"/,'Hamburger navigation must not return to the Android/iOS application shell.');
 requirePattern(appShell,/aria-label="Ana gezinme"/,'Persistent native bottom navigation contract is missing from the app shell.');
 if(!/useUnreadNotificationCount/.test(appShell)||!/badge=\{unreadCount\}/.test(appShell))failures.push('Header notification badge must remain bound to the live unread notification count.');
 if(!/cartItemCount/.test(appShell)||!/badge=\{cartItemCount\}/.test(appShell))failures.push('Cart badges must remain bound to the live total cart item count.');
 forbidPattern(appShell,/<BottomNavButton\s+icon=\{User\}[^>]*badge=/,'Account bottom navigation must not duplicate the notification unread count.');
 const voiceControl=/triggerVoiceSearch/.test(appShell)&&c.includes("onClick={searchQuery?()=>setSearchQuery(''):triggerVoiceSearch}")&&c.includes("aria-label={searchQuery?'Aramayıtemizle':'Sesliarama'}")&&/<Mic\s+aria-hidden="true"/.test(appShell);
 if(!voiceControl)failures.push('Voice-search control is missing from the application header.');
 forbidPattern(appShell,/LegacyAdminEntry/,'App must load the canonical AdminPage directly, not the retired legacy wrapper.');
 requirePattern(appShell,/import\(['"]\.\/pages\/AdminPage['"]\)\.then\(module=>\(\{default:module\.AdminPage\}\)\)/,'App canonical admin lazy import is missing.');
 forbidPattern(appShell,/\bCapitor\b/,'Misspelled Capacitor runtime identifier detected.');
}

const homeStorefront=requireFile('src/features/home/HomeSection.tsx');
if(homeStorefront){
 const forbiddenHomeFallbacks=[
  [/interfaceContent\.heroTitle\s*\|\|/,'Home hero title must not silently fall back to hard-coded copy.'],
  [/interfaceContent\.heroSubtitle\s*\|\|/,'Home hero subtitle must not silently fall back to hard-coded copy.'],
  [/interfaceContent\.heroButtonText\s*\|\|/,'Home hero CTA must not silently fall back to hard-coded copy.'],
  [/producerName\s*\|\|\s*product\.origin\s*\|\|\s*['"]Golden Oremar['"]/,'Missing producer context must not be replaced with the Golden Oremar brand.'],
  [/products\.find\(isSellable\)/,'A non-featured product must not be silently promoted into the featured slot.'],
  [/Doğrulanmış katalog seçkisi/,'Home spotlight must not make an unscoped verification claim.'],
  [/spotlightProduct/,'The retired duplicate standalone featured-product block must not return.'],
 ];
 for(const[re,label]of forbiddenHomeFallbacks)forbidPattern(homeStorefront,re,label);
 requirePattern(homeStorefront,/loading:\s*storefrontLoading/,'Home storefront must expose server storefront loading separately from catalog loading.');
 requirePattern(homeStorefront,/salesReadiness\.message/,'Sales-readiness notice must use the validated server message.');
 requirePattern(homeStorefront,/Doğrulanmış ürün görseli henüz yayınlanmadı\./,'Home hero must distinguish missing verified assets from an active loading state.');
 requirePattern(homeStorefront,/interfaceContent\.categoriesTitle/,'Validated storefront collection heading must drive the home collection area.');
 requirePattern(homeStorefront,/heroCategories\.map\(config=>/,'Managed collection cards must drive the public home collection order.');
 requirePattern(homeStorefront,/homeSections\.filter\(section=>section\.active\)\.map/,'Managed active product sections must drive the public home section order.');
 requirePattern(homeStorefront,/eventSpotlight\.placement===placement/,'Managed event spotlight placement must drive the public home position.');
}

const storefrontApi=requireFile('src/features/storefront/api.ts');
if(storefrontApi){
 requirePattern(storefrontApi,/heroTitle:\s*requiredText\(value\.interface\.heroTitle/,'Storefront hero title must remain required at the API boundary.');
 requirePattern(storefrontApi,/title:\s*requiredText\(section\.title/,'Storefront section titles must remain required at the API boundary.');
 requirePattern(storefrontApi,/eventSpotlight:\s*normalizeEventSpotlight\(value\.eventSpotlight\)/,'Storefront event spotlight must remain strictly normalized.');
}

const productCard=requireFile('src/features/catalog/CatalogProductCard.tsx');
if(productCard){const c=compact(productCard);
 requirePattern(c,/useEffect\(\(\)=>\{setQuantity\(current=>Math\.min\(Math\.max\(1,current\),maxQuantity\)\);\},\[maxQuantity\]\)/,'Canonical product card must clamp selected quantity when live stock decreases.');
 if(!/text-brand-on-green/.test(productCard)||!/text-brand-on-gold/.test(productCard))failures.push('Canonical product card must use semantic accent foreground tokens.');
 requirePattern(c,/disabled=\{cardBusy\|\|!purchaseReady\}/,'Gift and purchase actions must remain bound to full purchase readiness.');
 if(!/actionFeedback/.test(productCard)||!/runAction/.test(productCard))failures.push('Canonical product card secondary async actions must expose caught failures instead of unhandled promises.');
 requirePattern(productCard,/Doğrulanmış görsel henüz yayınlanmadı/,'Canonical product card must state missing verified imagery truthfully.');
 forbidPattern(productCard,/line-through/,'Canonical product card must not reintroduce struck-through discount framing.');
}

const sellerPanel=requireFile('src/features/account/SellerPanel.tsx');
if(sellerPanel){const c=compact(sellerPanel);
 forbidPattern(sellerPanel,/useDialogA11y/,'SellerPanel must not call the removed account dialog wrapper.');
 requirePattern(sellerPanel,/useAccessibleDialog/,'SellerPanel destructive confirmation must use the canonical accessible dialog hook.');
 if(!/AccountProducerSummary/.test(sellerPanel)||!/producerStatusLabel/.test(sellerPanel))failures.push('SellerPanel must render the validated producer lifecycle instead of treating every producer record as active.');
 requirePattern(c,/operational=!statusMismatch&&dashboardStatus==='active'&&dashboardVerified===true/,'Seller active-sale operations must require matching active and verified producer state.');
 requirePattern(c,/verificationMismatch/,'Seller lifecycle must fail closed when account and dashboard verification disagree.');
 requirePattern(c,/originVerificationMismatch/,'Seller lifecycle must fail closed when origin verification sources disagree.');
 requirePattern(c,/disabled=\{!operational\}/,'Seller order and traceability actions must remain disabled outside active verified status.');
 requirePattern(sellerPanel,/scope="producer"/,'Seller customer questions must remain on the canonical producer-scoped MessagesPanel.');
 requirePattern(c,/!operational\?<divrole="status"/,'Seller stock editing must explain and enforce the inactive producer gate.');
}

const adminPage=requireFile('src/pages/AdminPage.tsx');
if(adminPage){for(const marker of['ProducerProductManager','ProducerOrdersPanel','ProducerFinancePanel','ProducerProfilePanel',"roles.includes('producer')","currentUser?.role === 'vendor'"])if(adminPage.includes(marker))failures.push(`AdminPage must not contain the duplicate producer path: ${marker}`);}
const adminLayout=requireFile('src/admin/AdminLayout.tsx');
if(adminLayout){if(/vendorMenuGroups|isVendor|Satıcı menüsü|Mağaza Yönetimi/.test(adminLayout))failures.push('AdminLayout must remain admin-only; seller navigation belongs to SellerPanel.');requirePattern(adminLayout,/ADMIN_MENU_GROUPS/,'AdminLayout canonical admin menu definition is missing.');}
const adminDashboard=requireFile('src/admin/AdminDashboard.tsx');
if(adminDashboard){if(/ProducerOverview|getMyProducerDashboardV2|useCustomerSession/.test(adminDashboard))failures.push('AdminDashboard must not contain a second producer dashboard or role-switched seller runtime.');requirePattern(adminDashboard,/getAdminOperationsOverview/,'AdminDashboard must remain bound to the strict admin overview API.');}
const adminDashboardApi=requireFile('src/admin/dashboardApi.ts');
if(adminDashboardApi){
 forbidPattern(adminDashboardApi,/getMyProducerDashboardV2|ProducerDashboard/,'Admin dashboard API must not contain the retired producer dashboard path.');
 forbidPattern(adminDashboardApi,/\|\|\s*['"]TRY['"]/,'Admin dashboard API must not invent TRY when server currency is missing.');
 forbidPattern(adminDashboardApi,/new Date\(\)\.toISOString\(\)/,'Admin dashboard API must not replace missing server timestamps with the current client time.');
 requirePattern(adminDashboardApi,/(?:currency|currencyCode)\(value\.currency\)/,'Admin dashboard finance currency must be validated at the client boundary.');
 requirePattern(adminDashboardApi,/net\s*!==\s*captured\s*-\s*refunded/,'Admin dashboard finance summary must retain arithmetic consistency validation.');
}
const sharedAdminApi=requireFile('src/admin/supabaseAdminApi.ts');
if(sharedAdminApi){const c=compact(sharedAdminApi);
 if(/\?\s*[^:]+:\s*['"]Kullanıcı['"]/.test(sharedAdminApi)||/\?\s*[^:]+:\s*['"]Ürün['"]/.test(sharedAdminApi))failures.push('Shared admin API must not invent user or product names when the server payload is incomplete.');
 requirePattern(c,/currency:currencyCode\(raw\.currency,true\)/,'Admin finance report currency must remain required at the API boundary.');
 requirePattern(c,/net!==gross-refund/,'Shared admin finance report must retain gross/refund/net arithmetic checks.');
 requirePattern(sharedAdminApi,/safeInteger\(value\.rating,['"]Yorum puanı['"],1,5\)/,'Admin review rating must remain strictly validated from 1 to 5.');
}
const accountingAdminApi=requireFile('src/admin/accountingAdminApi.ts');
if(accountingAdminApi){const c=compact(accountingAdminApi);
 requirePattern(c,/reportCurrency=currency\(value\.currency\)/,'Current accounting report currency must be validated before UI consumption.');
 requirePattern(c,/availableCurrencies=\[\.\.\.newSet\(value\.available_currencies\.map\(currency\)\)\]/,'Available accounting currencies must be validated individually.');
 requirePattern(c,/if\(net!==gross-refund\)/,'Accounting report must retain gross/refund/net arithmetic verification.');
}
const adminFinance=requireFile('src/admin/AdminFinance.tsx');
if(adminFinance){const c=compact(adminFinance);
 forbidPattern(adminFinance,/Grafik TRY bazındadır|\}\s*TRY/,'Admin finance UI must not hard-code TRY instead of the validated report currency.');
 if(!/report\.currency/.test(adminFinance)||!/(?:formatMinorCurrency|money\([^)]*,report\.currency\))/.test(c))failures.push('Admin finance UI must render the validated server report currency.');
}

const cartApi=requireFile('src/features/cart/api.ts');if(cartApi)requirePattern(cartApi,/supabase\.rpc\(\s*['"]create_customer_order_v5['"]/,'Cart checkout must remain on create_customer_order_v5.');
const giftApi=requireFile('src/features/gifts/api.ts');if(giftApi)requirePattern(giftApi,/supabase\.rpc\(\s*['"]create_customer_order_v5['"]/,'Gift checkout must remain on create_customer_order_v5.');
const nativeRuntime=requireFile('src/native.ts');
if(nativeRuntime){requirePattern(nativeRuntime,/dataset\.nativePlatform/,'Native runtime platform marker is required for Android/iOS behavior.');requirePattern(nativeRuntime,/registerPlugin<NativeSpeechBridge>\(['"]NativeSpeech['"]\)/,'Native speech JavaScript bridge registration is missing.');requirePattern(nativeRuntime,/SpeechRecognition\s*=\s*NativeSpeechRecognitionAdapter/,'Native speech must remain connected to the existing voice-search UX.');}
const appStyles=requireFile('src/index.css');
if(appStyles){
 forbidPattern(appStyles,/fonts\.googleapis\.com|fonts\.gstatic\.com/i,'Android/iOS application typography must not depend on Google Fonts network delivery.');
 forbidPattern(appStyles,/@import\s+url\(\s*['"]?https?:\/\//i,'Native app stylesheet must not import remote CSS at runtime.');
 forbidPattern(appStyles,/:root\[data-native-platform\][\s\S]*button\[aria-label="Sesli arama"\][\s\S]*display:\s*none/,'Real native voice search must not be hidden from Android/iOS users.');
 if(!/--color-brand-on-gold:\s*var\(--text-on-gold\)/.test(appStyles)||!/--color-brand-on-green:\s*var\(--text-on-green\)/.test(appStyles))failures.push('Semantic accent foreground tokens are required for theme contrast.');
 requirePattern(appStyles,/\.bg-brand-gold\.text-brand-green[\s\S]*var\(--text-on-gold\)/,'Legacy gold-background foreground compatibility guard is missing.');
 requirePattern(appStyles,/\.bg-brand-green\.text-white[\s\S]*var\(--text-on-green\)/,'Legacy green-background foreground compatibility guard is missing.');
}

const capacitorConfig=requireFile('capacitor.config.ts');
requirePattern(capacitorConfig,/appId:\s*['"]com\.goldenoremar\.app['"]/,'Capacitor app identifier must remain com.goldenoremar.app.');
requirePattern(capacitorConfig,/appName:\s*['"]Golden Oremar['"]/,'Capacitor app name must remain Golden Oremar.');
requirePattern(capacitorConfig,/webDir:\s*['"]dist['"]/,'Capacitor must package the production dist directory.');

const androidManifest=requireFile('android/app/src/main/AndroidManifest.xml');
if(androidManifest){
 requirePattern(androidManifest,/android:allowBackup="false"/,'Android backups must remain disabled for release.');
 requirePattern(androidManifest,/android:usesCleartextTraffic="false"/,'Android cleartext traffic must remain disabled.');
 requirePattern(androidManifest,/android\.permission\.INTERNET/,'Android INTERNET permission is required.');
 requirePattern(androidManifest,/android\.permission\.POST_NOTIFICATIONS/,'Android 13+ notification permission must be declared.');
 requirePattern(androidManifest,/android\.permission\.RECORD_AUDIO/,'Android native voice search requires RECORD_AUDIO permission.');
 if(!/android:scheme="com\.goldenoremar\.app"/.test(androidManifest)||!/android:host="auth"/.test(androidManifest))failures.push('Android auth callback deep link contract is missing.');
}
const androidBuild=requireFile('android/app/build.gradle');
if(androidBuild){requirePattern(androidBuild,/namespace\s*=\s*"com\.goldenoremar\.app"/,'Android namespace does not match the canonical app id.');requirePattern(androidBuild,/applicationId\s+"com\.goldenoremar\.app"/,'Android applicationId does not match the canonical app id.');requirePattern(androidBuild,/sourceCompatibility\s+JavaVersion\.VERSION_21/,'Android Java source compatibility must remain on the verified Java 21 baseline.');}
const androidMain=requireFile('android/app/src/main/java/com/goldenoremar/app/MainActivity.kt');
if(androidMain){requirePattern(androidMain,/@CapacitorPlugin\([\s\S]*name\s*=\s*"NativeSpeech"/,'Android NativeSpeech Capacitor plugin is missing.');requirePattern(androidMain,/SpeechRecognizer\.createSpeechRecognizer/,'Android NativeSpeech must use the platform SpeechRecognizer.');requirePattern(androidMain,/registerPlugin\(NativeSpeechPlugin::class\.java\)/,'Android NativeSpeech plugin registration is missing.');}

const iosInfo=requireFile('ios/App/App/Info.plist');
if(iosInfo){requirePattern(iosInfo,/<key>CFBundleDevelopmentRegion<\/key>\s*<string>tr<\/string>/,'iOS development region must remain Turkish.');requirePattern(iosInfo,/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/,'iOS export-compliance metadata is missing.');requirePattern(iosInfo,/<string>com\.goldenoremar\.app<\/string>/,'iOS auth callback URL scheme is missing.');requirePattern(iosInfo,/<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>/,'iOS microphone usage description is required for native voice search.');requirePattern(iosInfo,/<key>NSSpeechRecognitionUsageDescription<\/key>\s*<string>[^<]+<\/string>/,'iOS speech-recognition usage description is required.');}
const iosProject=requireFile('ios/App/App.xcodeproj/project.pbxproj');
if(iosProject){requirePattern(iosProject,/PRODUCT_BUNDLE_IDENTIFIER = com\.goldenoremar\.app;/,'iOS bundle identifier does not match the canonical app id.');requirePattern(iosProject,/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/,'iOS deployment target must remain on the verified iOS 15+ baseline.');}
const iosScene=requireFile('ios/App/App/SceneDelegate.swift');
if(iosScene){requirePattern(iosScene,/class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin/,'iOS NativeSpeech Capacitor plugin is missing.');if(!/SFSpeechRecognizer/.test(iosScene)||!/AVAudioEngine/.test(iosScene))failures.push('iOS NativeSpeech must use native speech and audio frameworks.');requirePattern(iosScene,/registerPluginInstance\(NativeSpeechPlugin\(\)\)/,'iOS NativeSpeech plugin registration is missing.');}

const indexHtml=requireFile('index.html');
if(indexHtml){requirePattern(indexHtml,/<html lang="tr">/,'Document language must remain Turkish.');requirePattern(indexHtml,/name="viewport"[^>]*viewport-fit=cover/,'Safe-area viewport-fit=cover metadata is required.');requirePattern(indexHtml,/name="description"/,'Production meta description is required.');if(!/property="og:title"/.test(indexHtml)||!/name="twitter:title"/.test(indexHtml))failures.push('Public share metadata is incomplete.');}

if(failures.length){console.error('Golden Oremar release audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar release audit passed: canonical Supabase runtime, Android/iOS app-shell, native speech, seller lifecycle gates, fail-closed admin data, accounting currency truth, theme contrast, retired-runtime and native release metadata contracts are intact.');
