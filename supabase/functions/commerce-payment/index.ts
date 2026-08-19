import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function text(value:unknown,max:number){if(typeof value!=="string")return"";const next=value.trim();if(!next||next.length>max||/[\u0000-\u001F\u007F]/.test(next))return"";return next;}
function uuid(value:unknown){const next=text(value,80);return UUID_RE.test(next)?next:"";}
function safeInteger(value:unknown,min=0){return typeof value==="number"&&Number.isSafeInteger(value)&&value>=min?value:null;}
function major(minor:number){if(!Number.isSafeInteger(minor)||minor<0)throw new Error("invalid_money");return(minor/100).toFixed(2);}
function safeBaseUrl(raw:string){const value=raw.replace(/\/$/,"");if(value!=="https://api.iyzipay.com"&&value!=="https://sandbox-api.iyzipay.com")throw new Error("invalid_iyzico_base_url");return value;}
function safeIp(req:Request){const candidates=[req.headers.get("cf-connecting-ip"),req.headers.get("x-real-ip"),req.headers.get("x-forwarded-for")?.split(",")[0]];for(const value of candidates){const next=(value||"").trim();if(next&&next.length<=64&&/^[0-9a-fA-F:.]+$/.test(next))return next;}throw new Error("request_ip_missing");}
function splitName(displayName:string){const parts=displayName.trim().split(/\s+/).filter(Boolean);if(parts.length===0)return{name:"Golden",surname:"Oremar"};if(parts.length===1)return{name:parts[0],surname:parts[0]};return{name:parts.slice(0,-1).join(" "),surname:parts.at(-1)||parts[0]};}
function addressText(address:Record<string,unknown>){return[text(address.address_line1||address.address_line,1000),text(address.address_line2,500),text(address.locality,160)].filter(Boolean).join(" ").slice(0,1000);}
function addressCity(address:Record<string,unknown>){return text(address.city||address.district||address.administrative_area||address.province,160);}
function addressCountry(address:Record<string,unknown>){return text(address.country_code||address.countryCode,2).toUpperCase();}

async function hmacHex(secret:string,value:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const signature=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));return Array.from(signature).map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function timingSafeEqualHex(a:string,b:string){const left=a.toLowerCase(),right=b.toLowerCase();if(left.length!==right.length||left.length===0)return false;let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;}

class ProviderRejectedError extends Error{data:Record<string,unknown>;constructor(data:Record<string,unknown>){super(text(data.errorCode,120)||"provider_request_failed");this.data=data;}}
class ProviderUncertainError extends Error{}

