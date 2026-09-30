// Customers and sellers never see raw error text.
//
// Screens used to render error.message directly, so a dropped connection read
// "Failed to fetch", the Supabase quota stop read an English restriction
// notice, and database guards read "active_profile_required". All of them now
// go through src/lib/userFacingError.ts. This audit runs that function on the
// real messages we have seen and forbids the raw patterns from coming back.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const { code } = await transformWithEsbuild(fs.readFileSync('src/lib/userFacingError.ts', 'utf8'), 'userFacingError.ts', { loader: 'ts', format: 'esm' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-errors-'));
fs.writeFileSync(path.join(dir, 'm.mjs'), code);
const { userFacingError, USER_FACING } = await import(pathToFileURL(path.join(dir, 'm.mjs')).href);
fs.rmSync(dir, { recursive: true, force: true });

const FALLBACK = 'Sipariş yüklenemedi.';
const cases = [
  [new TypeError('Failed to fetch'), USER_FACING.network, 'browser network failure'],
  [new TypeError('Load failed'), USER_FACING.network, 'Safari network failure'],
  [{ message: 'Service for this project is restricted due to exceeded usage quota', status: 402 }, USER_FACING.quota, 'Supabase quota stop'],
  [{ message: 'JWT expired', code: 'PGRST301' }, USER_FACING.session, 'expired session'],
  [new Error('permission_required:product.update'), USER_FACING.permission, 'permission code'],
  [new Error('Too Many Requests'), USER_FACING.rate, 'rate limit'],
  [new Error('Invalid login credentials'), 'E-posta veya şifre hatalı.', 'sign-in failure'],
  [new Error('active_profile_required'), 'Hesabınız şu anda bu işlem için etkin değil. Destek ile iletişime geçebilirsiniz.', 'blocked profile'],
  [new Error('insufficient_stock'), FALLBACK, 'unknown snake_case code'],
  [{ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, FALLBACK, 'PostgREST text'],
  [new Error('duplicate key value violates unique constraint "orders_pkey"'), FALLBACK, 'SQL constraint text'],
  [new Error('Cannot read properties of undefined (reading \'id\')'), FALLBACK, 'JavaScript crash text'],
  [new Error('<html><body>502 Bad Gateway</body></html>'), FALLBACK, 'HTML error page'],
  [null, FALLBACK, 'nothing thrown'],
  [new Error('Bu sipariş artık iptal edilemez.'), 'Bu sipariş artık iptal edilemez.', 'our own Turkish message is kept'],
  [new Error('Sepette desteklenenden fazla ürün kalemi var.'), 'Sepette desteklenenden fazla ürün kalemi var.', 'our own validation message is kept'],
];
for (const [input, expected, label] of cases) {
  const got = userFacingError(input, FALLBACK);
  check(got === expected, `${label}: expected "${expected}", got "${got}".`);
}
for (const [key, sentence] of Object.entries(USER_FACING)) {
  check(/[çğıöşü]/i.test(sentence) && !/[_{}]/.test(sentence), `USER_FACING.${key} must be a plain Turkish sentence.`);
}

// No screen renders a raw message any more.
const raw = execSync(
  `grep -rnE "(\\b(e|err|error|caught|reason)\\??\\.message\\s*(\\|\\||\\?\\?)\\s*['\\"])|(instanceof Error\\s*\\?\\s*[a-zA-Z]+\\.message\\s*:\\s*['\\"][^'\\"]+['\\"])|showToast\\((e|err|error)\\.message" src/features src/App.tsx --include=*.tsx || true`,
  { encoding: 'utf8' },
).trim();
check(raw === '', `Screens must show errors through userFacingError, found raw messages:\n${raw}`);

// Sellers and customers are not told about internal tools.
const jargon = execSync(`grep -rnE "Supabase tarafında|Super Admin (incelemesine|onayından|onay verdiğinde|finans kuyruğuna|tarafından etkinleştirilmemiş|notu:|düzeltme notu|onayı bekliyor|incelemesinde)" src/features || true`, { encoding: 'utf8' }).trim();
check(jargon === '', `Seller and customer text must say "Golden Oremar ekibi", not internal role names:\n${jargon}`);

if (failures.length) {
  console.error('User-facing error contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`User-facing error contract audit passed: ${cases.length} real error shapes become clear Turkish, and no screen renders raw error text.`);
