import{supabase}from'../../lib/supabase';

function unwrap<T>(data:T|null,error:any):T{if(error)throw error;return data as T;}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedEvidenceTypes=new Set(['image/jpeg','image/png','image/webp','video/mp4']);
const returnReasons=new Set(['damaged','wrong_item','quality_issue','missing_item','changed_mind','delivery_issue','other']);
function requiredUuid(value:string,label:string){const id=String(value||'').trim();if(!UUID_RE.test(id))throw new Error(`${label} kimliği geçersiz.`);return id;}
function boundedInt(value:number,fallback:number,min:number,max:number){const parsed=Number(value);return Number.isSafeInteger(parsed)?Math.min(max,Math.max(min,parsed)):fallback;}
function safeStoragePath(value:unknown){const path=String(value||'').trim().replace(/^\/+/, '');if(!path||path.length>600||/[\u0000-\u001f\\]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Kanıt dosyası yolu geçersiz.');return path;}

export async function getOrderReturnOptions(orderId:string){const{data,error}=await supabase.rpc('get_my_order_return_options_v1',{p_order_id:requiredUuid(orderId,'Sipariş')});return unwrap<any>(data,error);}
export async function getMyReturnDetail(returnId:string){const{data,error}=await supabase.rpc('get_my_return_detail_v1',{p_return_id:requiredUuid(returnId,'İade')});return unwrap<any>(data,error);}
export async function requestCustomerReturnV3(input:{orderId:string;items:Array<{orderItemId:string;quantity:number;evidencePaths:string[]}>;reasonCode:string;message:string}){
 const orderId=requiredUuid(input.orderId,'Sipariş');const reason=String(input.reasonCode||'').trim();const message=String(input.message||'').trim();if(!returnReasons.has(reason))throw new Error('İade nedeni geçersiz.');if(message.length<10||message.length>3000)throw new Error('İade açıklaması 10 ile 3000 karakter arasında olmalıdır.');if(!Array.isArray(input.items)||input.items.length<1||input.items.length>50)throw new Error('İade talebinde 1 ile 50 ürün satırı olmalıdır.');
 const seen=new Set<string>();let evidenceTotal=0;const items=input.items.map(item=>{const orderItemId=requiredUuid(item.orderItemId,'Sipariş ürünü');if(seen.has(orderItemId))throw new Error('Aynı sipariş ürünü iade talebine birden fazla kez eklenemez.');seen.add(orderItemId);const quantity=Number(item.quantity);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000)throw new Error('İade adedi geçersiz.');const evidencePaths=Array.isArray(item.evidencePaths)?[...new Set(item.evidencePaths.map(safeStoragePath))]:[];if(evidencePaths.length>5)throw new Error('Bir ürün için en fazla 5 kanıt dosyası eklenebilir.');evidenceTotal+=evidencePaths.length;if(evidenceTotal>15)throw new Error('Bir iade talebinde toplam en fazla 15 kanıt dosyası olabilir.');return{orderItemId,quantity,evidencePaths};});
 const{data,error}=await supabase.rpc('request_customer_return_v3',{p_order_id:orderId,p_items:items,p_reason_code:reason,p_message:message});return unwrap<any>(data,error);
}

export async function uploadReturnEvidence(orderId:string,file:File){
 const id=requiredUuid(orderId,'Sipariş');if(!allowedEvidenceTypes.has(file.type))throw new Error('Kanıt dosyası JPEG, PNG, WebP veya MP4 olmalıdır.');if(file.size<=0||file.size>15*1024*1024)throw new Error('Kanıt dosyası boş olmamalı ve en fazla 15 MB olabilir.');
 const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=userData.user?.id;if(!userId||!UUID_RE.test(userId))throw new Error('Oturum doğrulanamadı.');
 const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'mp4';const path=`${userId}/${id}/${crypto.randomUUID()}.${ext}`;
 const{error}=await supabase.storage.from('return-evidence').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;return path;
}
export async function removeReturnEvidence(paths:string[]){const unique=Array.isArray(paths)?[...new Set(paths.map(safeStoragePath))].slice(0,20):[];if(!unique.length)return;const{error}=await supabase.storage.from('return-evidence').remove(unique);if(error)throw error;}
export async function getReturnEvidenceSignedUrl(path:string,expiresIn=900){const normalized=safeStoragePath(path);const ttl=boundedInt(expiresIn,900,60,3600);const{data,error}=await supabase.storage.from('return-evidence').createSignedUrl(normalized,ttl);if(error)throw error;return data.signedUrl;}
