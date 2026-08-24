import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const bootstrapMigrationPath='supabase/migrations/20260824115302_add_stale_ci_e2e_user_garbage_collection_v1.sql';
const finalMigrationPath='supabase/migrations/20260824144122_tighten_ci_e2e_user_garbage_collection_v2.sql';

function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing CI garbage-collection contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const bootstrap=read(bootstrapMigrationPath);
if(bootstrap){
  requirePattern(bootstrap,/create or replace function private\.cleanup_stale_ci_e2e_users_v1\(\)/i,'CI garbage collection bootstrap function must remain present.');
  requirePattern(bootstrap,/security definer/i,'CI garbage collection must execute through its protected maintenance boundary.');
  requirePattern(bootstrap,/set search_path=''/i,'CI garbage collection must retain a fixed empty search_path.');
  requirePattern(bootstrap,/revoke all on function private\.cleanup_stale_ci_e2e_users_v1\(\) from public,anon,authenticated/i,'CI garbage collection must not be client executable.');
  requirePattern(bootstrap,/grant execute on function private\.cleanup_stale_ci_e2e_users_v1\(\) to service_role/i,'CI garbage collection must retain the service-role maintenance contract.');
}

const finalMigration=read(finalMigrationPath);
if(finalMigration){
  requirePattern(finalMigration,/created_at\s*<\s*timezone\('utc',now\(\)\)\s*-\s*interval\s*'30 minutes'/i,'CI garbage collection must retain the final 30-minute safety buffer.');
  requirePattern(finalMigration,/raw_user_meta_data->>'source'[^\n]*github-actions-e2e/i,'CI garbage collection must require the dedicated github-actions-e2e metadata source.');
  requirePattern(finalMigration,/raw_user_meta_data->>'e2e_run_id'[^\n]*\^\[0-9\]\{1,24\}\$/i,'CI garbage collection must validate the GitHub run id format.');
  requirePattern(finalMigration,/goldenoremar\\\+ci-e2e-\[0-9\]\{1,24\}\(-\[a-z0-9-\]\{1,24\}\)\?@gmail\\\.com/i,'CI garbage collection must restrict candidates to the run-and-optional-slot CI email namespace.');
  requirePattern(finalMigration,/raw_user_meta_data->>'e2e_slot'/i,'CI garbage collection must bind an optional disposable staff slot through metadata.');
  requirePattern(finalMigration,/'goldenoremar\+ci-e2e-'\|\|\(u\.raw_user_meta_data->>'e2e_run_id'\)[\s\S]*raw_user_meta_data->>'e2e_slot'[\s\S]*'@gmail\.com'/i,'CI garbage collection must bind the email identity to its exact run id and optional slot metadata.');
  requirePattern(finalMigration,/delete from private\.user_roles[\s\S]*user_id=target\.id[\s\S]*role in\('support','content_editor','operations','moderator','admin','super_admin'\)/i,'CI garbage collection must remove only disposable staff roles for the exact target before Auth deletion.');
  requirePattern(finalMigration,/delete from auth\.users where id=target\.id/i,'CI garbage collection must delete only the exact age-and-identity-qualified Auth user.');
  requirePattern(finalMigration,/limit\s+100/i,'CI garbage collection must remain batch limited.');
  requirePattern(finalMigration,/exception\s+when\s+foreign_key_violation/i,'CI garbage collection must fail safe when referenced data blocks deletion.');
  requirePattern(finalMigration,/skippedForeignKeyCount/i,'CI garbage collection must visibly report foreign-key-protected skips.');
  requirePattern(finalMigration,/ci\.e2e_stale_user_gc/i,'CI garbage collection must remain audit logged.');
  requirePattern(finalMigration,/minimumAgeMinutes[^\n]*30/i,'CI garbage collection audit evidence must record the 30-minute safety boundary.');
  requirePattern(finalMigration,/revoke all on function private\.cleanup_stale_ci_e2e_users_v1\(\) from public,anon,authenticated/i,'Final CI garbage collection must remain non-client-executable.');
  requirePattern(finalMigration,/grant execute on function private\.cleanup_stale_ci_e2e_users_v1\(\) to service_role/i,'Final CI garbage collection must remain service-role-only.');
  requirePattern(finalMigration,/golden-oremar-ci-e2e-user-gc/i,'CI garbage collection must retain its unique cron job identity.');
  requirePattern(finalMigration,/'7,22,37,52 \* \* \* \*'/,'CI garbage collection must run every 15 minutes at the final schedule.');
  forbid(finalMigration,/delete\s+from\s+auth\.users\s*;/i,'CI garbage collection must never contain an unscoped auth.users delete.');
}

const edge=read('supabase/functions/ci-e2e-user/index.ts');
requirePattern(edge,/source:\s*"github-actions-e2e"/,'CI user provisioning must retain the exact metadata source used by garbage collection.');
requirePattern(edge,/e2e_run_id:\s*runId/,'CI user provisioning must retain the exact run id metadata used by garbage collection.');
requirePattern(edge,/function emailForRun\(runId:string,slot:string\)[\s\S]*goldenoremar\+ci-e2e-\$\{runId\}\$\{slot\?`-\$\{slot\}`:''\}@gmail\.com/,'CI user provisioning must remain in the run-and-optional-slot email namespace.');
requirePattern(edge,/if\(slot\)metadata\.e2e_slot=slot/,'Disposable staff slots must be persisted into metadata for exact GC identity binding.');
requirePattern(edge,/async function deleteCiUser\([^)]*\)[\s\S]*removeCiStaffRoles\(admin,userId\)[\s\S]*admin\.auth\.admin\.deleteUser\(userId,false\)/,'Immediate CI cleanup must remove test staff roles and hard-delete the exact disposable Auth user.');
requirePattern(edge,/catch\(verificationError\)[\s\S]*deleteCiUserBestEffort\(admin,data\.user\.id\)/,'Failed CI authorization verification must trigger immediate best-effort hard deletion.');
forbid(edge,/admin\.rpc\([^\n]+\)\.catch\(/,'Supabase RPC builders must not be treated as native Promises with .catch().');

if(failures.length){console.error('Golden Oremar CI E2E garbage-collection contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar CI E2E garbage-collection contract audit passed: disposable identities are exact run/slot-bound, protected by a 30-minute age buffer, checked every 15 minutes, batch limited, staff-role-cleaned, FK safe, visibly audited and non-client-executable.');