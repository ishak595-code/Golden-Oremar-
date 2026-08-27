import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const pkgPath=path.join(root,'package.json');
const lockPath=path.join(root,'package-lock.json');
const mobileQualityPath=path.join(root,'.github','workflows','mobile-quality.yml');
const disposableMaintenancePath=path.join(root,'.github','workflows','dependency-baseline-maintenance.yml');

const fail=(message)=>{console.error(`Dependency runtime boundary audit failed: ${message}`);process.exitCode=1;};
const readJson=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));

for(const file of [pkgPath,lockPath,mobileQualityPath]){
  if(!fs.existsSync(file)) fail(`required file is missing: ${path.relative(root,file)}`);
}
if(process.exitCode) process.exit(process.exitCode);

const pkg=readJson(pkgPath);
const lock=readJson(lockPath);
const lockRoot=lock?.packages?.['']||{};
const workflow=fs.readFileSync(mobileQualityPath,'utf8');

const buildOnly=[
  '@capacitor/cli',
  '@tailwindcss/vite',
  '@types/cookie',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  '@vitejs/plugin-react',
  'autoprefixer',
  'tailwindcss',
  'typescript',
  'vite',
  'vite-plugin-pwa'
];

for(const name of buildOnly){
  if(pkg.dependencies?.[name]) fail(`${name} must not be a production dependency`);
  if(!pkg.devDependencies?.[name]) fail(`${name} must remain in devDependencies`);
  if(lockRoot.dependencies?.[name]) fail(`${name} leaked into package-lock production dependencies`);
  if(!lockRoot.devDependencies?.[name]) fail(`${name} is missing from package-lock devDependencies`);
}

if(lock.lockfileVersion!==3) fail(`expected package-lock lockfileVersion 3, got ${lock.lockfileVersion}`);

const strictProductionAudit='npm audit --omit=dev --audit-level=low';
const strictMatches=workflow.split(strictProductionAudit).length-1;
if(strictMatches!==1) fail(`expected exactly one strict production audit gate, found ${strictMatches}`);
if(workflow.includes('npm audit --omit=dev --audit-level=high')) fail('production audit gate was weakened back to high severity');
if(workflow.includes('npm audit --omit=dev --audit-level=moderate')) fail('production audit gate was weakened to moderate severity');
if(workflow.includes('npm audit --omit=dev --audit-level=critical')) fail('production audit gate was weakened to critical severity');

if(fs.existsSync(disposableMaintenancePath)) fail('disposable dependency maintenance workflow must not exist in the permanent repository state');

if(process.exitCode) process.exit(process.exitCode);
console.log(`Dependency runtime boundary audit passed: ${buildOnly.length} build-only packages are isolated from production and the LOW-severity production advisory gate is pinned.`);
