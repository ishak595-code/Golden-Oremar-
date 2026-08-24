import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const migrationPath='supabase/migrations/20260824115302_add_stale_ci_e2e_user_garbage_collection_v1.sql';

function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing CI garbage-collection contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const migration=read(migrationPath);
if(migration){
  requirePattern(migration,/create or replace function private\.cleanup_stale_ci_e2e_users_v1\(\)/i,'CI garbage collection function must remain present.');
  requirePattern(migration,/security definer/i,'CI garbage collection must execute through its protected maintenance boundary.');
  requirePattern(migration,/set search_path=''/i,'CI garbage collection must retain a fixed empty search_path.');
  requirePattern(migration,/created_at\s*<\s*timezone\('utc',now\(\)\)\s*-\s*interval\s*'6 hours'/i,'CI garbage collection must retain a minimum six-hour age boundary.');
  requirePattern(migration,/raw_user_meta_data->>'source'[^\n]*github-actions-e2e/i,'CI garbage collection must require the dedicated github-actions-e2e metadata source.');
  requirePattern(migration,/raw_user_meta_data->>'e2e_run_id'[^\n]*\^\[0-9\]\{1,24\}\$/i,'CI garbage collection must validate the GitHub run id format.');
  requirePattern(migration,/goldenoremar\+ci-e2e-/i,'CI garbage collection must require the dedicated CI email namespace.');
  requirePattern(migration,/limit\s+100/i,'CI garbage collection must remain batch limited.');
  requirePattern(migration,/exception\s+when\s+foreign_key_violation/i,'CI garbage collection must fail safe when referenced data blocks deletion.');
  requirePattern(migration,/ci\.e2e_stale_user_gc/i,'CI garbage collection must remain audit logged.');
  requirePattern(migration,/revoke all on function private\.cleanup_stale_ci_e2e_users_v1\(\) from public,anon,authenticated/i,'CI garbage collection must not be client executable.');
  requirePattern(migration,/grant execute on function private\.cleanup_stale_ci_e2e_users_v1\(\) to service_role/i,'CI garbage collection must retain the service-role maintenance contract.');
  requirePattern(migration,/golden-oremar-ci-e2e-user-gc/i,'CI garbage collection must retain its unique cron job identity.');
  requirePattern(migration,/'17 \* \* \* \*'/,'CI garbage collection must remain hourly rather than high-frequency.');
  forbid(migration,/delete\s+from\s+auth\.users\s*;/i,'CI garbage collection must never contain an unscoped auth.users delete.');
}

const edge=read('supabase/functions/ci-e2e-user/index.ts');
requirePattern(edge,/source:\s*"github-actions-e2e"/,'CI user provisioning must retain the exact metadata source used by garbage collection.');
requirePattern(edge,/e2e_run_id:\s*runId/,'CI user provisioning must retain the exact run id metadata used by garbage collection.');
requirePattern(edge,/goldenoremar\+ci-e2e-\$\{runId\}@gmail\.com/,'CI user provisioning must remain in the dedicated email namespace.');
requirePattern(edge,/deleteUser\(data\.user\.id/,'Failed CI authorization verification must delete the disposable user immediately.');

if(failures.length){console.error('Golden Oremar CI E2E garbage-collection contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar CI E2E garbage-collection contract audit passed: stale automation identities are narrowly scoped, age gated, batch limited, FK safe, audited and non-client-executable.');