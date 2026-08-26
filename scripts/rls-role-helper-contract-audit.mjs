import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const migrationsDir=path.join(root,'supabase/migrations');
const roleFixName='20260826105451_harden_rls_role_helper_recursion_v1.sql';
const storageFixName='20260826110113_harden_storage_certificate_delete_private_boundary_v1.sql';

function readRequired(name){
  const full=path.join(migrationsDir,name);
  if(!fs.existsSync(full)){failures.push(`Missing required RLS hardening migration: ${name}`);return'';}
  return fs.readFileSync(full,'utf8');
}

const roleFix=readRequired(roleFixName);
if(roleFix&&!/alter\s+function\s+private\.has_role\s*\(\s*text\s*\)\s+security\s+definer\s*;/i.test(roleFix)){
  failures.push('private.has_role(text) must be SECURITY DEFINER to avoid recursive public.profiles RLS evaluation.');
}

const authorizationCore=readRequired('20260824101926_add_capability_authorization_core_v1.sql');
if(authorizationCore&&!/create\s+or\s+replace\s+function\s+private\.has_role\s*\(\s*required_role\s+text\s*\)[\s\S]*auth\.uid\(\)/i.test(authorizationCore)){
  failures.push('private.has_role must remain bound to the authenticated auth.uid() identity.');
}
if(authorizationCore&&!/public\.profiles[\s\S]*status\s*=\s*'active'[\s\S]*deleted_at\s+is\s+null/i.test(authorizationCore)){
  failures.push('private.has_role must retain active, non-deleted profile checks.');
}

const storageFix=readRequired(storageFixName);
if(storageFix){
  if(!/create\s+or\s+replace\s+function\s+private\.product_certificate_document_path_in_use_v1[\s\S]*security\s+definer/i.test(storageFix)){
    failures.push('Private certificate-reference inspection must stay behind a SECURITY DEFINER helper.');
  }
  if(!/product_certificate_admin_delete_unlinked_own[\s\S]*not\s+private\.product_certificate_document_path_in_use_v1\s*\(\s*name\s*\)/i.test(storageFix)){
    failures.push('Product-certificate Storage DELETE policy must use the private boundary helper.');
  }
  const policySection=storageFix.split(/create\s+policy\s+product_certificate_admin_delete_unlinked_own/i)[1]||'';
  if(/from\s+private\.product_certification_documents/i.test(policySection)){
    failures.push('Storage RLS must not directly query private.product_certification_documents.');
  }
}

for(const name of fs.readdirSync(migrationsDir).filter(name=>name.endsWith('.sql')&&name>roleFixName)){
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
console.log('RLS role-helper contract audit passed: auth.uid-bound role checks avoid profile recursion and Storage policies do not directly cross private evidence-table boundaries.');
