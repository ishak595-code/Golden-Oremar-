import { supabase } from '../lib/supabase';

type MethodHealth={enabled:boolean;ready:boolean};
export type PaymentRuntimeHealth={
  provider:'iyzico';
  runtime:{iyzicoSecretsConfigured:boolean;paymentReturnUrlConfigured:boolean;livePaymentsEnabled:boolean};
  methods:{hostedCheckout:MethodHealth;savedCardPayment:MethodHealth;cardEnrollment:MethodHealth};
};
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function method(value:unknown,label:string):MethodHealth{if(!isRecord(value))throw new Error(`${label} çalışma durumu doğrulanamadı.`);return{enabled:bool(value.enabled,`${label} aktiflik`),ready:bool(value.ready,`${label} hazırlık`) };}
export async function getPaymentRuntimeHealth():Promise<PaymentRuntimeHealth>{
 const{data,error}=await supabase.functions.invoke('payment-runtime-health',{body:{}});if(error)throw error;
 if(!isRecord(data)||data.ok!==true||data.provider!=='iyzico'||!isRecord(data.runtime)||!isRecord(data.methods))throw new Error('Ödeme çalışma zamanı doğrulanamadı.');
 return{provider:'iyzico',runtime:{iyzicoSecretsConfigured:bool(data.runtime.iyzicoSecretsConfigured,'iyzico gizli anahtarları'),paymentReturnUrlConfigured:bool(data.runtime.paymentReturnUrlConfigured,'Ödeme dönüş adresi'),livePaymentsEnabled:bool(data.runtime.livePaymentsEnabled,'Canlı ödeme anahtarı')},methods:{hostedCheckout:method(data.methods.hostedCheckout,'iyzico Checkout Form'),savedCardPayment:method(data.methods.savedCardPayment,'Kayıtlı kartla ödeme'),cardEnrollment:method(data.methods.cardEnrollment,'Kart kaydetme')}};
}
