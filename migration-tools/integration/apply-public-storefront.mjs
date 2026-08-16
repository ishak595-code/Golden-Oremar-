import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');

const accountImport = "import AccountCenter from './features/account/AccountCenter';";
if (!source.includes(accountImport)) throw new Error('AccountCenter import missing; apply cumulative patches in order.');
for (const line of [
  "import PublicInfoScreen from './features/storefront/PublicInfoScreen';",
  "import { usePublicStorefrontConfig } from './features/storefront/usePublicStorefrontConfig';",
]) {
  if (!source.includes(line)) source = source.replace(accountImport, `${accountImport}\n${line}`);
}

// HomeSection no longer reads public interface/hero/home-section data from Firestore DataContext.
const legacyStorefrontData = "  const { staticContent, heroCategories, homeSections } = useData();";
if (!source.includes(legacyStorefrontData)) throw new Error('Home storefront data anchor not found.');
source = source.replace(legacyStorefrontData, `  const { staticContent, heroCategories, homeSections, salesReadiness, error: storefrontConfigError } = usePublicStorefrontConfig('tr');\n  const storefrontSalesBlocked = salesReadiness?.status === 'blocked_pending_business_identity';`);

const fragmentOpen = `  return (\n    <>`;
const homeStart = source.indexOf('function HomeSection(');
const homeEnd = source.indexOf('\nfunction ', homeStart + 20);
if (homeStart < 0 || homeEnd <= homeStart) throw new Error('HomeSection boundaries not found.');
let home = source.slice(homeStart, homeEnd);
if (home.includes(fragmentOpen) && !home.includes('storefrontConfigError ?')) {
  home = home.replace(fragmentOpen, `  return (\n    <>\n      {storefrontConfigError ? <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{storefrontConfigError}</div> : null}\n      {storefrontSalesBlocked ? <div role="status" className="mx-auto mt-4 max-w-7xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ürünleri keşfedebilirsiniz. Canlı satış, işletme ve destek kimliği tamamlanana kadar ödeme tarafında kontrollü tutulur.</div> : null}`);
}
source = source.slice(0, homeStart) + home + source.slice(homeEnd);

// Replace legacy AboutPage route with the published Supabase page.
const aboutStart = source.indexOf("    if (currentTab === 'about') {");
if (aboutStart < 0) throw new Error('About route not found.');
const returnHomeStart = source.indexOf('\n    return', aboutStart);
if (returnHomeStart <= aboutStart) throw new Error('About route end boundary not found.');
const aboutBranch = `    if (currentTab === 'about') {\n      return <PublicInfoScreen page="about" locale={currentUser?.locale || 'tr'} onBack={goBack} />;\n    }\n\n`;
source = source.slice(0, aboutStart) + aboutBranch + source.slice(returnHomeStart);

if (source.includes('return <AboutPage />')) throw new Error('Legacy AboutPage is still mounted.');
fs.writeFileSync(target, source);
console.log(`Golden Oremar public storefront config + info pages integrated into ${target}`);
