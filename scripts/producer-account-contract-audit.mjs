import fs from 'node:fs';

const failures=[];
function read(path){if(!fs.existsSync(path)){failures.push(`Missing producer contract file: ${path}`);return'';}return fs.readFileSync(path,'utf8');}
function requireMatch(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const accountApi=read('src/features/account/api.ts');
if(accountApi){
  requireMatch(accountApi,/supabase\.rpc\('get_my_producer_dashboard_v2'\)/,'Seller account dashboard must use canonical v2 RPC.');
  forbid(accountApi,/supabase\.rpc\('get_my_producer_dashboard_v1'\)/,'Retired seller dashboard v1 must not return to client runtime.');
}

const onboardingApi=read('src/features/producer-onboarding/api.ts');
if(onboardingApi){
  requireMatch(onboardingApi,/supabase\.rpc\('get_my_producer_application_draft_v5'/,'Seller application resume must use canonical v5 RPC.');
  requireMatch(onboardingApi,/supabase\.rpc\('save_producer_application_draft_v5'/,'Seller application writes must use canonical v5 RPC.');
  requireMatch(onboardingApi,/supabase\.rpc\('submit_producer_application_v4'/,'Seller application submit must use canonical v4 RPC.');
  forbid(onboardingApi,/get_my_producer_application_draft_v[1-4]/,'Retired seller draft read RPCs must not return to client runtime.');
  forbid(onboardingApi,/save_producer_application_draft_v[1-4]/,'Retired seller draft write RPCs must not return to client runtime.');
  forbid(onboardingApi,/submit_producer_application_v[1-3]/,'Retired seller submit RPCs must not return to client runtime.');
}

const readMigration=read('supabase/migrations/20260821083330_flatten_producer_read_contracts_and_remove_orphan_storefronts.sql');
if(readMigration){
  requireMatch(readMigration,/create or replace function private\.get_my_producer_dashboard_v2\(\)/i,'Canonical dashboard v2 must have a standalone private implementation.');
  forbid(readMigration,/private\.get_my_producer_dashboard_v1\(\)\s*;/i,'Canonical dashboard v2 must not delegate to dashboard v1.');
  requireMatch(readMigration,/drop function if exists private\.get_my_producer_dashboard_v1\(\)/i,'Legacy private dashboard v1 must be physically retired.');
  requireMatch(readMigration,/create or replace function private\.get_my_producer_application_draft_v5/i,'Canonical application draft v5 must have a standalone private implementation.');
  requireMatch(readMigration,/drop function if exists public\.get_my_producer_application_draft_v2\(uuid\)/i,'Legacy draft v2 must be physically retired.');
  requireMatch(readMigration,/drop function if exists private\.get_my_producer_application_draft_v3\(uuid\)/i,'Legacy draft v3 must be physically retired.');
  requireMatch(readMigration,/drop function if exists private\.get_my_producer_application_draft_v4\(uuid\)/i,'Legacy draft v4 must be physically retired.');
  requireMatch(readMigration,/delete from public\.producers p/i,'Orphan storefront cleanup must remain part of the canonical read-contract migration.');
}

const writeMigration=read('supabase/migrations/20260821083551_flatten_producer_onboarding_write_contracts.sql');
if(writeMigration){
  requireMatch(writeMigration,/create or replace function private\.save_producer_application_draft_v5/i,'Canonical application save v5 must have a standalone private implementation.');
  requireMatch(writeMigration,/create or replace function private\.submit_producer_application_v4/i,'Canonical application submit v4 must have a standalone private implementation.');
  requireMatch(writeMigration,/drop function if exists public\.save_producer_application_draft_legacy_v1/i,'Legacy seller draft core must be physically retired.');
  requireMatch(writeMigration,/drop function if exists public\.save_producer_application_draft\(/i,'Unversioned seller draft core must be physically retired.');
  requireMatch(writeMigration,/drop function if exists public\.save_producer_application_draft_v2/i,'Seller draft v2 must be physically retired.');
  requireMatch(writeMigration,/drop function if exists private\.save_producer_application_draft_v3/i,'Seller draft v3 must be physically retired.');
  requireMatch(writeMigration,/drop function if exists private\.save_producer_application_draft_v4/i,'Seller draft v4 must be physically retired.');
  requireMatch(writeMigration,/drop function if exists public\.submit_producer_application\(uuid,jsonb\)/i,'Unversioned seller submit core must be physically retired.');
  requireMatch(writeMigration,/drop function if exists public\.submit_producer_application_v2\(uuid,jsonb\)/i,'Seller submit v2 must be physically retired.');
  requireMatch(writeMigration,/drop function if exists private\.submit_producer_application_v3\(uuid,jsonb\)/i,'Seller submit v3 must be physically retired.');
  requireMatch(writeMigration,/\/?\?tab=admin&adminView=vendor-applications|\/\?tab=admin&adminView=vendor-applications/i,'Producer application notification must target the canonical admin review screen.');
}

if(failures.length){console.error('Golden Oremar producer account contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar producer account contract audit passed: only canonical producer read/write entrypoints remain in runtime and legacy chains are physically retired by final migrations.');
