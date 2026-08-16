import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const target = process.argv[2] || 'src/App.tsx';
const dataContext = process.argv[3] || 'src/context/DataContext.tsx';
const dir = path.dirname(fileURLToPath(import.meta.url));
const scripts = [
  'apply-account-center.mjs',
  'apply-gift-flow.mjs',
  'apply-server-cart.mjs',
];

for (const script of scripts) {
  console.log(`\n==> ${script}`);
  execFileSync(process.execPath, [path.join(dir, script), target], { stdio: 'inherit' });
}
console.log(`\n==> apply-supabase-auth.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-supabase-auth.mjs'), target, dataContext], { stdio: 'inherit' });
console.log(`\n==> apply-server-catalog.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-server-catalog.mjs'), target], { stdio: 'inherit' });
console.log(`\n==> apply-public-engagement.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-public-engagement.mjs'), target], { stdio: 'inherit' });
console.log(`\n==> apply-public-content.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-public-content.mjs'), target], { stdio: 'inherit' });
console.log(`\n==> apply-public-storefront.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-public-storefront.mjs'), target], { stdio: 'inherit' });
console.log(`\n==> apply-retire-migrated-firestore.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-retire-migrated-firestore.mjs'), target, dataContext], { stdio: 'inherit' });
console.log(`\n==> apply-producer-onboarding.mjs`);
execFileSync(process.execPath, [path.join(dir, 'apply-producer-onboarding.mjs'), target], { stdio: 'inherit' });
console.log('\nGolden Oremar current cumulative frontend integration completed.');