async function iyzicoRequest(path:"/payment/auth"|"/payment/detail",payload:Record<string,unknown>){
  const apiKey=Deno.env.get("IYZICO_API_KEY")?.trim()||"";
  const secretKey=Deno.env.get("IYZICO_SECRET_KEY")?.trim()||"";
  const baseUrlRaw=Deno.env.get("IYZICO_BASE_URL")?.trim()||"";
  if(!apiKey||!secretKey||!baseUrlRaw)throw new Error("payment_provider_credentials_missing");
  const baseUrl=safeBaseUrl(baseUrlRaw);const body=JSON.stringify(payload);const randomKey=`${Date.now()}${crypto.randomUUID().replaceAll("-","")}`;
  const signature=await hmacHex(secretKey,randomKey+path+body);const authorizationString=`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  let response:Response;
  try{response=await fetch(`${baseUrl}${path}`,{method:"POST",headers:{Authorization:`IYZWSv2 ${btoa(authorizationString)}`,"x-iyzi-rnd":randomKey,"Content-Type":"application/json",Accept:"application/json"},body,signal:AbortSignal.timeout(15000)});}catch{throw new ProviderUncertainError("payment_provider_transport_uncertain");}
  let data:Record<string,unknown>={};try{const parsed=await response.json();if(isRecord(parsed))data=parsed;}catch{throw new ProviderUncertainError("payment_provider_invalid_response");}
  if(!response.ok||data.status!=="success")throw new ProviderRejectedError(data);
  return{data,secretKey};
}

async function verifyPaymentResponse(data:Record<string,unknown>,secretKey:string){
  const signature=text(data.signature,256);if(!signature)return false;
  const fields=[data.paymentId,data.currency,data.basketId,data.conversationId,data.paidPrice,data.price].map(value=>String(value??""));
  if(fields.some(value=>!value))return false;
  return timingSafeEqualHex(await hmacHex(secretKey,fields.join(":")),signature);
}

function safeProviderResult(data:Record<string,unknown>,signatureVerified:boolean){
  const allowed=["status","locale","systemTime","conversationId","paymentId","price","paidPrice","installment","fraudStatus","merchantCommissionRate","merchantCommissionRateAmount","iyziCommissionRateAmount","iyziCommissionFee","cardType","cardAssociation","cardFamily","lastFourDigits","basketId","currency","authCode","phase","hostReference","paymentStatus"];
  const result:Record<string,unknown>={signatureVerified};for(const key of allowed)if(data[key]!=null)result[key]=data[key];
  if(Array.isArray(data.itemTransactions))result.itemTransactions=data.itemTransactions.slice(0,100).map(item=>isRecord(item)?{itemId:item.itemId,paymentTransactionId:item.paymentTransactionId,transactionStatus:item.transactionStatus,price:item.price,paidPrice:item.paidPrice}:{});
  return result;
}

function classifyPayment(data:Record<string,unknown>):"captured"|"authorized"|"failed"{
  const fraud=Number(data.fraudStatus);if(fraud===1)return"captured";if(fraud===0)return"authorized";return"failed";
}

function buildBasket(context:Record<string,unknown>){
  const amount=safeInteger(context.amountMinor);const shipping=safeInteger(context.shippingMinor)||0;if(amount==null||amount<=0||shipping<0||shipping>amount)throw new Error("invalid_payment_amount");
  if(!Array.isArray(context.items)||context.items.length===0||context.items.length>100)throw new Error("invalid_payment_items");
  const targetMerchandise=amount-shipping;
  const rows=context.items.map((raw,index)=>{if(!isRecord(raw))throw new Error("invalid_payment_item");const id=uuid(raw.id);const name=text(raw.name,300);const line=safeInteger(raw.lineTotalMinor);if(!id||!name||line==null)throw new Error("invalid_payment_item");return{id,name,minor:line,index};});
  const sourceTotal=rows.reduce((sum,row)=>sum+row.minor,0);if(!Number.isSafeInteger(sourceTotal)||sourceTotal<=0)throw new Error("invalid_payment_items_total");
  let difference=sourceTotal-targetMerchandise;
  if(difference>0){for(const row of rows){if(difference<=0)break;const reduction=Math.min(row.minor,difference);row.minor-=reduction;difference-=reduction;}}
  else if(difference<0){rows[0].minor+=Math.abs(difference);difference=0;}
  if(difference!==0)throw new Error("payment_basket_allocation_failed");
  const basket=rows.filter(row=>row.minor>0).map(row=>({id:row.id,name:row.name,category1:"Köy Ürünleri",itemType:"PHYSICAL",price:major(row.minor)}));
  if(shipping>0)basket.push({id:`shipping-${uuid(context.orderId)}`,name:"Teslimat ve kargo",category1:"Teslimat",itemType:"PHYSICAL",price:major(shipping)});
  const verification=basket.reduce((sum,row)=>sum+Math.round(Number(row.price)*100),0);if(verification!==amount)throw new Error("payment_basket_total_mismatch");return basket;
}

async function complete(service:any,intentId:string,providerReference:string,status:"captured"|"authorized"|"failed"|"cancelled",providerPayload:Record<string,unknown>,failureCode?:string|null,failureMessage?:string|null){
  const{data,error}=await service.rpc("complete_order_payment_for_service_v1",{p_intent_id:intentId,p_provider_reference:providerReference,p_status:status,p_provider_payload:providerPayload,p_failure_code:failureCode||null,p_failure_message:failureMessage||null});if(error)throw error;return data;
}

async function reconcile(service:any,context:Record<string,unknown>){
  const intentId=uuid(context.intentId);if(!intentId)throw new Error("payment_intent_invalid");
  try{
    const{data,secretKey}=await iyzicoRequest("/payment/detail",{locale:"tr",conversationId:crypto.randomUUID(),paymentConversationId:intentId});
    const verified=await verifyPaymentResponse(data,secretKey);if(!verified)throw new Error("payment_provider_signature_invalid");
    const paymentId=text(data.paymentId,220);if(!paymentId)throw new Error("payment_provider_reference_missing");
    const state=classifyPayment(data);const result=await complete(service,intentId,paymentId,state,safeProviderResult(data,true),state==="failed"?"fraud_rejected":null,state==="failed"?"Ödeme sağlayıcısı işlemi reddetti.":null);
    return{ok:state!=="failed",state,intentId,orderId:context.orderId,result};
  }catch(error){
    if(error instanceof ProviderRejectedError||error instanceof ProviderUncertainError)return{ok:true,state:"processing",intentId,orderId:context.orderId,reconciliationPending:true};
    throw error;
  }
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"});
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"",serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",authorization=req.headers.get("Authorization")||"";
    if(!supabaseUrl||!anonKey||!serviceRoleKey||!authorization)return json(401,{ok:false,error:"authentication_required"});
    const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});const{data:userData,error:userError}=await userClient.auth.getUser();const user=userData.user;if(userError||!user?.id)return json(401,{ok:false,error:"authentication_required"});
    const service=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const raw=await req.json().catch(()=>null);if(!isRecord(raw))return json(400,{ok:false,error:"invalid_request"});
    const action=text(raw.action,30);if(action!=="pay_order")return json(400,{ok:false,error:"unsupported_action"});
    const orderId=uuid(raw.orderId),idempotencyKey=text(raw.idempotencyKey,120),identityNumber=text(raw.buyerIdentityNumber,50);
    if(!orderId)return json(400,{ok:false,error:"order_id_required"});if(!/^[A-Za-z0-9_-]{16,120}$/.test(idempotencyKey))return json(400,{ok:false,error:"invalid_payment_idempotency_key"});if(identityNumber.length<5)return json(400,{ok:false,error:"buyer_identity_required"});
    const{data:prepared,error:prepareError}=await service.rpc("prepare_order_payment_for_service_v1",{p_user_id:user.id,p_order_id:orderId,p_idempotency_key:idempotencyKey});if(prepareError)throw prepareError;if(!isRecord(prepared))throw new Error("payment_context_invalid");
    const intentId=uuid(prepared.intentId);if(prepared.action==="terminal")return json(200,{ok:prepared.status==="captured",state:prepared.status||prepared.intentStatus||"terminal",intentId:intentId||null,orderId:prepared.orderId,orderNumber:prepared.orderNumber,paymentStatus:prepared.paymentStatus,orderStatus:prepared.orderStatus});
    if(prepared.action==="reconcile")return json(200,await reconcile(service,prepared));if(prepared.action!=="charge"||!intentId)throw new Error("payment_action_invalid");
    if(text(prepared.provider,40)!=="iyzico")throw new Error("unsupported_payment_provider");
    const buyer=isRecord(prepared.buyer)?prepared.buyer:{},shipping=isRecord(prepared.shippingAddress)?prepared.shippingAddress:{};const displayName=text(buyer.displayName,240);const names=splitName(displayName);const email=text(buyer.email,254),phone=text(buyer.phone,40),city=addressCity(shipping),country=addressCountry(shipping),address=addressText(shipping),zip=text(shipping.postal_code||shipping.postalCode,30),providerCustomerRef=text(prepared.providerCustomerRef,255),providerPaymentMethodRef=text(prepared.providerPaymentMethodRef,255),orderNumber=text(prepared.orderNumber,160),currency=text(prepared.currency,3).toUpperCase(),amount=safeInteger(prepared.amountMinor);
    if(!email||!phone||!city||!country||!address||!providerCustomerRef||!providerPaymentMethodRef||!orderNumber||!currency||amount==null)throw new Error("payment_context_incomplete");
    const basket=buildBasket(prepared);const paymentPayload={locale:"tr",conversationId:intentId,price:major(amount),paidPrice:major(amount),currency,installment:1,basketId:orderNumber,paymentChannel:"WEB",paymentGroup:"PRODUCT",paymentCard:{cardUserKey:providerCustomerRef,cardToken:providerPaymentMethodRef},buyer:{id:user.id,name:names.name,surname:names.surname,gsmNumber:phone,email,identityNumber,registrationAddress:address,ip:safeIp(req),city,country,zipCode:zip||"00000"},shippingAddress:{contactName:displayName||`${names.name} ${names.surname}`,city,country,address,zipCode:zip||"00000"},billingAddress:{contactName:displayName||`${names.name} ${names.surname}`,city,country,address,zipCode:zip||"00000"},basketItems:basket};
    try{
      const{data,secretKey}=await iyzicoRequest("/payment/auth",paymentPayload);const verified=await verifyPaymentResponse(data,secretKey);if(!verified)throw new Error("payment_provider_signature_invalid");if(text(data.conversationId,80)!==intentId)throw new Error("payment_conversation_mismatch");if(text(data.basketId,160)!==orderNumber)throw new Error("payment_basket_mismatch");if(text(data.currency,3).toUpperCase()!==currency)throw new Error("payment_currency_mismatch");if(Math.round(Number(data.paidPrice)*100)!==amount)throw new Error("payment_amount_mismatch");
      const providerReference=text(data.paymentId,220);if(!providerReference)throw new Error("payment_provider_reference_missing");const state=classifyPayment(data);const result=await complete(service,intentId,providerReference,state,safeProviderResult(data,true),state==="failed"?"fraud_rejected":null,state==="failed"?"Ödeme sağlayıcısı işlemi reddetti.":null);return json(state==="failed"?402:200,{ok:state!=="failed",state,intentId,orderId,orderNumber,result});
    }catch(error){
      if(error instanceof ProviderRejectedError){const failureCode=text(error.data.errorCode,120)||"provider_rejected",failureMessage=text(error.data.errorMessage,500)||"Ödeme sağlayıcısı işlemi kabul etmedi.";const providerReference=`failure:${intentId}:${failureCode}`.slice(0,220);await complete(service,intentId,providerReference,"failed",{status:"failure",errorCode:failureCode,errorGroup:text(error.data.errorGroup,120)},failureCode,failureMessage);return json(402,{ok:false,state:"failed",intentId,orderId,error:failureCode,message:failureMessage});}
      if(error instanceof ProviderUncertainError)return json(202,{ok:true,state:"processing",intentId,orderId,reconciliationPending:true});throw error;
    }
  }catch(error){const message=error instanceof Error?error.message:"commerce_payment_failed";const safe=message.length<=300&&!/[\u0000-\u001F\u007F]/.test(message)?message:"commerce_payment_failed";const status=safe.includes("credentials_missing")||safe.includes("provider_not_configured")?503:safe.includes("authentication_required")?401:400;return json(status,{ok:false,error:safe});}
});
