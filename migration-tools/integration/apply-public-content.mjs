import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');

const importAnchor = "import AccountCenter from './features/account/AccountCenter';";
if (!source.includes(importAnchor)) throw new Error('AccountCenter import missing; apply cumulative patches in order.');
const contentImport = "import PublicHealthScreen from './features/content/PublicHealthScreen';";
if (!source.includes(contentImport)) source = source.replace(importAnchor, `${importAnchor}\n${contentImport}`);

const healthStart = source.indexOf("    if (currentTab === 'health') {");
const contactStart = source.indexOf("    if (currentTab === 'contact') {", healthStart);
if (healthStart < 0 || contactStart <= healthStart) throw new Error('Health route boundaries not found.');
const healthBranch = `    if (currentTab === 'health') {
      return (
        <PublicHealthScreen
          onBack={goBack}
          authenticated={!!currentUser}
          locale={currentUser?.locale || 'tr'}
          onLoginRequired={() => { showToast('İçerikleri favoriye kaydetmek için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
        />
      );
    }

`;
source = source.slice(0, healthStart) + healthBranch + source.slice(contactStart);

if (source.includes('return <HealthPage ')) throw new Error('Legacy HealthPage is still mounted after content patch.');

fs.writeFileSync(target, source);
console.log(`Golden Oremar public health + recipes integrated into ${target}`);
