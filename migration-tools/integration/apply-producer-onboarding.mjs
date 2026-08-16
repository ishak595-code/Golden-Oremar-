import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');
const anchor = "import AccountCenter from './features/account/AccountCenter';";
if (!source.includes(anchor)) throw new Error('AccountCenter import missing; apply cumulative patches in order.');
const importLine = "import ProducerApplicationFlow from './features/producer-onboarding/ProducerApplicationFlow';";
if (!source.includes(importLine)) source = source.replace(anchor, `${anchor}\n${importLine}`);

const legacy = `      if (accountView === 'vendor-apply') {\n        return <VendorOnboarding />;\n      }`;
if (!source.includes(legacy)) throw new Error('Legacy vendor-apply branch not found.');
source = source.replace(legacy, `      if (accountView === 'vendor-apply') {\n        return <ProducerApplicationFlow currentUser={currentUser} onBack={() => setAccountView('menu')} />;\n      }`);

if (source.includes('return <VendorOnboarding />')) throw new Error('Legacy VendorOnboarding remains mounted.');
fs.writeFileSync(target, source);
console.log(`Golden Oremar Supabase producer onboarding integrated into ${target}`);
