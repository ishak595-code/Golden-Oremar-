export type IntegrationRuntime={
 iyzicoApiKey:string;
 iyzicoSecretKey:string;
 iyzicoBaseUrl:string;
 resendApiKey:string;
 transactionalEmailFrom:string;
 fcmProjectId:string;
 fcmServiceAccountEmail:string;
 fcmPrivateKey:string;
 apnsTeamId:string;
 apnsKeyId:string;
 apnsPrivateKey:string;
 apnsBundleId:string;
};

type RecordLike=Record<string,unknown>;
let cached:{value:IntegrationRuntime;expiresAt:number}|null=null;
function text(value:unknown,max=20000){if(typeof value!=='string')return'';const next=value.trim();if(!next||next.length>max||/[\u0000]/.test(next))return'';return next;}
function env(name:string,max=20000){return text(Deno.env.get(name),max);}
function record(value:unknown):value is RecordLike{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function safeIyzicoBase(value:string){return value==='https://api.iyzipay.com'||value==='https://sandbox-api.iyzipay.com'?value:'';}
async function loadVaultRuntime():Promise<RecordLike>{
 const url=env('SUPABASE_URL',2048).replace(/\/+$/,'');
 const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY',5000);
 if(!url||!serviceKey)throw new Error('service_runtime_credentials_missing');
 const response=await fetch(`${url}/rest/v1/rpc/service_get_integration_runtime_v1`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json','Accept':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error(`integration_runtime_rpc_failed:${response.status}`);
 const data=await response.json().catch(()=>null);
 if(!record(data))throw new Error('integration_runtime_invalid');
 return data;
}
export async function loadIntegrationRuntime():Promise<IntegrationRuntime>{
 if(cached&&cached.expiresAt>Date.now())return cached.value;
 let vault:RecordLike={};
 try{vault=await loadVaultRuntime();}catch(error){console.error('integration_runtime_vault_unavailable',error instanceof Error?error.message:String(error));}
 const value:IntegrationRuntime={
  iyzicoApiKey:text(vault.iyzicoApiKey)||env('IYZICO_API_KEY'),
  iyzicoSecretKey:text(vault.iyzicoSecretKey)||env('IYZICO_SECRET_KEY'),
  iyzicoBaseUrl:safeIyzicoBase(text(vault.iyzicoBaseUrl,2048))||safeIyzicoBase(env('IYZICO_BASE_URL',2048)),
  resendApiKey:text(vault.resendApiKey)||env('RESEND_API_KEY'),
  transactionalEmailFrom:text(vault.transactionalEmailFrom,320)||env('TRANSACTIONAL_EMAIL_FROM',320),
  fcmProjectId:text(vault.fcmProjectId,255)||env('FCM_PROJECT_ID',255),
  fcmServiceAccountEmail:text(vault.fcmServiceAccountEmail,320)||env('FCM_SERVICE_ACCOUNT_EMAIL',320),
  fcmPrivateKey:text(vault.fcmPrivateKey)||env('FCM_PRIVATE_KEY'),
  apnsTeamId:text(vault.apnsTeamId,64)||env('APNS_TEAM_ID',64),
  apnsKeyId:text(vault.apnsKeyId,64)||env('APNS_KEY_ID',64),
  apnsPrivateKey:text(vault.apnsPrivateKey)||env('APNS_PRIVATE_KEY'),
  apnsBundleId:text(vault.apnsBundleId,255)||env('APNS_BUNDLE_ID',255)||'com.goldenoremar.app'
 };
 cached={value,expiresAt:Date.now()+20_000};
 return value;
}
export function integrationReadiness(value:IntegrationRuntime){return{
 iyzicoConfigured:Boolean(value.iyzicoApiKey&&value.iyzicoSecretKey&&safeIyzicoBase(value.iyzicoBaseUrl)),
 transactionalEmailConfigured:Boolean(value.resendApiKey&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.transactionalEmailFrom)),
 fcmConfigured:Boolean(value.fcmProjectId&&value.fcmServiceAccountEmail&&value.fcmPrivateKey.includes('BEGIN PRIVATE KEY')),
 apnsConfigured:Boolean(value.apnsTeamId&&value.apnsKeyId&&value.apnsPrivateKey.includes('BEGIN PRIVATE KEY')&&value.apnsBundleId)
};}
