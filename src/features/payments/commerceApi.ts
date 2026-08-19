import { supabase } from '../../lib/supabase';

export type CheckoutPaymentCapabilities = {
  card: boolean;
  savedCard: boolean;
  payWithIyzico: boolean;
  bankTransfer: boolean;
  googlePay: boolean;
  applePay: boolean;
  carrierBilling: boolean;
  carrierBillingProvider: 'boku' | null;
};

export type BuyerIdentityType = 'tc_identity' | 'passport';
export type OrderPaymentState = 'captured' | 'authorized' | 'processing' | 'failed' | 'terminal';
export type OrderPaymentResult = {
  ok: boolean;
  state: OrderPaymentState;
  intentId: string | null;
  orderId: string;
  orderNumber: string | null;
  reconciliationPending: boolean;
  paymentStatus: string | null;
  orderStatus: string | null;
  error: string | null;
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES=new Set<OrderPaymentState>(['captured','authorized','processing','failed','terminal']);

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,label:string,max:number,required=true){if(value==null||value===''){if(required)throw new Error(`${label} doğrulanamadı.`);return'';}if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const next=value.trim();if(!next||next.length>max||/[\u0000-\u001F\u007F]/.test(next))throw new Error(`${label} doğrulanamadı.`);return next;}
function uuid(value:unknown,label:string){const id=text(value,label,36,true);if(!UUID_RE.test(id))throw new Error(`${label} doğrulanamadı.`);return id;}
function optionalUuid(value:unknown,label:string){if(value==null||value==='')return null;return uuid(value,label);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function normalizeState(value:unknown):OrderPaymentState{const next=text(value,'Ödeme durumu',40,true) as OrderPaymentState;if(!STATES.has(next))throw new Error('Ödeme durumu doğrulanamadı.');return next;}

export async function getCheckoutPaymentCapabilities():Promise<CheckoutPaymentCapabilities>{
  const{data,error}=await supabase.rpc('get_checkout_payment_capabilities_v1');
  if(error)throw error;
  if(!isRecord(data))throw new Error('Checkout ödeme seçenekleri doğrulanamadı.');
  const provider=data.carrierBillingProvider==null?null:text(data.carrierBillingProvider,'Operatör ödeme sağlayıcısı',40,true).toLowerCase();
  if(provider!==null&&provider!=='boku')throw new Error('Operatör ödeme sağlayıcısı doğrulanamadı.');
  return{card:bool(data.card,'Kart ödeme'),savedCard:bool(data.savedCard,'Kayıtlı kart'),payWithIyzico:bool(data.payWithIyzico,'iyzico ile Öde'),bankTransfer:bool(data.bankTransfer,'Banka/EFT'),googlePay:bool(data.googlePay,'Google Pay'),applePay:bool(data.applePay,'Apple Pay'),carrierBilling:bool(data.carrierBilling,'Operatör faturalandırma'),carrierBillingProvider:provider};
}

export async function setPendingOrderPaymentMethod(orderId:string,paymentMethodId:string){
  const order=uuid(orderId,'Sipariş kimliği'),method=uuid(paymentMethodId,'Ödeme yöntemi kimliği');
  const{data,error}=await supabase.rpc('set_my_pending_order_payment_method_v1',{p_order_id:order,p_payment_method_id:method});
  if(error)throw error;
  if(!isRecord(data)||data.ok!==true||uuid(data.orderId,'Sipariş kimliği')!==order||uuid(data.paymentMethodId,'Ödeme yöntemi kimliği')!==method)throw new Error('Bekleyen sipariş ödeme yöntemi sonucu doğrulanamadı.');
  return{ok:true as const,orderId:order,paymentMethodId:method,provider:text(data.provider,'Ödeme sağlayıcısı',40,true).toLowerCase(),paymentStatus:text(data.paymentStatus,'Ödeme durumu',40,true)};
}

function normalizePaymentResult(value:unknown,requestedOrderId:string):OrderPaymentResult{
  if(!isRecord(value))throw new Error('Ödeme sonucu doğrulanamadı.');
  const orderId=uuid(value.orderId,'Sipariş kimliği');
  if(orderId!==requestedOrderId)throw new Error('Ödeme sonucu farklı siparişe ait.');
  const state=normalizeState(value.state);
  const orderNumber=value.orderNumber==null?null:text(value.orderNumber,'Sipariş numarası',160,true);
  const error=value.error==null?null:text(value.error,'Ödeme hata kodu',160,true);
  const paymentStatus=value.paymentStatus==null?null:text(value.paymentStatus,'Sipariş ödeme durumu',60,true);
  const orderStatus=value.orderStatus==null?null:text(value.orderStatus,'Sipariş durumu',60,true);
  if(typeof value.ok!=='boolean')throw new Error('Ödeme başarı durumu doğrulanamadı.');
  return{ok:value.ok,state,intentId:optionalUuid(value.intentId,'Ödeme niyeti kimliği'),orderId,orderNumber,reconciliationPending:value.reconciliationPending===true,paymentStatus,orderStatus,error};
}

export async function payPendingOrder(input:{orderId:string;idempotencyKey:string;buyerIdentityType:BuyerIdentityType;buyerIdentityNumber:string;}):Promise<OrderPaymentResult>{
  const orderId=uuid(input.orderId,'Sipariş kimliği');
  const key=input.idempotencyKey.trim();
  if(!/^[A-Za-z0-9_-]{16,120}$/.test(key))throw new Error('Ödeme güvenlik anahtarı doğrulanamadı.');
  if(input.buyerIdentityType!=='tc_identity'&&input.buyerIdentityType!=='passport')throw new Error('Kimlik türü doğrulanamadı.');
  const identity=input.buyerIdentityNumber.replace(/\s+/g,'').trim().toUpperCase();
  if(identity.length<5||identity.length>40||!/^[A-Z0-9-]+$/.test(identity))throw new Error('Kimlik veya pasaport numarası doğrulanamadı.');
  const{data,error}=await supabase.functions.invoke('commerce-payment',{body:{action:'pay_order',orderId,idempotencyKey:key,buyerIdentityType:input.buyerIdentityType,buyerIdentityNumber:identity}});
  if(error){const detail=isRecord(data)&&typeof data.error==='string'?data.error:String((error as any)?.message||'');throw new Error(detail||'Ödeme sağlayıcısına ulaşılamadı.');}
  return normalizePaymentResult(data,orderId);
}

export function commercePaymentErrorMessage(error:unknown,fallback='Ödeme tamamlanamadı.'){
  const raw=error instanceof Error?error.message:String((error as any)?.message||'');
  const map:Array<[string,string]>=[
    ['payment_provider_not_configured','Canlı ödeme sağlayıcısı henüz Super Admin tarafından etkinleştirilmemiş.'],
    ['payment_provider_credentials_missing','Ödeme sağlayıcısının gizli anahtarları henüz sunucuya tanımlanmamış.'],
    ['producer_payment_account_not_ready','Sepetteki üreticilerden birinin ödeme hesabı henüz tahsilata hazır değil. Sipariş alınmadı.'],
    ['payment_method_required','Ödeme için aktif bir kart seçin.'],['payment_method_not_found','Seçilen kart artık kullanılamıyor. Başka bir kart seçin.'],['payment_method_expired','Seçilen kartın süresi dolmuş.'],
    ['payment_reconciliation_required','Önceki ödeme denemesi hâlâ doğrulanıyor. İkinci kez tahsilat başlatılmadı.'],['payment_reservation_expired','Siparişin stok rezervasyonu sona ermiş. Sepeti yeniden doğrulayın.'],
    ['buyer_identity_type_required','Ödeme için T.C. kimlik veya pasaport türünü seçin.'],['payment_turkish_identity_invalid','T.C. kimlik numarası doğrulanamadı.'],['payment_passport_invalid','Pasaport numarası doğrulanamadı.'],['payment_profile_full_name_required','Ödeme için hesap veya teslimat adında ad ve soyad bulunmalıdır.'],['payment_postal_code_required','Canlı ödeme için teslimat posta kodu gereklidir.'],
    ['order_payment_method_change_not_allowed','Bu siparişin ödeme yöntemi artık değiştirilemez.'],['payment_failed','Ödeme güvenli şekilde doğrulanamadı. Para çekilmiş olma ihtimaline karşı işlem yeniden sorgulanmalıdır.'],
  ];
  for(const[key,message]of map)if(raw.includes(key))return message;
  return raw&&raw.length<=300?raw:fallback;
}
