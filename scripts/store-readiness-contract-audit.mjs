import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Missing store-readiness file: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function expect(condition,message){if(!condition)failures.push(message);}
function expectPattern(body,pattern,message){expect(pattern.test(body),message);}

const ugc=read('supabase/migrations/20260822115138_add_store_ugc_safety_v1.sql');
const ugcDeny=read('supabase/migrations/20260822121148_deny_direct_ugc_private_table_access_v1.sql');
const android=read('android/app/build.gradle');
const workflow=read('.github/workflows/mobile-quality.yml');
const preflight=read('.github/workflows/consolidation-preflight.yml');
const plist=read('ios/App/App/Info.plist');
const pbx=read('ios/App/App.xcodeproj/project.pbxproj');
const trStrings=read('ios/App/App/tr.lproj/InfoPlist.strings');
const enStrings=read('ios/App/App/en.lproj/InfoPlist.strings');
const privacyPage=read('public/gizlilik-politikasi/index.html');
const termsPage=read('public/kullanim-sartlari/index.html');
const vercel=read('vercel.json');

if(ugc){
 for(const marker of [
  'create table private.user_terms_acceptances',
  'create table private.user_blocks',
  'create table private.user_content_reports',
  '2026-08-22-store-v1',
  'private.require_current_terms_v1',
  'private.report_published_review_v1',
  'private.report_conversation_v1',
  'private.set_conversation_user_block_v1',
  'private.admin_list_content_reports_v1',
  'private.admin_set_content_report_status_v1',
  'conversation_user_blocked',
  'private.get_product_reviews_v1',
  'public.get_my_terms_acceptance_v1',
  'public.accept_current_terms_v1',
  'public.report_published_review_v1',
  'public.report_conversation_v1',
 ]) expect(ugc.includes(marker),`UGC migration is missing canonical marker: ${marker}`);
 expectPattern(ugc,/revoke all on function public\.report_published_review_v1\(uuid,text,text\) from public, anon;/,'Review report wrapper must deny public/anon execution.');
 expectPattern(ugc,/grant execute on function public\.report_published_review_v1\(uuid,text,text\) to authenticated;/,'Review report wrapper must grant authenticated execution.');
}
if(ugcDeny){
 for(const policy of ['user_terms_acceptances_deny_direct_access','user_blocks_deny_direct_access','user_content_reports_deny_direct_access']) expect(ugcDeny.includes(policy),`UGC deny-policy migration is missing ${policy}.`);
 const denyBlocks=[...ugcDeny.matchAll(/create policy[\s\S]*?with check \(false\);/gi)].map(match=>match[0]);
 expect(denyBlocks.length===3,`Expected exactly 3 fail-closed UGC RLS policy blocks, found ${denyBlocks.length}.`);
 for(const block of denyBlocks){expect(/for all/i.test(block)&&/to public/i.test(block)&&/using \(false\)/i.test(block)&&/with check \(false\)/i.test(block),'Every UGC direct-access policy must deny all public-role rows and writes.');}
}

if(android){
 expectPattern(android,/signingConfigs\s*\{[\s\S]*release\s*\{/,'Android release signingConfig is missing.');
 for(const envName of ['ANDROID_KEYSTORE_FILE','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD']) expect(android.includes(envName),`Android release signing must read ${envName} from the environment.`);
 expectPattern(android,/signingConfig\s+signingConfigs\.release/,'Android release build must use signingConfigs.release when configured.');
}
if(workflow){
 expect(workflow.includes('release/store-readiness-2026-08'),'Mobile Quality Gate must run on the store-readiness branch.');
 expect(workflow.includes('Compile signed Android release bundle'),'CI must compile a signed Android release bundle.');
 expect(workflow.includes('jarsigner -verify -verbose -certs'),'CI must cryptographically verify the signed AAB.');
 expect(workflow.includes('golden-oremar-android-signed-release-aab-${{ github.sha }}'),'CI must publish the signed AAB artifact.');
 expect(workflow.includes('golden-oremar-android-debug-apk-${{ github.sha }}'),'CI must preserve downloadable debug APK artifacts.');
 expect(workflow.includes('Compile unsigned iOS Release archive'),'CI must compile a Release iphoneos archive.');
 expect(workflow.includes("-sdk iphoneos")&&workflow.includes("-configuration Release")&&workflow.includes('.xcarchive'),'iOS archive CI must target Release on iphoneos and produce an xcarchive.');
 expect(workflow.includes("-sdk iphonesimulator"),'iOS simulator compile gate must remain present.');
}
if(preflight){
 expect(preflight.includes('release/store-readiness-2026-08'),'Preflight must run on the store-readiness branch.');
 for(const command of ['npm run audit:all','npx tsc --noEmit','npm run build']) expect(preflight.includes(command),`Preflight is missing exact-head command: ${command}`);
}

if(plist){
 expectPattern(plist,/<key>CFBundleLocalizations<\/key>[\s\S]*?<string>tr<\/string>[\s\S]*?<string>en<\/string>/,'Info.plist must declare Turkish and English localizations.');
 expect(!plist.includes('NSUserTrackingUsageDescription'),'ATT usage description must not be added without tracking behavior.');
}
if(pbx){
 expect(pbx.includes('InfoPlist.strings in Resources'),'Xcode project must bundle localized InfoPlist.strings.');
 expect(pbx.includes('tr.lproj/InfoPlist.strings')&&pbx.includes('en.lproj/InfoPlist.strings'),'Xcode project must reference both Turkish and English InfoPlist.strings files.');
 expectPattern(pbx,/knownRegions\s*=\s*\([\s\S]*?\ben,[\s\S]*?\btr,[\s\S]*?Base,/,'Xcode knownRegions must contain en, tr and Base.');
 expectPattern(pbx,/CLANG_WARN_NON_LITERAL_NULL_CONVERSION\s*=\s*YES;/,'Existing iOS non-literal null conversion warning baseline must remain enabled.');
}
if(trStrings){
 expect(trStrings.includes('NSMicrophoneUsageDescription')&&trStrings.includes('NSSpeechRecognitionUsageDescription'),'Turkish InfoPlist.strings must localize microphone and speech-recognition permissions.');
 expect(trStrings.includes('sesli ürün araması')&&trStrings.includes('konuşma tanıma'),'Turkish permission copy is incomplete.');
}
if(enStrings){
 expect(enStrings.includes('NSMicrophoneUsageDescription')&&enStrings.includes('NSSpeechRecognitionUsageDescription'),'English InfoPlist.strings must localize microphone and speech-recognition permissions.');
 expect(enStrings.includes('search for products by voice')&&enStrings.includes('speech recognition'),'English permission copy is incomplete.');
}

expect(Boolean(privacyPage),'Publishable privacy-policy page must exist in the web build.');
expect(Boolean(termsPage),'Publishable terms page must exist in the web build.');
if(vercel){expect(vercel.includes('/gizlilik-politikasi')&&vercel.includes('/kullanim-sartlari'),'Stable legal-page routes must be configured.');}

if(failures.length){console.error('Golden Oremar store-readiness contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar store-readiness contract audit passed: live-mirrored UGC migrations, fail-closed RLS policies, Android signed-AAB pipeline, retained debug APK, iOS Release archive, Turkish/English permission localization, exact-head preflight gates and public legal routes are all enforced by repository contracts.');
