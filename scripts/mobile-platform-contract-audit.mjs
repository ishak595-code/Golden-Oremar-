import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fail = (message) => {
  throw new Error(`[mobile-platform-contract] ${message}`);
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};
const expectPattern = (text, pattern, message) => {
  expect(pattern.test(text), message);
};

const pkg = JSON.parse(read('package.json'));
const androidVariables = read('android/variables.gradle');
const androidRootBuild = read('android/build.gradle');
const androidBuild = read('android/app/build.gradle');
const gradleWrapper = read('android/gradle/wrapper/gradle-wrapper.properties');
const iosProject = read('ios/App/App.xcodeproj/project.pbxproj');
const workflow = read('.github/workflows/mobile-quality.yml');

// Production policy for August 2026:
// - Build and target the latest stable Android generation: Android 17 / API 37.
// - Use an API-37-supported stable Android toolchain: AGP 9.3 + Gradle 9.5.
// - Retain Android API 24+ compatibility unless product requirements intentionally raise the floor.
// - Use AGP 9 built-in Kotlin instead of the legacy kotlin-android plugin.
// - Build iOS with the latest stable Xcode 26 line while retaining iOS 15+ compatibility.
// - Keep unreleased major Apple platform betas out of the production toolchain until stable.
const capacitorStable = '8.5.0';
expect(pkg.dependencies?.['@capacitor/android'] === capacitorStable, `@capacitor/android must remain on stable ${capacitorStable}.`);
expect(pkg.dependencies?.['@capacitor/core'] === capacitorStable, `@capacitor/core must remain on stable ${capacitorStable}.`);
expect(pkg.dependencies?.['@capacitor/ios'] === capacitorStable, `@capacitor/ios must remain on stable ${capacitorStable}.`);
expect(pkg.devDependencies?.['@capacitor/cli'] === capacitorStable, `@capacitor/cli must remain on stable ${capacitorStable}.`);

expectPattern(androidVariables, /minSdkVersion\s*=\s*24\b/, 'Android minimum support must remain API 24 or newer unless intentionally migrated.');
expectPattern(androidVariables, /compileSdkVersion\s*=\s*37\b/, 'Android must compile against API 37.');
expectPattern(androidVariables, /targetSdkVersion\s*=\s*37\b/, 'Android must target API 37.');
expectPattern(androidRootBuild, /com\.android\.tools\.build:gradle:9\.3\.0/, 'Android Gradle Plugin must be 9.3.0 for the API 37 production toolchain.');
expect(!/kotlin-gradle-plugin/.test(androidRootBuild), 'Legacy Kotlin Gradle plugin must not be applied with AGP 9 built-in Kotlin.');
expectPattern(gradleWrapper, /gradle-9\.5\.0-all\.zip/, 'Gradle wrapper must be 9.5.0 for AGP 9.3.');
expect(!/apply plugin:\s*['"]kotlin-android['"]/.test(androidBuild), 'Legacy kotlin-android plugin must not be applied.');
expect(!/kotlinOptions\s*\{/.test(androidBuild), 'Legacy android.kotlinOptions DSL must not return.');
expectPattern(androidBuild, /JavaVersion\.VERSION_21/, 'Android Java compatibility must remain 21.');
expectPattern(androidBuild, /proguard-android-optimize\.txt/, 'AGP 9 release build must use the supported optimized default ProGuard configuration.');

const deploymentTargets = [...iosProject.matchAll(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([0-9.]+);/g)].map((match) => match[1]);
expect(deploymentTargets.length >= 2, 'iOS Debug and Release deployment targets must both be declared.');
expect(deploymentTargets.every((target) => target === '15.0'), `iOS minimum support must remain 15.0 across configurations; found ${deploymentTargets.join(', ')}.`);
expectPattern(iosProject, /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*com\.goldenoremar\.app;/, 'Canonical iOS bundle identifier is missing.');

expectPattern(workflow, /sudo xcode-select -s \/Applications\/Xcode_26\.6\.app/, 'CI must use stable Xcode 26.6.');
expectPattern(workflow, /grep -q 'compileSdkVersion = 37' android\/variables\.gradle/, 'CI must guard Android compileSdk 37.');
expectPattern(workflow, /grep -q 'targetSdkVersion = 37' android\/variables\.gradle/, 'CI must guard Android targetSdk 37.');
expectPattern(workflow, /grep -q 'minSdkVersion = 24' android\/variables\.gradle/, 'CI must guard the supported Android compatibility floor.');
expectPattern(workflow, /com\.android\.tools\.build:gradle:9\.3\.0/, 'CI must guard AGP 9.3.0.');
expectPattern(workflow, /gradle-9\.5\.0-all\.zip/, 'CI must guard Gradle 9.5.0.');
expectPattern(workflow, /grep -q 'IPHONEOS_DEPLOYMENT_TARGET = 15\.0;' ios\/App\/App\.xcodeproj\/project\.pbxproj/, 'CI must guard the iOS 15 compatibility floor.');

console.log('Mobile platform contract OK: Android API 24-37 with AGP 9.3/Gradle 9.5, stable Capacitor 8.5.0, iOS 15+ built with Xcode 26.6.');
