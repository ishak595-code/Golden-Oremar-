import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type R=Record<string,unknown>;
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function json(status:number,body:R){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
function rec(value:unknown):value is R{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function env(name:string){return Deno.env.get(name)?.trim()||'';}
function allEnv(...names:string[]){return names.every(name=>Boolean(env(name)));}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label}_invalid`);return value;}
function int(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label}_invalid`);return value;}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json(405,{ok:false,error:'method_not_allowed'});
 try{
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),authorization=req.headers.get('Authorization')||'';
  if(!url||!anon||!authorization)return json(401,{ok:false,error:'authentication_required'});
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const{data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user?.id)return json(401,{ok:false,error:'authentication_required'});
  const{data,error}=await client.rpc('super_admin_get_production_readiness_snapshot_v1');
  if(error)throw error;
  if(!rec(data)||data.ok!==true||!rec(data.integrity)||!rec(data.businessIdentity)||!rec(data.assets)||!rec(data.legalContent)||!rec(data.shipping)||!rec(data.producerPayments)||!rec(data.paymentControl))throw new Error('production_readiness_snapshot_invalid');

  const iyzicoBase=env('IYZICO_BASE_URL');
  const iyzicoConfigured=allEnv('IYZICO_API_KEY','IYZICO_SECRET_KEY','IYZICO_BASE_URL')&&(iyzicoBase==='https://api.iyzipay.com'||iyzicoBase==='https://sandbox-api.iyzipay.com');
  const emailFrom=env('TRANSACTIONAL_EMAIL_FROM');
  const transactionalEmailConfigured=Boolean(env('RESEND_API_KEY'))&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFrom);
  const fcmConfigured=allEnv('FCM_PROJECT_ID','FCM_SERVICE_ACCOUNT_EMAIL','FCM_PRIVATE_KEY');
  const apnsConfigured=allEnv('APNS_TEAM_ID','APNS_KEY_ID','APNS_PRIVATE_KEY','APNS_BUNDLE_ID');

  const softwareIntegrityReady=bool(data.integrity.ready,'integrity_ready');
  const businessReady=bool(data.businessIdentity.ready,'business_ready');
  const catalogReady=bool(data.assets.catalogReady,'catalog_ready');
  const experienceAssetsReady=int(data.assets.contentObjectCount,'content_objects')>0&&int(data.assets.eventObjectCount,'event_objects')>0;
  const legalReady=bool(data.legalContent.ready,'legal_ready');
  const shippingReady=bool(data.shipping.ready,'shipping_ready');
  const producerPaymentsReady=bool(data.producerPayments.ready,'producer_payments_ready');
  const checkoutFlowEnabled=bool(data.paymentControl.atLeastOneCheckoutFlowEnabled,'checkout_flow_enabled');
  const paymentReady=iyzicoConfigured&&checkoutFlowEnabled&&producerPaymentsReady;
  const productionInputsReady=businessReady&&catalogReady&&experienceAssetsReady&&legalReady&&shippingReady&&paymentReady&&transactionalEmailConfigured&&fcmConfigured&&apnsConfigured;
  const automatedReady=softwareIntegrityReady&&productionInputsReady;

  return json(200,{
   ok:true,
   generatedAt:data.generatedAt,
   softwareIntegrityReady,
   productionInputsReady,
   automatedReady,
   database:{integrity:data.integrity,businessIdentity:data.businessIdentity,assets:data.assets,legalContent:data.legalContent,shipping:data.shipping,producerPayments:data.producerPayments,paymentControl:data.paymentControl},
   runtime:{iyzicoConfigured,transactionalEmailConfigured,fcmConfigured,apnsConfigured,paymentReady},
   manualReleaseChecks:[
    {id:'android_signing',label:'Google Play production signing ve mağaza yayını',status:'manual_required'},
    {id:'ios_signing',label:'App Store production signing ve mağaza yayını',status:'manual_required'},
    {id:'social_oauth',label:'Etkinleştirilecek sosyal giriş sağlayıcılarının production console ayarları',status:'manual_required'},
    {id:'public_share_origin',label:'Ürün paylaşımı için gerçek HTTPS public origin',status:'manual_required'}
   ]
  });
 }catch(error){const message=error instanceof Error?error.message:'production_readiness_failed';return json(message.includes('super_admin_required')?403:400,{ok:false,error:message.length<=240?message:'production_readiness_failed'});}
});
