import{supabase}from'../../lib/supabase';

function unwrap<T>(data:T|null,error:unknown):T{if(error)throw error;return data as T;}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedEvidenceTypes=new Set(['image/jpeg','image/png','image/webp','video/mp4']);
const returnReasons=new Set<ReturnReason>(['damaged','wrong_item','quality_issue','missing_item','changed_mind','delivery_issue','other']);
const orderStatuses=new Set<OrderStatus>(['draft','pending_payment','confirmed','preparing','partially_shipped','shipped','delivered','completed','cancelled','refunded']);
const returnStatuses=new Set<ReturnStatus>(['requested','under_review','approved','rejected','in_transit','received','refunded','closed']);
const returnResolutions=new Set<ReturnResolution>(['refund','replacement','partial_refund','store_credit','none']);
const returnConditions=new Set<ReturnCondition>(['unopened','opened','damaged','spoiled','other']);
const refundStatuses=new Set<RefundStatus>(['pending','processing','succeeded','failed','cancelled']);

type ReturnReason='damaged'|'wrong_item'|'quality_issue'|'missing_item'|'changed_mind'|'delivery_issue'|'other';
type OrderStatus='draft'|'pending_payment'|'confirmed'|'preparing'|'partially_shipped'|'shipped'|'delivered'|'completed'|'cancelled'|'refunded';
type ReturnStatus='requested'|'under_review'|'approved'|'rejected'|'in_transit'|'received'|'refunded'|'closed';
type ReturnResolution='refund'|'replacement'|'partial_refund'|'store_credit'|'none';
type ReturnCondition='unopened'|'opened'|'damaged'|'spoiled'|'other';
type RefundStatus='pending'|'processing'|'succeeded'|'failed'|'cancelled';

