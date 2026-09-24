// Writes the app-association files that let Android and iOS open Golden
// Oremar links directly in the installed app:
//
//   dist/.well-known/assetlinks.json              Android App Links
//   dist/.well-known/apple-app-site-association   iOS Universal Links
//
// Both depend on values that only exist once the store accounts are set up:
// the SHA-256 fingerprint of the Android signing certificate, and the Apple
// Developer Team ID. Rather than hard-coding placeholders, they are read from
// build environment variables. Activating deep links is then a matter of
// setting two variables in Vercel and redeploying - no code change.
//
//   ANDROID_APP_SHA256_FINGERPRINTS  comma-separated, e.g. "AB:CD:...:EF".
//                                    With Play App Signing, include BOTH the
//                                    app signing key (Play Console > Setup >
//                                    App integrity) and the upload key, or
//                                    sideloaded and Play-installed builds
//                                    will verify differently.
//   APPLE_TEAM_ID                    10-character Team ID from the Apple
//                                    Developer account.
//   IOS_BUNDLE_ID                    optional, defaults to the Android
//                                    application id.
//
// A missing or malformed value skips that file with a log line. Serving a
// file with a wrong fingerprint would not break anything - Android would just
// fail verification and open the browser - but serving nothing is clearer, and
// validation stops a typo from silently leaving links unverified.
//
// Never fails the build.

import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const WELL_KNOWN = path.join(DIST, '.well-known');
const ANDROID_PACKAGE = 'com.goldenoremar.app';
// Must match the path prefixes claimed by the intent filter in
// android/app/src/main/AndroidManifest.xml.
const PUBLIC_PATHS = ['/urun/*', '/uretici/*', '/kategori/*', '/etkinlikler/*'];

const log = (message) => console.log(`[well-known] ${message}`);
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const TEAM_ID = /^[A-Z0-9]{10}$/;
const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

function writeJson(name, value) {
  fs.mkdirSync(WELL_KNOWN, { recursive: true });
  fs.writeFileSync(path.join(WELL_KNOWN, name), `${JSON.stringify(value, null, 2)}\n`);
}

function writeAndroid() {
  const raw = String(process.env.ANDROID_APP_SHA256_FINGERPRINTS || '').trim();
  if (!raw) {
    log('ANDROID_APP_SHA256_FINGERPRINTS not set; skipping assetlinks.json (Android opens links in the browser).');
    return;
  }
  const fingerprints = raw.split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
  const invalid = fingerprints.filter(value => !FINGERPRINT.test(value));
  if (!fingerprints.length || invalid.length) {
    log(`invalid fingerprint(s) ${JSON.stringify(invalid)}; expected 32 colon-separated hex pairs. Skipping assetlinks.json.`);
    return;
  }
  writeJson('assetlinks.json', [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
  }]);
  log(`assetlinks.json written for ${ANDROID_PACKAGE} with ${fingerprints.length} fingerprint(s).`);
}

function writeApple() {
  const teamId = String(process.env.APPLE_TEAM_ID || '').trim().toUpperCase();
  if (!teamId) {
    log('APPLE_TEAM_ID not set; skipping apple-app-site-association (iOS opens links in Safari).');
    return;
  }
  const bundleId = String(process.env.IOS_BUNDLE_ID || ANDROID_PACKAGE).trim();
  if (!TEAM_ID.test(teamId) || !BUNDLE_ID.test(bundleId)) {
    log('APPLE_TEAM_ID or IOS_BUNDLE_ID is malformed; skipping apple-app-site-association.');
    return;
  }
  // No file extension: Apple fetches exactly this path. vercel.json serves it
  // with Content-Type application/json.
  writeJson('apple-app-site-association', {
    applinks: {
      details: [{ appIDs: [`${teamId}.${bundleId}`], components: PUBLIC_PATHS.map(pattern => ({ '/': pattern })) }],
    },
  });
  log(`apple-app-site-association written for ${teamId}.${bundleId}.`);
}

try {
  if (!fs.existsSync(DIST)) {
    log('dist not found; run after vite build. Skipping.');
  } else {
    writeAndroid();
    writeApple();
  }
} catch (error) {
  log(`skipped after unexpected error: ${error?.message || error}`);
  process.exitCode = 0;
}
