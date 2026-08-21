import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const selfAuditPath = 'scripts/security-contract-audit.mjs';

const forbiddenBasenames = new Set([
  'reset_admin.ts',
  'reset_password.ts',
  'check_pass.ts',
  'test_login.ts',
  'check_db.ts',
  'firestore.rules',
  'server.ts',
  'output.txt',
  'temp.txt',
  'grep_ana.txt',
  'count.ts',
  'patch.js',
]);

const retiredRelativePaths = new Set([
  'src/context/DataContext.tsx',
  'server/db.ts',
]);

const legacyRootFixScriptPatterns = [
  /^(?:add|fix|update|edit|move|organize)_[^/]+\.(?:cjs|js|ts)$/i,
  /^addHealthInfo\.cjs$/i,
  /^implement_returns\.cjs$/i,
  /^list_urls\.cjs$/i,
];

const legacyProductModelFiles = new Set([
  'src/admin/AdminDashboard.tsx',
  'src/admin/AdminProducts.tsx',
  'src/admin/AdminStock.tsx',
  'src/admin/productAdminApi.ts',
  'src/admin/inventoryAdminApi.ts',
  'src/admin/dashboardApi.ts',
]);
const forbiddenLegacyProductFields = [
  { re: /\bvendorId\b/, label: 'legacy product vendorId field' },
  { re: /\bvendor_id\b/, label: 'legacy product vendor_id field' },
  { re: /\bstore_name\b/, label: 'legacy product store_name field' },
];

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.rules']);
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'android', 'ios']);

const hardcodedSecretPatterns = [
  {
    re: /(?:password|passwd|pwd)\s*[:=]\s*['"`]([^'"`\n]{6,})['"`]/i,
    label: 'hard-coded password literal',
  },
  {
    re: /(?:JWT_SECRET|jwtSecret|jwt_secret)[\s\S]{0,120}(?:\|\||\?\?)[\s\S]{0,40}['"`]([^'"`\n]{8,})['"`]/i,
    label: 'hard-coded JWT secret fallback',
  },
  {
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    label: 'embedded private key',
  },
  {
    re: /(?:updateUserById|updateUser|createUser)[\s\S]{0,220}password\s*:\s*['"`]([^'"`\n]{6,})['"`]/i,
    label: 'admin auth mutation with hard-coded password',
  },
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath).replaceAll(path.sep, '/');

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (forbiddenBasenames.has(entry.name)) {
      failures.push(`Retired credential/debug/runtime artifact must not exist: ${relative}`);
    }
    if (retiredRelativePaths.has(relative)) {
      failures.push(`Retired legacy runtime/data-context path must not return: ${relative}`);
    }
    if (!relative.includes('/') && legacyRootFixScriptPatterns.some(pattern => pattern.test(relative))) {
      failures.push(`One-off root fix script must not return to repository root: ${relative}`);
    }

    if (!codeExtensions.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    if (relative !== selfAuditPath) {
      for (const pattern of hardcodedSecretPatterns) {
        if (pattern.re.test(content)) failures.push(`${pattern.label}: ${relative}`);
      }
    }

    if (legacyProductModelFiles.has(relative)) {
      for (const field of forbiddenLegacyProductFields) {
        if (field.re.test(content)) failures.push(`${field.label} must not return to canonical Supabase product/admin code: ${relative}`);
      }
    }

    if (relative !== selfAuditPath && (/firebase\/(?:app|auth|firestore|storage)/i.test(content) || /from\s+['"][^'"]*firebase[^'"]*['"]/i.test(content))) {
      failures.push(`Firebase runtime import must not return: ${relative}`);
    }

    if (relative !== selfAuditPath && /request\.auth\.token\.email\s*==?\s*['"][^'"]+@[^'"]+['"]/i.test(content)) {
      failures.push(`Hard-coded email authorization bypass detected: ${relative}`);
    }
  }
}

walk(root);

const requiredAdminContracts = [
  ['src/admin/productAdminApi.ts', /\bproducer_id\s*:\s*string\s*\|\s*null/, 'Admin product contract must use producer_id.'],
  ['src/admin/productAdminApi.ts', /admin_list_products_v3/, 'Admin product list must use the canonical Supabase RPC.'],
  ['src/admin/orderAdminApi.ts', /paymentStatus\s*:\s*string/, 'Admin order contract must expose normalized paymentStatus.'],
  ['src/admin/contentAdminApi.ts', /\bid\s*:\s*string\b/, 'Admin content identifiers must remain string/UUID at the TypeScript boundary.'],
];

for (const [relative, re, message] of requiredAdminContracts) {
  const fullPath = path.join(root, relative);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Required security/data contract file is missing: ${relative}`);
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!re.test(content)) failures.push(message);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const legacyRuntimeDependencies = ['firebase', 'better-sqlite3', 'bcryptjs', 'jsonwebtoken', 'express'];
for (const dependency of legacyRuntimeDependencies) {
  if (pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]) failures.push(`Retired legacy runtime dependency must not return: ${dependency}`);
}
const reactTypes = String(pkg.devDependencies?.['@types/react'] || '');
const reactDomTypes = String(pkg.devDependencies?.['@types/react-dom'] || '');
if (!/^[~^]?19\./.test(reactTypes)) failures.push('@types/react must stay on a React 19-compatible major version.');
if (!/^[~^]?19\./.test(reactDomTypes)) failures.push('@types/react-dom must stay on a React 19-compatible major version.');

const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
const exclusions = new Set(Array.isArray(tsconfig.exclude) ? tsconfig.exclude : []);
for (const required of ['node_modules', 'dist', 'supabase/functions', 'migration-tools']) {
  if (!exclusions.has(required)) failures.push(`tsconfig exclude must contain ${required}.`);
}

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
if (/^JWT_SECRET=/m.test(envExample)) failures.push('Legacy Node JWT_SECRET must not be reintroduced into the Supabase/Capacitor runtime contract.');
if (/VITE_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|SERVICE_ROLE|API_KEY)\s*=\s*\S+/m.test(envExample)) failures.push('Server secrets must never be exposed through VITE_ variables.');

if (failures.length) {
  console.error('Security contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security contract audit passed. Retired credential/debug/Node-Firebase paths, root fix scripts, hard-coded secrets, React type drift, tsconfig scope regressions and legacy product-admin field contracts are blocked.');
