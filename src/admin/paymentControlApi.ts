import { supabase } from '../lib/supabase';

export type PaymentControl={
  mode:'provider';
  provider:'iyzico';
  checkoutFormEnabled:boolean;
  liveCardPaymentsEnabled:boolean;
  cardEnrollmentEnabled:boolean;
  requiresProviderConfiguration:boolean;
};

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function normalize(value:unknown):PaymentControl{
  if(!isRecord(value))throw new Error('Ödeme altyapısı ayarları doğrulanamadı.');
  if(value.mode!=='provider'||value.provider!=='iyzico')throw new Error('Golden Oremar ödeme sağlayıcısı yalnız iyzico olabilir.');
  const checkoutFormEnabled=bool(value.checkout_form_enabled,'iyzico tek seferlik ödeme');
  const liveCardPaymentsEnabled=bool(value.live_card_payments_enabled,'Kayıtlı kart tahsilatı');
  const cardEnrollmentEnabled=bool(value.card_enrollment_enabled,'Kart kaydetme');
  if(cardEnrollmentEnabled&&!liveCardPaymentsEnabled)throw new Error('Kart kaydetme, kayıtlı kartla ödeme kapalıyken açılamaz.');
  return{mode:'provider',provider:'iyzico',checkoutFormEnabled,liveCardPaymentsEnabled,cardEnrollmentEnabled,requiresProviderConfiguration:bool(value.requires_provider_configuration,'Sağlayıcı yapılandırma durumu')};
}
function toRpc(control:PaymentControl){return{mode:'provider',provider:'iyzico',checkout_form_enabled:control.checkoutFormEnabled,live_card_payments_enabled:control.liveCardPaymentsEnabled,card_enrollment_enabled:control.cardEnrollmentEnabled,requires_provider_configuration:control.requiresProviderConfiguration};}
export async function getPaymentControl(){const{data,error}=await supabase.rpc('super_admin_get_payment_control_v1');if(error)throw error;return normalize(data);}
export async function updatePaymentControl(control:PaymentControl){const{data,error}=await supabase.rpc('super_admin_update_payment_control_v1',{p_config:toRpc(control)});if(error)throw error;return normalize(data);}
export function paymentControlErrorMessage(error:unknown,fallback='Ödeme altyapısı ayarı kaydedilemedi.'){
  const message=error instanceof Error?error.message:String((error as{message?:unknown})?.message||'');
  const map:Array<[string,string]>=[
    ['super_admin_required','Ödeme altyapısını yalnız Super Admin yönetebilir.'],
    ['card_enrollment_requires_saved_card_payments','Kart kaydetmeyi açmak için kayıtlı kartla ödemeyi de açın.'],
    ['payment_provider_credentials_missing','iyzico API anahtarları henüz Supabase secrets alanına tanımlanmamış.'],
  ];
  for(const[key,text]of map)if(message.includes(key))return text;
  return message&&message.length<=300?message:fallback;
}
