import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const bootstrapMigrationPath='supabase/migrations/20260824115302_add_stale_ci_e2e_user_garbage_collection_v1.sql';
const tighteningMigrationPath='supabase/migrations/20260824144122_tighten_ci_e2e_user_garbage_collection_v2.sql';
const finalMigrationPath='supabase/migrations/20260824150902_fix_ci_e2e_gc_email_regex_v3.sql';

function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing CI garbage-collection contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function requireText(content,text,message){if(!content.includes(text))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const bootstrap=read(bootstrapMigrationPath);
if(bootstrap){
  requirePattern(bootstrap,/create or replace function private\.cleanup_stale_ci_e2e_users_v1\(\)/i,'CI garbage collection bootstrap function must remain present.');
  requirePattern(bootstrap,/security definer/i,'CI garbage collection must execute through its protected maintenance boundary.');
  requirePattern(bootstrap,/set search_path=''/i,'CI garbage collection must retain a fixed empty search_path.');
}

const tightening=read(tighteningMigrationPath);
if(tightening){
  requireText(tightening,"u.created_at < timezone('utc',now()) - interval '30 minutes'",'CI garbage collection must retain the 30-minute safety buffer.');
  requireText(tightening,"coalesce(u.raw_user_meta_data->>'source','')='github-actions-e2e'",'CI garbage collection must require the dedicated github-actions-e2e metadata source.');
  requireText(tightening,"coalesce(u.raw_user_meta_data->>'e2e_run_id','') ~ '^[0-9]{1,24}$'",'CI garbage collection must validate the GitHub run id format.');
  requireText(tightening,"u.raw_user_meta_data->>'e2e_slot'",'CI garbage collection must bind an optional disposable staff slot through metadata.');
  requireText(tightening,"'goldenoremar+ci-e2e-'||(u.raw_user_meta_data->>'e2e_run_id')||",'CI garbage collection must derive the exact candidate email from run id metadata.');
  requireText(tightening,"then '-'||(u.raw_user_meta_data->>'e2e_slot')",'CI garbage collection must include the exact optional slot in candidate identity binding.');
  requireText(tightening,"'7,22,37,52 * * * *'",'CI garbage collection must run every 15 minutes at the final schedule.');
}

const finalMigration=read(finalMigrationPath);
if(finalMigration){
  requireText(finalMigration,"u.created_at < timezone('utc',now()) - interval '30 minutes'",'Final CI garbage collection must preserve the 30-minute safety buffer.');
  requireText(finalMigration,"coalesce(u.raw_user_meta_data->>'source','')='github-actions-e2e'",'Final CI garbage collection must preserve its dedicated metadata source.');
  requireText(finalMigration,"coalesce(u.raw_user_meta_data->>'e2e_run_id','') ~ '^[0-9]{1,24}$'",'Final CI garbage collection must preserve strict run id validation.');
  requireText(finalMigration,"~ '^goldenoremar\\+ci-e2e-[0-9]{1,24}(-[a-z0-9-]{1,24})?@gmail\\.com$'",'Final CI garbage collection must use the corrected single-escape PostgreSQL regex for the run-and-optional-slot namespace.');
  requireText(finalMigration,"u.raw_user_meta_data->>'e2e_slot'",'Final CI garbage collection must preserve optional slot metadata binding.');
  requireText(finalMigration,"'goldenoremar+ci-e2e-'||(u.raw_user_meta_data->>'e2e_run_id')||",'Final CI garbage collection must preserve exact run-id email binding.');
  requireText(finalMigration,"then '-'||(u.raw_user_meta_data->>'e2e_slot')",'Final CI garbage collection must preserve exact slot email binding.');
  requirePattern(finalMigration,/delete from private\.user_roles[\s\S]*user_id=target\.id[\s\S]*role in\('support','content_editor','operations','moderator','admin','super_admin'\)/i,'CI garbage collection must remove only disposable staff roles for the exact target before Auth deletion.');
  requireText(finalMigration,'delete from auth.users where id=target.id;','CI garbage collection must delete only the exact qualified Auth user.');
  requirePattern(finalMigration,/limit\s+100/i,'CI garbage collection must remain batch limited.');
  requirePattern(finalMigration,/exception\s+when\s+foreign_key_violation/i,'CI garbage collection must fail safe when referenced data blocks deletion.');
  requireText(finalMigration,"'skippedForeignKeyCount',skipped_count",'CI garbage collection must visibly report foreign-key-protected skips.');
  requireText(finalMigration,"'ci.e2e_stale_user_gc'",'CI garbage collection must remain audit logged.');
  requireText(finalMigration,"'minimumAgeMinutes',30",'CI garbage collection audit evidence must record the 30-minute safety boundary.');
  requirePattern(finalMigration,/revoke all on function private\.cleanup_stale_ci_e2e_users_v1\(\) from public,anon,authenticated/i,'Final CI garbage collection must remain non-client-executable.');
  requirePattern(finalMigration,/grant execute on function private\.cleanup_stale_ci_e2e_users_v1\(\) to service_role/i,'Final CI garbage collection must remain service-role-only.');
  forbid(finalMigration,/delete\s+from\s+auth\.users\s*;/i,'CI garbage collection must never contain an unscoped auth.users delete.');
}

const edge=read('supabase/functions/ci-e2e-user/index.ts');
requireText(edge,'source:"github-actions-e2e"','CI user provisioning must retain the exact metadata source used by garbage collection.');
requireText(edge,'e2e_run_id:runId','CI user provisioning must retain the exact run id metadata used by garbage collection.');
requireText(edge,'function emailForRun(runId:string,slot:string){return `goldenoremar+ci-e2e-${runId}${slot?`-${slot}`:""}@gmail.com`;}','CI user provisioning must remain in the run-and-optional-slot email namespace.');
requireText(edge,'if(slot)metadata.e2e_slot=slot','Disposable staff slots must be persisted into metadata for exact GC identity binding.');
requirePattern(edge,/async function deleteCiUser\([^)]*\)[\s\S]*removeCiStaffRoles\(admin,userId\)[\s\S]*admin\.auth\.admin\.deleteUser\(userId,false\)/,'Immediate CI cleanup must remove test staff roles and hard-delete the exact disposable Auth user.');
requirePattern(edge,/catch\(verificationError\)[\s\S]*deleteCiUserBestEffort\(admin,data\.user\.id\)/,'Failed CI authorization verification must trigger immediate best-effort hard deletion.');
forbid(edge,/admin\.rpc\([^\n]+\)\.catch\(/,'Supabase RPC builders must not be treated as native Promises with .catch().');

if(failures.length){console.error('Golden Oremar CI E2E garbage-collection contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar CI E2E garbage-collection contract audit passed: identities are exact run/slot-bound, protected by a 30-minute buffer, checked every 15 minutes, batch limited, staff-role-cleaned, FK safe, visibly audited, non-client-executable and guarded by the corrected PostgreSQL email regex.');