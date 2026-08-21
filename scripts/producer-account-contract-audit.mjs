import fs from 'node:fs';

const failures=[];
function read(path){if(!fs.existsSync(path)){failures.push(`Missing producer account contract file: ${path}`);return'';}return fs.readFileSync(path,'utf8');}
function requireMatch(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const accountApi=read('src/features/account/api.ts');
if(accountApi){
  requireMatch(accountApi,/supabase\.rpc\('get_my_producer_dashboard_v2'\)/,'Seller account dashboard must use canonical v2 RPC.');
  requireMatch(accountApi,/supabase\.rpc\('get_my_producer_application_draft_v5'/,'Seller application resume must use canonical v5 RPC.');
  requireMatch(accountApi,/normalizeProducerCommerce/,'Seller dashboard v2 commerce data must be strictly normalized.');
  forbid(accountApi,/supabase\.rpc\('get_my_producer_dashboard_v1'\)/,'Retired seller dashboard v1 must not return to client runtime.');
  forbid(accountApi,/supabase\.rpc\('get_my_producer_application_draft_v4'/,'Retired seller application draft v4 must not return to client runtime.');
}

const migration=read('supabase/migrations/20260821075933_retire_legacy_producer_account_public_contracts_v1.sql');
if(migration){
  requireMatch(migration,/drop function if exists public\.get_my_producer_dashboard_v1\(\)/i,'Legacy public seller dashboard v1 must stay retired.');
  requireMatch(migration,/revoke execute on function private\.get_my_producer_dashboard_v1\(\) from public, anon, authenticated/i,'Legacy private dashboard core must stay inaccessible to clients.');
  requireMatch(migration,/revoke execute on function private\.get_my_producer_application_draft_v4\(uuid\) from public, anon, authenticated/i,'Legacy private application draft core must stay inaccessible to clients.');
  requireMatch(migration,/grant execute on function private\.get_my_producer_dashboard_v2\(\) to authenticated/i,'Canonical dashboard v2 wrapper dependency must remain executable for authenticated users.');
  requireMatch(migration,/grant execute on function private\.get_my_producer_application_draft_v5\(uuid\) to authenticated/i,'Canonical application draft v5 wrapper dependency must remain executable for authenticated users.');
}

if(failures.length){console.error('Golden Oremar producer account contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar producer account contract audit passed: canonical dashboard v2 and application draft v5 are enforced and retired client entrypoints stay closed.');
