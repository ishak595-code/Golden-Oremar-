import { supabase } from '../lib/supabase';

export type IyzicoEnvironment='sandbox'|'production';
export type IntegrationSecretName=
 |'golden_oremar_iyzico_api_key'
 |'golden_oremar_iyzico_secret_key'
 |'golden_oremar_resend_api_key'
 |'golden_oremar_fcm_service_account_email'
 |'golden_oremar_fcm_private_key'
 |'golden_oremar_apns_team_id'
 |'golden_oremar_apns_key_id'
 |'golden_oremar_apns_private_key';

export type IntegrationSecretStatus={
 iyzicoApiKeyConfigured:boolean;
 iyzicoSecretKeyConfigured:boolean;
 resendApiKeyConfigured:boolean;
 fcmServiceAccountEmailConfigured:boolean;
 fcmPrivateKeyConfigured:boolean;
 apnsTeamIdConfigured:boolean;
 apnsKeyIdConfigured:boolean;
 apnsPrivateKeyConfigured:boolean;
};

export type ReleaseSetup={
 appId:string;
 androidApplicationId:string;
 iosBundleId:string;
 publicOrigin:string;
 publicOriginConfigured:boolean;
 iyzicoReturnUrl:string;
 iyzicoReturnUrlConfigured:boolean;
 iyzicoReturnPath:string;
 iyzicoEnvironment:IyzicoEnvironment;
 transactionalEmailFrom:string;
 fcmProjectId:string;
 apnsBundleId:string;
 googleOAuthClientId:string;
 facebookAppId:string;
 productionActivated:boolean;
 secretsPolicy:'server_only_never_store_in_public_config';
 updatedAt:string;
};

