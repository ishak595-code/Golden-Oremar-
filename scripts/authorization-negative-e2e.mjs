import crypto from 'node:crypto';

const supabaseUrl=String(process.env.VITE_SUPABASE_URL||'').replace(/\/+$/,'');
const publishableKey=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const oidcToken=String(process.env.E2E_CI_OIDC_TOKEN||'').trim();
const runId=String(process.env.GITHUB_RUN_ID||'').trim();
const controlUrl=String(process.env.E2E_CI_CONTROL_URL||`${supabaseUrl}/functions/v1/ci-e2e-user`).trim();
const email=`goldenoremar+ci-e2e-${runId}@gmail.com`;
const password=`${crypto.randomBytes(28).toString('base64url')}Aa1!`;
const forbiddenPermissions=[
  'admin.access','role.manage','refund.execute','payout.release','system.configure',
  'payment.manage','security.manage','user.erase','product.remove',
];

function required(value,label){if(!value)throw new Error(`${label}_required`);return value;}
required(supabaseUrl,'supabase_url');required(publishableKey,'supabase_publishable_key');required(oidcToken,'github_oidc_token');
if(!/^\d{1,24}$/.test(runId))throw new Error('github_run_id_invalid');

async function jsonBody(response){return response.json().catch(()=>null);}
async function control(action,payload={}){
  const response=await fetch(controlUrl,{method:'POST',headers:{Authorization:`Bearer ${oidcToken}`,'Content-Type':'application/json'},body:JSON.stringify({action,runId,...payload})});
  const body=await jsonBody(response);
  if(!response.ok||body?.ok!==true)throw new Error(`ci_control_${action}_failed:${response.status}:${String(body?.error||'unknown')}`);
  return body;
}
async function rpc(name,token,args={}){
  const response=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json','Cache-Control':'no-store'},
    body:JSON.stringify(args),
  });
  return{response,body:await jsonBody(response)};
}

let provisioned=false;
try{
  const created=await control('provision',{password,displayName:'Golden Oremar Authorization CI',phone:'+905379594851'});
  if(created.provisioned!==true||created.emailConfirmed!==true)throw new Error('disposable_customer_provision_not_confirmed');
  provisioned=true;

  const signIn=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`,{
    method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password}),
  });
  const session=await jsonBody(signIn);
  const accessToken=String(session?.access_token||'');
  if(!signIn.ok||!accessToken)throw new Error(`customer_sign_in_failed:${signIn.status}`);

  const contextResult=await rpc('authorization_context_v1',accessToken,{});
  if(!contextResult.response.ok||!contextResult.body||typeof contextResult.body!=='object'||Array.isArray(contextResult.body)){
    throw new Error(`authorization_context_failed:${contextResult.response.status}`);
  }
  const context=contextResult.body;
  const roles=Array.isArray(context.roles)?context.roles.map(String):[];
  const permissions=Array.isArray(context.permissions)?context.permissions.map(String):[];
  if(!roles.includes('customer'))throw new Error('customer_baseline_role_missing');
  if(roles.some(role=>['support','content_editor','operations','moderator','admin','super_admin'].includes(role)))throw new Error(`unexpected_management_role:${roles.join(',')}`);
  if(context.canAccessAdmin!==false)throw new Error('customer_admin_shell_escalation');
  const leaked=forbiddenPermissions.filter(permission=>permissions.includes(permission));
  if(leaked.length)throw new Error(`customer_critical_capability_leak:${leaked.join(',')}`);

  const permissionResult=await rpc('authorization_has_permission_v1',accessToken,{p_permission_key:'role.manage'});
  if(!permissionResult.response.ok||permissionResult.body!==false)throw new Error(`role_manage_false_check_failed:${permissionResult.response.status}:${JSON.stringify(permissionResult.body)}`);

  const privilegedResult=await rpc('admin_list_platform_users_v3',accessToken,{});
  if(privilegedResult.response.ok)throw new Error('customer_direct_admin_rpc_escalation');
  const denialText=JSON.stringify(privilegedResult.body||{});
  if(!/42501|admin_required|permission_required|insufficient_privilege/i.test(denialText)){
    throw new Error(`unexpected_admin_rpc_denial:${privilegedResult.response.status}:${denialText.slice(0,300)}`);
  }

  console.log('Golden Oremar real-JWT authorization negative E2E passed: disposable customer has no management capability and direct privileged RPC access is denied.');
}finally{
  if(provisioned){
    try{await control('delete');}
    catch(error){console.error('authorization-negative-e2e cleanup failed',error instanceof Error?error.message:'unknown');process.exitCode=1;}
  }
}