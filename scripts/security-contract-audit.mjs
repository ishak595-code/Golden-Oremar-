import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

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
  'patch.js',
]);

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

    if (!codeExtensions.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    for (const pattern of hardcodedSecretPatterns) {
      if (pattern.re.test(content)) failures.push(`${pattern.label}: ${relative}`);
    }

    if (legacyProductModelFiles.has(relative)) {
      for (const field of forbiddenLegacyProductFields) {
        if (field.re.test(content)) failures.push(`${field.label} must not return to canonical Supabase product/admin code: ${relative}`);
      }
    }

    if (/firebase\/(?:app|auth|firestore|storage)/i.test(content) || /from\s+['"][^'"]*firebase[^'"]*['"]/i.test(content)) {
      failures.push(`Firebase runtime import must not return: ${relative}`);
    }

    if (/request\.auth\.token\.email\s*==?\s*['"][^'"]+@[^'"]+['"]/i.test(content)) {
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
if (pkg.dependencies?.firebase || pkg.devDependencies?.firebase) failures.push('Firebase package must not return to the dependency graph.');

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
if (/^JWT_SECRET=/m.test(envExample)) failures.push('Legacy Node JWT_SECRET must not be reintroduced into the Supabase/Capacitor runtime contract.');
if (/VITE_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|SERVICE_ROLE|API_KEY)\s*=\s*\S+/m.test(envExample)) failures.push('Server secrets must never be exposed through VITE_ variables.');

if (failures.length) {
  console.error('Security contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security contract audit passed. No retired credential reset path, Firebase auth bypass, hard-coded password/JWT fallback, or legacy product-admin field contract detected.');
