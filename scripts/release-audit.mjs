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
];

for (const relative of forbiddenRepoArtifacts) {
  if (fs.existsSync(path.join(root, relative))) {
    failures.push(`Obsolete static/demo artifact must not exist: ${relative}`);
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

const androidManifest = requireFile('android/app/src/main/AndroidManifest.xml');
if (androidManifest) {
  if (!/android:allowBackup="false"/.test(androidManifest)) failures.push('Android backups must remain disabled for release.');
  if (!/android:usesCleartextTraffic="false"/.test(androidManifest)) failures.push('Android cleartext traffic must remain disabled.');
  if (!/android\.permission\.INTERNET/.test(androidManifest)) failures.push('Android INTERNET permission is required.');
  if (!/android\.permission\.POST_NOTIFICATIONS/.test(androidManifest)) failures.push('Android 13+ notification permission must be declared.');
  if (!/android:scheme="com\.goldenoremar\.app"/.test(androidManifest) || !/android:host="auth"/.test(androidManifest)) {
    failures.push('Android auth callback deep link contract is missing.');
  }
}

const iosInfo = requireFile('ios/App/App/Info.plist');
if (iosInfo) {
  if (!/<key>CFBundleDevelopmentRegion<\/key>\s*<string>tr<\/string>/.test(iosInfo)) failures.push('iOS development region must remain Turkish.');
  if (!/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(iosInfo)) failures.push('iOS export-compliance metadata is missing.');
  if (!/<string>com\.goldenoremar\.app<\/string>/.test(iosInfo)) failures.push('iOS auth callback URL scheme is missing.');
}

const indexHtml = requireFile('index.html');
if (indexHtml) {
  if (!/<html lang="tr">/.test(indexHtml)) failures.push('Web document language must remain Turkish.');
  if (!/name="viewport"[^>]*viewport-fit=cover/.test(indexHtml)) failures.push('Safe-area viewport-fit=cover metadata is required.');
  if (!/name="description"/.test(indexHtml)) failures.push('Production meta description is required.');
  if (!/property="og:title"/.test(indexHtml) || !/name="twitter:title"/.test(indexHtml)) failures.push('Social sharing metadata is incomplete.');
}

if (failures.length) {
  console.error('Golden Oremar release audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Golden Oremar release audit passed: retired demo/static data and Firebase residue are absent, and Android/iOS/web release metadata contracts are intact.');
