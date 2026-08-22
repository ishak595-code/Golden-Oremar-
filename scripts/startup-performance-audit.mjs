import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const requirePattern=(body,re,message)=>{if(!re.test(body))failures.push(message);};
const forbidPattern=(body,re,message)=>{if(re.test(body))failures.push(message);};

const pkg=JSON.parse(read('package.json'));
const app=read('src/App.tsx');
const main=read('src/main.tsx');
const vite=read('vite.config.ts');

if(pkg.dependencies?.firebase||pkg.devDependencies?.firebase)failures.push('Firebase must not return to the startup dependency graph.');
forbidPattern(app,/^import[^\n]+(?:AdminPage|AccountCenter|ProducerApplicationFlow|ProductDetailScreen|CartCheckoutFlow)/m,'Heavy feature screens must remain lazy at startup.');
forbidPattern(app,/from['"][^'"]*(?:DataContext|\/data(?:\/|['"]))/,'Legacy static DataContext/data imports must not return to App startup.');
forbidPattern(main,/firebase/i,'Firebase must not enter the startup entry module.');
requirePattern(app,/const AdminPage=React\.lazy\(/,'AdminPage must remain lazy-loaded.');
requirePattern(app,/const AccountCenter=React\.lazy\(/,'AccountCenter must remain lazy-loaded.');
requirePattern(app,/const ProductDetailScreen=React\.lazy\(/,'Product detail must remain lazy-loaded.');
requirePattern(app,/const CartCheckoutFlow=React\.lazy\(/,'Checkout must remain lazy-loaded.');
requirePattern(vite,/return 'vendor-react'/,'React vendor chunk partition is missing.');
requirePattern(vite,/return 'vendor-supabase'/,'Supabase vendor chunk partition is missing.');
requirePattern(vite,/return 'vendor-capacitor'/,'Capacitor vendor chunk partition is missing.');
requirePattern(vite,/return 'vendor-icons'/,'Icon vendor chunk partition is missing.');
requirePattern(vite,/globIgnores:\s*\[['"]\*\*\/Admin\*\.js['"]\]/,'Back-office bundles must remain outside the customer PWA precache.');
requirePattern(main,/void loadAndApplyBrandAppearance\(\)\.catch/,'Brand appearance startup work must remain non-blocking.');
requirePattern(main,/void initNativeFeatures\(initialTheme\)\.catch/,'Native startup initialization must remain non-blocking.');
requirePattern(main,/void initNativePushListeners\(\)\.catch/,'Native push initialization must remain non-blocking.');

if(failures.length){console.error('Golden Oremar startup performance audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar startup performance audit passed: heavy routes remain lazy, Firebase/static DataContext stay out of startup, vendor chunks are partitioned, admin bundles stay out of customer precache, and non-critical startup work is asynchronous.');