export type ReturnOptionItem={
 orderItemId:string;productId:string|null;variantId:string|null;productName:string;variantName:string|null;imagePath:string|null;
 purchasedQuantity:number;returnedQuantity:number;remainingQuantity:number;unitPriceMinor:number;lineTotalMinor:number;currency:string;
};
export type OrderReturnOptions={orderId:string;orderNumber:string;orderStatus:OrderStatus;eligibleStatus:boolean;activeReturnExists:boolean;canRequest:boolean;reasonCodes:ReturnReason[];items:ReturnOptionItem[]};
export type ReturnRequestResult={id:string;returnNumber:string;orderId:string;status:'requested';evidenceCount:number};
export type ReturnDetailItem={id:string;orderItemId:string;productName:string;variantName:string|null;quantity:number;purchasedQuantity:number;condition:ReturnCondition|null;evidencePaths:string[];refundAmountMinor:number|null;currency:string};
export type ReturnRefund={id:string;amountMinor:number;currency:string;status:RefundStatus;reason:string;processedAt:string|null};
export type ReturnDetail={id:string;returnNumber:string;orderId:string;reasonCode:ReturnReason;customerMessage:string;status:ReturnStatus;resolution:ReturnResolution|null;resolutionNote:string|null;reviewReason:string|null;requestedAt:string;reviewedAt:string|null;receivedAt:string|null;closedAt:string|null;items:ReturnDetailItem[];refunds:ReturnRefund[]};

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function requiredUuid(value:unknown,label:string){const id=String(value??'').trim();if(!UUID_RE.test(id))throw new Error(`${label} kimliği geçersiz.`);return id;}
function optionalUuid(value:unknown,label:string){if(value==null||value==='')return null;return requiredUuid(value,label);}
function requiredText(value:unknown,label:string,max:number){const text=typeof value==='string'?value.trim():'';if(!text||text.length>max||/[\u0000-\u001f\u007f]/.test(text))throw new Error(`${label} doğrulanamadı.`);return text;}
function optionalText(value:unknown,label:string,max:number){if(value==null||value==='')return null;if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const text=value.trim();if(!text)return null;if(text.length>max||/[\u0000-\u001f\u007f]/.test(text))throw new Error(`${label} doğrulanamadı.`);return text;}
function safeInt(value:unknown,label:string,min=0,max=Number.MAX_SAFE_INTEGER){const parsed=typeof value==='number'?value:Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${label} doğrulanamadı.`);return parsed;}
function booleanValue(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function currencyCode(value:unknown,label:string){const code=requiredText(value,label,3).toUpperCase();if(!/^[A-Z]{3}$/.test(code))throw new Error(`${label} doğrulanamadı.`);return code;}
function dateTime(value:unknown,label:string,required=true){if(value==null||value===''){if(required)throw new Error(`${label} doğrulanamadı.`);return null;}if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const date=new Date(value);if(Number.isNaN(date.getTime()))throw new Error(`${label} doğrulanamadı.`);return date.toISOString();}
function enumValue<T extends string>(value:unknown,label:string,allowed:Set<T>){if(typeof value!=='string'||!allowed.has(value as T))throw new Error(`${label} doğrulanamadı.`);return value as T;}
function boundedInt(value:number,fallback:number,min:number,max:number){const parsed=Number(value);return Number.isSafeInteger(parsed)?Math.min(max,Math.max(min,parsed)):fallback;}
function safeStoragePath(value:unknown){const path=String(value??'').trim().replace(/^\/+/, '');if(!path||path.length>600||/[\u0000-\u001f\\]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Kanıt dosyası yolu geçersiz.');return path;}

function normalizeReturnOptionItem(value:unknown,index:number):ReturnOptionItem{
 if(!isRecord(value))throw new Error(`${index+1}. iade seçeneği doğrulanamadı.`);
 const purchased=safeInt(value.purchasedQuantity,`${index+1}. satın alınan adet`,1,999);
 const returned=safeInt(value.returnedQuantity,`${index+1}. daha önce iade edilen adet`,0,purchased);
 const remaining=safeInt(value.remainingQuantity,`${index+1}. kalan iade adedi`,0,purchased);
 if(remaining!==purchased-returned)throw new Error(`${index+1}. iade adet özeti tutarsız.`);
 return{orderItemId:requiredUuid(value.orderItemId,`${index+1}. sipariş ürünü`),productId:optionalUuid(value.productId,`${index+1}. ürün`),variantId:optionalUuid(value.variantId,`${index+1}. varyant`),productName:requiredText(value.productName,`${index+1}. ürün adı`,300),variantName:optionalText(value.variantName,`${index+1}. varyant adı`,240),imagePath:optionalText(value.imagePath,`${index+1}. ürün görseli`,2048),purchasedQuantity:purchased,returnedQuantity:returned,remainingQuantity:remaining,unitPriceMinor:safeInt(value.unitPriceMinor,`${index+1}. birim fiyat`),lineTotalMinor:safeInt(value.lineTotalMinor,`${index+1}. satır toplamı`),currency:currencyCode(value.currency,`${index+1}. para birimi`)};
}
function normalizeReturnOptions(value:unknown,expectedOrderId:string):OrderReturnOptions{
 if(!isRecord(value)||!Array.isArray(value.items)||!Array.isArray(value.reasonCodes))throw new Error('İade seçenekleri sunucudan doğrulanamadı.');
 const orderId=requiredUuid(value.orderId,'Sipariş');if(orderId!==expectedOrderId)throw new Error('İade seçenekleri başka siparişe ait.');
 const orderStatus=enumValue(value.orderStatus,'Sipariş durumu',orderStatuses);const eligible=booleanValue(value.eligibleStatus,'İade statü uygunluğu'),active=booleanValue(value.activeReturnExists,'Aktif iade durumu'),canRequest=booleanValue(value.canRequest,'İade talep yetkisi');
 const expectedEligible=orderStatus==='delivered'||orderStatus==='completed';if(eligible!==expectedEligible)throw new Error('İade statü uygunluğu sipariş durumuyla tutarsız.');
 const reasonCodes=value.reasonCodes.map((reason,index)=>enumValue(reason,`${index+1}. iade nedeni`,returnReasons));if(new Set(reasonCodes).size!==returnReasons.size||reasonCodes.length!==returnReasons.size)throw new Error('İade nedenleri sunucu sözleşmesiyle eşleşmiyor.');
 const items=value.items.map(normalizeReturnOptionItem);const hasRemaining=items.some(item=>item.remainingQuantity>0);if(canRequest!==(eligible&&!active&&hasRemaining))throw new Error('İade talep yetkisi sunucu verileriyle tutarsız.');
 return{orderId,orderNumber:requiredText(value.orderNumber,'Sipariş numarası',160),orderStatus,eligibleStatus:eligible,activeReturnExists:active,canRequest,reasonCodes,items};
}
function normalizeReturnRequestResult(value:unknown,orderId:string,evidenceCount:number):ReturnRequestResult{
 if(!isRecord(value))throw new Error('İade talep sonucu doğrulanamadı.');const returnedOrderId=requiredUuid(value.orderId,'İade siparişi');if(returnedOrderId!==orderId)throw new Error('İade talep sonucu başka siparişe ait.');const returnedEvidence=safeInt(value.evidenceCount,'İade kanıt sayısı',0,15);if(returnedEvidence!==evidenceCount)throw new Error('İade kanıt sayısı gönderilen dosyalarla eşleşmiyor.');if(value.status!=='requested')throw new Error('İade talebi beklenen başlangıç durumunda değil.');return{id:requiredUuid(value.id,'İade talebi'),returnNumber:requiredText(value.returnNumber,'İade numarası',80),orderId:returnedOrderId,status:'requested',evidenceCount:returnedEvidence};
}
function normalizeReturnDetail(value:unknown,expectedReturnId:string):ReturnDetail{
 if(!isRecord(value)||!Array.isArray(value.items)||!Array.isArray(value.refunds))throw new Error('İade detayı sunucudan doğrulanamadı.');const id=requiredUuid(value.id,'İade talebi');if(id!==expectedReturnId)throw new Error('İade detayı başka kayda ait.');
 const items=value.items.map((item,index):ReturnDetailItem=>{if(!isRecord(item)||!Array.isArray(item.evidencePaths))throw new Error(`${index+1}. iade ürünü doğrulanamadı.`);const quantity=safeInt(item.quantity,`${index+1}. iade adedi`,1,999),purchased=safeInt(item.purchasedQuantity,`${index+1}. satın alınan adet`,1,999);if(quantity>purchased)throw new Error(`${index+1}. iade adedi satın alınan adedi aşıyor.`);const evidencePaths=item.evidencePaths.map(safeStoragePath);if(evidencePaths.length>5||new Set(evidencePaths).size!==evidencePaths.length)throw new Error(`${index+1}. iade kanıt listesi doğrulanamadı.`);return{id:requiredUuid(item.id,`${index+1}. iade ürünü`),orderItemId:requiredUuid(item.orderItemId,`${index+1}. sipariş ürünü`),productName:requiredText(item.productName,`${index+1}. ürün adı`,300),variantName:optionalText(item.variantName,`${index+1}. varyant adı`,240),quantity,purchasedQuantity:purchased,condition:item.condition==null?null:enumValue(item.condition,`${index+1}. ürün durumu`,returnConditions),evidencePaths,refundAmountMinor:item.refundAmountMinor==null?null:safeInt(item.refundAmountMinor,`${index+1}. ürün geri ödeme tutarı`),currency:currencyCode(item.currency,`${index+1}. para birimi`)};});
 const refunds=value.refunds.map((refund,index):ReturnRefund=>{if(!isRecord(refund))throw new Error(`${index+1}. geri ödeme kaydı doğrulanamadı.`);return{id:requiredUuid(refund.id,`${index+1}. geri ödeme`),amountMinor:safeInt(refund.amountMinor,`${index+1}. geri ödeme tutarı`,1),currency:currencyCode(refund.currency,`${index+1}. geri ödeme para birimi`),status:enumValue(refund.status,`${index+1}. geri ödeme durumu`,refundStatuses),reason:requiredText(refund.reason,`${index+1}. geri ödeme nedeni`,3000),processedAt:dateTime(refund.processedAt,`${index+1}. geri ödeme tarihi`,false)};});
 return{id,returnNumber:requiredText(value.returnNumber,'İade numarası',80),orderId:requiredUuid(value.orderId,'Sipariş'),reasonCode:enumValue(value.reasonCode,'İade nedeni',returnReasons),customerMessage:requiredText(value.customerMessage,'Müşteri iade açıklaması',3000),status:enumValue(value.status,'İade durumu',returnStatuses),resolution:value.resolution==null?null:enumValue(value.resolution,'İade çözümü',returnResolutions),resolutionNote:optionalText(value.resolutionNote,'İade çözüm notu',3000),reviewReason:optionalText(value.reviewReason,'İade inceleme notu',3000),requestedAt:dateTime(value.requestedAt,'İade talep tarihi') as string,reviewedAt:dateTime(value.reviewedAt,'İade inceleme tarihi',false),receivedAt:dateTime(value.receivedAt,'İade teslim tarihi',false),closedAt:dateTime(value.closedAt,'İade kapanış tarihi',false),items,refunds};
}

export async function getOrderReturnOptions(orderId:string):Promise<OrderReturnOptions>{const id=requiredUuid(orderId,'Sipariş');const{data,error}=await supabase.rpc('get_my_order_return_options_v1',{p_order_id:id});return normalizeReturnOptions(unwrap<unknown>(data,error),id);}
export async function getMyReturnDetail(returnId:string):Promise<ReturnDetail>{const id=requiredUuid(returnId,'İade');const{data,error}=await supabase.rpc('get_my_return_detail_v1',{p_return_id:id});return normalizeReturnDetail(unwrap<unknown>(data,error),id);}
export async function requestCustomerReturnV3(input:{orderId:string;items:Array<{orderItemId:string;quantity:number;evidencePaths:string[]}>;reasonCode:string;message:string}):Promise<ReturnRequestResult>{
 const orderId=requiredUuid(input.orderId,'Sipariş');const reason=String(input.reasonCode||'').trim();const message=String(input.message||'').trim();if(!returnReasons.has(reason as ReturnReason))throw new Error('İade nedeni geçersiz.');if(message.length<10||message.length>3000)throw new Error('İade açıklaması 10 ile 3000 karakter arasında olmalıdır.');if(!Array.isArray(input.items)||input.items.length<1||input.items.length>50)throw new Error('İade talebinde 1 ile 50 ürün satırı olmalıdır.');
 const seen=new Set<string>();let evidenceTotal=0;const items=input.items.map(item=>{const orderItemId=requiredUuid(item.orderItemId,'Sipariş ürünü');if(seen.has(orderItemId))throw new Error('Aynı sipariş ürünü iade talebine birden fazla kez eklenemez.');seen.add(orderItemId);const quantity=Number(item.quantity);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>999)throw new Error('İade adedi 1 ile 999 arasında tam sayı olmalıdır.');const evidencePaths=Array.isArray(item.evidencePaths)?[...new Set(item.evidencePaths.map(safeStoragePath))]:[];if(evidencePaths.length>5)throw new Error('Bir ürün için en fazla 5 kanıt dosyası eklenebilir.');evidenceTotal+=evidencePaths.length;if(evidenceTotal>15)throw new Error('Bir iade talebinde toplam en fazla 15 kanıt dosyası olabilir.');return{orderItemId,quantity,evidencePaths};});
 const{data,error}=await supabase.rpc('request_customer_return_v3',{p_order_id:orderId,p_items:items,p_reason_code:reason,p_message:message});return normalizeReturnRequestResult(unwrap<unknown>(data,error),orderId,evidenceTotal);
}

export async function uploadReturnEvidence(orderId:string,file:File){
 const id=requiredUuid(orderId,'Sipariş');if(!allowedEvidenceTypes.has(file.type))throw new Error('Kanıt dosyası JPEG, PNG, WebP veya MP4 olmalıdır.');if(file.size<=0||file.size>15*1024*1024)throw new Error('Kanıt dosyası boş olmamalı ve en fazla 15 MB olabilir.');
 const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=userData.user?.id;if(!userId||!UUID_RE.test(userId))throw new Error('Oturum doğrulanamadı.');if(typeof globalThis.crypto?.randomUUID!=='function')throw new Error('Güvenli kanıt dosyası kimliği üretilemedi.');
 const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'mp4';const path=`${userId}/${id}/${globalThis.crypto.randomUUID()}.${ext}`;
 const{error}=await supabase.storage.from('return-evidence').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;return path;
}
export async function removeReturnEvidence(paths:string[]){const unique=Array.isArray(paths)?[...new Set(paths.map(safeStoragePath))].slice(0,20):[];if(!unique.length)return;const{error}=await supabase.storage.from('return-evidence').remove(unique);if(error)throw error;}
export async function getReturnEvidenceSignedUrl(path:string,expiresIn=900){const normalized=safeStoragePath(path);const ttl=boundedInt(expiresIn,900,60,3600);const{data,error}=await supabase.storage.from('return-evidence').createSignedUrl(normalized,ttl);if(error)throw error;const signedUrl=typeof data?.signedUrl==='string'?data.signedUrl.trim():'';if(!signedUrl)throw new Error('Kanıt dosyası bağlantısı oluşturulamadı.');let parsed:URL;try{parsed=new URL(signedUrl);}catch{throw new Error('Kanıt dosyası bağlantısı doğrulanamadı.');}if(parsed.protocol!=='https:')throw new Error('Kanıt dosyası bağlantısı güvenli değil.');return parsed.toString();}
