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
if(!/^golden-oremar-e2e-[0-9]+@e2e\.goldenoremar\.com$/.test(email))throw new Error('Refusing E2E cleanup because the recorded email is not a Golden Oremar disposable test identity.');
const publicOnly=report?.mode==='public-only'||report?.checks?.authenticated_customer_journey_skipped===true;
if(publicOnly){
 report.hardCleanup={status:'not_required',detail:'Public-only Chromium run did not provision an Auth user.'};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log('Public-only E2E run created no Auth user; hard cleanup is not required.');
 process.exit(0);
}
const url=String(process.env.VITE_SUPABASE_URL||'').trim();
const serviceRole=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
if(!url)throw new Error('VITE_SUPABASE_URL is required for E2E cleanup.');
if(!serviceRole){
 report.hardCleanup={status:'failed',detail:'Authenticated E2E provisioned a disposable user but SUPABASE_SERVICE_ROLE_KEY is unavailable for hard deletion.'};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 throw new Error('Authenticated E2E cleanup requires SUPABASE_SERVICE_ROLE_KEY.');
}
const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const expectedUserId=String(report?.provisionedUserId||'').trim();
let found=null;
if(expectedUserId){
 const {data,error}=await admin.auth.admin.getUserById(expectedUserId);
 if(error&&!String(error.message||'').toLowerCase().includes('not found'))throw error;
 const candidate=data?.user||null;
 if(candidate&&String(candidate.email||'').toLowerCase()!==email)throw new Error('Refusing E2E cleanup because the provisioned user id no longer matches the recorded disposable email.');
 found=candidate;
}
if(!found){
 for(let page=1;page<=20&&!found;page+=1){
  const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
  if(error)throw error;
  found=(data?.users||[]).find(user=>String(user.email||'').toLowerCase()===email)||null;
  if((data?.users||[]).length<1000)break;
 }
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
