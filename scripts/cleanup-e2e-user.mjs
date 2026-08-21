import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const reportPath=path.resolve('e2e-artifacts/customer-e2e-report.json');
if(!fs.existsSync(reportPath)){
 console.log('No customer E2E report exists; there is no recorded test account to clean up.');
 process.exit(0);
}
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const email=String(report?.email||'').trim().toLowerCase();
if(!/^golden-oremar-e2e-[0-9]+@example\.com$/.test(email))throw new Error('Refusing E2E cleanup because the recorded email is not a Golden Oremar disposable test identity.');
const url=String(process.env.VITE_SUPABASE_URL||'').trim();
const serviceRole=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
if(!url)throw new Error('VITE_SUPABASE_URL is required for E2E cleanup.');
if(!serviceRole){
 report.hardCleanup={status:'not_configured',detail:'SUPABASE_SERVICE_ROLE_KEY repository secret is not configured; the authenticated E2E flow requested normal account closure instead.'};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log('Hard E2E cleanup secret is not configured. Normal account-closure cleanup remains recorded.');
 process.exit(0);
}
const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let found=null;
for(let page=1;page<=20&&!found;page+=1){
 const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
 if(error)throw error;
 found=(data?.users||[]).find(user=>String(user.email||'').toLowerCase()===email)||null;
 if((data?.users||[]).length<1000)break;
}
if(!found){
 report.hardCleanup={status:'already_absent'};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log('Disposable E2E auth user is already absent.');
 process.exit(0);
}
const {error}=await admin.auth.admin.deleteUser(found.id,false);
if(error)throw error;
report.hardCleanup={status:'deleted',userId:found.id};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log('Disposable E2E auth user deleted with the configured service-role secret.');
