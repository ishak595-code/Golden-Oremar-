import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const migrationsDir=path.join(root,'supabase/migrations');
const fixName='20260826105451_harden_rls_role_helper_recursion_v1.sql';
const fixPath=path.join(migrationsDir,fixName);

if(!fs.existsSync(fixPath)){
  failures.push(`Missing RLS recursion hardening migration: ${fixName}`);
}else{
  const fix=fs.readFileSync(fixPath,'utf8');
  if(!/alter\s+function\s+private\.has_role\s*\(\s*text\s*\)\s+security\s+definer\s*;/i.test(fix)){
    failures.push('private.has_role(text) must be SECURITY DEFINER to avoid recursive public.profiles RLS evaluation.');
  }
  if(!/auth\.uid\(\)/i.test(fs.readFileSync(path.join(migrationsDir,'20260814164831_harden_indexes_and_rls.sql'),'utf8')) && !fix.includes('auth.uid')){
    // The helper itself is defined earlier; identity binding is additionally checked from the canonical authorization migration below.
  }
}

const authorizationCore=fs.readFileSync(path.join(migrationsDir,'20260824101926_add_capability_authorization_core_v1.sql'),'utf8');
if(!/create\s+or\s+replace\s+function\s+private\.has_role\s*\(\s*required_role\s+text\s*\)[\s\S]*auth\.uid\(\)/i.test(authorizationCore)){
  failures.push('private.has_role must remain bound to the authenticated auth.uid() identity.');
}
if(!/public\.profiles[\s\S]*status\s*=\s*'active'[\s\S]*deleted_at\s+is\s+null/i.test(authorizationCore)){
  failures.push('private.has_role must retain active, non-deleted profile checks.');
}

for(const name of fs.readdirSync(migrationsDir).filter(name=>name.endsWith('.sql')&&name>fixName)){
  const body=fs.readFileSync(path.join(migrationsDir,name),'utf8');
  if(/alter\s+function\s+private\.has_role\s*\(\s*text\s*\)\s+security\s+invoker/i.test(body)){
    failures.push(`Later migration reintroduces recursive invoker security for private.has_role: ${name}`);
  }
}

if(failures.length){
  console.error('RLS role-helper contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('RLS role-helper contract audit passed: role checks remain auth.uid-bound while bypassing recursive customer-facing profile RLS.');
