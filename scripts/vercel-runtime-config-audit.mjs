import fs from 'node:fs';

const file = 'src/lib/supabase.ts';
const src = fs.readFileSync(file, 'utf8');
const failures = [];
const requirePattern = (pattern, message) => { if (!pattern.test(src)) failures.push(message); };
const forbidPattern = (pattern, message) => { if (pattern.test(src)) failures.push(message); };

requirePattern(/VITE_SUPABASE_URL\s*\|\|\s*CANONICAL_SUPABASE_URL/, 'Supabase URL must prefer environment configuration and retain the canonical public fallback.');
requirePattern(/VITE_SUPABASE_PUBLISHABLE_KEY\s*\|\|\s*CANONICAL_SUPABASE_PUBLISHABLE_KEY/, 'Supabase publishable key must prefer environment configuration and retain the canonical public fallback.');
requirePattern(/https:\/\/rmfcziawxjgcnxexbrvw\.supabase\.co/, 'Canonical Golden Oremar Supabase URL is missing.');
requirePattern(/sb_publishable_/, 'Browser fallback must use a modern Supabase publishable key.');
requirePattern(/startsWith\('sb_publishable_'\)/, 'Supabase public client key must be fail-closed validated.');
forbidPattern(/service_role/i, 'Service-role material must never be present in the browser Supabase client.');
forbidPattern(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, 'Legacy JWT-style anon/service keys must not be committed as the browser fallback.');

if (failures.length) {
  console.error('Vercel runtime config audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Vercel runtime config audit passed.');