function rec(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function requiredText(value:unknown,label:string,max=2048){if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const next=value.trim();if(!next||next.length>max||/[\u0000-\u001F\u007F]/.test(next))throw new Error(`${label} doğrulanamadı.`);return next;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function iso(value:unknown,label:string){const next=requiredText(value,label,80);if(Number.isNaN(Date.parse(next)))throw new Error(`${label} doğrulanamadı.`);return next;}
function environment(value:unknown):IyzicoEnvironment{const next=requiredText(value,'iyzico ortamı',20);if(next!=='sandbox'&&next!=='production')throw new Error('iyzico ortamı doğrulanamadı.');return next;}

function normalize(value:unknown):ReleaseSetup{
 if(!rec(value))throw new Error('Yayın ve entegrasyon ayarları doğrulanamadı.');
 const policy=requiredText(value.secretsPolicy,'Gizli anahtar politikası',80);
 if(policy!=='server_only_never_store_in_public_config')throw new Error('Gizli anahtar politikası doğrulanamadı.');
 return{
  appId:requiredText(value.appId,'Uygulama kimliği',255),androidApplicationId:requiredText(value.androidApplicationId,'Android uygulama kimliği',255),iosBundleId:requiredText(value.iosBundleId,'iOS bundle kimliği',255),
  publicOrigin:requiredText(value.publicOrigin,'Public HTTPS origin'),publicOriginConfigured:bool(value.publicOriginConfigured,'Public origin durumu'),
  iyzicoReturnUrl:requiredText(value.iyzicoReturnUrl,'iyzico dönüş adresi'),iyzicoReturnUrlConfigured:bool(value.iyzicoReturnUrlConfigured,'iyzico dönüş adresi durumu'),iyzicoReturnPath:requiredText(value.iyzicoReturnPath,'iyzico callback yolu',255),iyzicoEnvironment:environment(value.iyzicoEnvironment),
  transactionalEmailFrom:requiredText(value.transactionalEmailFrom,'Makbuz gönderici e-postası',254),fcmProjectId:requiredText(value.fcmProjectId,'FCM proje kimliği',255),apnsBundleId:requiredText(value.apnsBundleId,'APNs bundle kimliği',255),googleOAuthClientId:requiredText(value.googleOAuthClientId,'Google OAuth client kimliği',512),facebookAppId:requiredText(value.facebookAppId,'Facebook uygulama kimliği',64),
  productionActivated:bool(value.productionActivated,'Canlı yapılandırma durumu'),secretsPolicy:'server_only_never_store_in_public_config',updatedAt:iso(value.updatedAt,'Yayın ayarı güncelleme zamanı')
 };
}
function normalizeSecretStatus(value:unknown):IntegrationSecretStatus{
 if(!rec(value))throw new Error('Gizli entegrasyon anahtarlarının durumu doğrulanamadı.');
 return{
  iyzicoApiKeyConfigured:bool(value.iyzicoApiKeyConfigured,'iyzico API key durumu'),iyzicoSecretKeyConfigured:bool(value.iyzicoSecretKeyConfigured,'iyzico secret key durumu'),resendApiKeyConfigured:bool(value.resendApiKeyConfigured,'Resend API key durumu'),
  fcmServiceAccountEmailConfigured:bool(value.fcmServiceAccountEmailConfigured,'FCM service account durumu'),fcmPrivateKeyConfigured:bool(value.fcmPrivateKeyConfigured,'FCM private key durumu'),
  apnsTeamIdConfigured:bool(value.apnsTeamIdConfigured,'APNs Team ID durumu'),apnsKeyIdConfigured:bool(value.apnsKeyIdConfigured,'APNs Key ID durumu'),apnsPrivateKeyConfigured:bool(value.apnsPrivateKeyConfigured,'APNs private key durumu')
 };
}

export async function getReleaseSetup(){const{data,error}=await supabase.rpc('super_admin_get_release_setup_v2');if(error)throw error;return normalize(data);}
export async function getIntegrationSecretStatus(){const{data,error}=await supabase.rpc('super_admin_get_integration_secret_status_v1');if(error)throw error;return normalizeSecretStatus(data);}
export async function setIntegrationSecret(name:IntegrationSecretName,secret:string){const value=secret.trim();if(value.length<6||value.length>20000)throw new Error('Gizli anahtar değeri doğrulanamadı.');const{data,error}=await supabase.rpc('super_admin_set_integration_secret_v1',{p_name:name,p_secret:secret});if(error)throw error;if(!rec(data)||data.ok!==true||data.name!==name||typeof data.configured!=='boolean')throw new Error('Gizli anahtar kaydı doğrulanamadı.');return{configured:data.configured};}
export async function setIyzicoEnvironment(value:IyzicoEnvironment){const{data,error}=await supabase.rpc('super_admin_set_iyzico_environment_v1',{p_environment:value});if(error)throw error;const normalized=normalize(data);if(normalized.iyzicoEnvironment!==value)throw new Error('iyzico ortam değişikliği doğrulanamadı.');return normalized;}

export async function updateReleaseSetup(input:{publicOrigin:string;iyzicoReturnUrl:string;transactionalEmailFrom:string;fcmProjectId:string;apnsBundleId:string;googleOAuthClientId:string;facebookAppId:string;activateForProduction:boolean}){
 const publicOrigin=input.publicOrigin.trim().replace(/\/+$/,'');
 const returnUrl=input.iyzicoReturnUrl.trim(),email=input.transactionalEmailFrom.trim().toLowerCase(),fcm=input.fcmProjectId.trim(),apns=input.apnsBundleId.trim(),google=input.googleOAuthClientId.trim(),facebook=input.facebookAppId.trim();
 if(!/^https:\/\/[^\s/?#]+(?::\d{1,5})?$/.test(publicOrigin))throw new Error('Public origin gerçek HTTPS origin biçiminde olmalıdır.');
 if(!/^https:\/\/\S+$/.test(returnUrl))throw new Error('iyzico dönüş adresi HTTPS olmalıdır.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Makbuz gönderici e-postasını kontrol edin.');
 if(!/^[A-Za-z0-9._:-]+$/.test(fcm))throw new Error('FCM proje kimliğini kontrol edin.');
 if(!/^[A-Za-z0-9.-]+$/.test(apns))throw new Error('APNs bundle kimliğini kontrol edin.');
 if(!/^[A-Za-z0-9._:-]+\.apps\.googleusercontent\.com$/.test(google))throw new Error('Google OAuth client kimliğini kontrol edin.');
 if(!/^\d+$/.test(facebook))throw new Error('Facebook uygulama kimliği yalnız rakamlardan oluşmalıdır.');
 const{data,error}=await supabase.rpc('super_admin_update_release_setup_v2',{p_public_origin:publicOrigin,p_iyzico_return_url:returnUrl,p_transactional_email_from:email,p_fcm_project_id:fcm,p_apns_bundle_id:apns,p_google_oauth_client_id:google,p_facebook_app_id:facebook,p_activate_for_production:input.activateForProduction});
 if(error)throw error;return normalize(data);
}

export function releaseSetupErrorMessage(error:unknown,fallback='Yayın ve entegrasyon ayarları kaydedilemedi.'){
 const raw=error instanceof Error?error.message:String((error as{message?:unknown})?.message||'');
 const map:Array<[string,string]>=[
  ['super_admin_required','Bu bölümü yalnız Super Admin yönetebilir.'],['invalid_public_origin','Public origin HTTPS alan adı biçiminde olmalıdır.'],['invalid_iyzico_return_url','iyzico dönüş adresini kontrol edin.'],['invalid_transactional_email_from','Makbuz gönderici e-postasını kontrol edin.'],['invalid_fcm_project_id','FCM proje kimliğini kontrol edin.'],['invalid_apns_bundle_id','APNs bundle kimliğini kontrol edin.'],['invalid_google_oauth_client_id','Google OAuth client kimliğini kontrol edin.'],['invalid_facebook_app_id','Facebook uygulama kimliğini kontrol edin.'],['invalid_iyzico_environment','iyzico ortamını kontrol edin.'],['integration_secret_name_invalid','Gizli anahtar türü doğrulanamadı.'],['integration_secret_value_invalid','Gizli anahtar değeri sağlayıcının beklediği biçimde değil.']
 ];
 for(const[key,message]of map)if(raw.includes(key))return message;
 return raw&&raw.length<=320?raw:fallback;
}
