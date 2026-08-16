import{supabase}from'../../lib/supabase';

function unwrap<T>(data:T|null,error:any):T{if(error)throw error;return data as T;}

export async function getOrderReturnOptions(orderId:string){const{data,error}=await supabase.rpc('get_my_order_return_options_v1',{p_order_id:orderId});return unwrap<any>(data,error);}
export async function getMyReturnDetail(returnId:string){const{data,error}=await supabase.rpc('get_my_return_detail_v1',{p_return_id:returnId});return unwrap<any>(data,error);}
export async function requestCustomerReturnV3(input:{orderId:string;items:Array<{orderItemId:string;quantity:number;evidencePaths:string[]}>;reasonCode:string;message:string}){const{data,error}=await supabase.rpc('request_customer_return_v3',{p_order_id:input.orderId,p_items:input.items,p_reason_code:input.reasonCode,p_message:input.message});return unwrap<any>(data,error);}

export async function uploadReturnEvidence(orderId:string,file:File){
 const allowed=['image/jpeg','image/png','image/webp','video/mp4'];if(!allowed.includes(file.type))throw new Error('Kanıt dosyası JPEG, PNG, WebP veya MP4 olmalıdır.');if(file.size<=0||file.size>15*1024*1024)throw new Error('Kanıt dosyası en fazla 15 MB olabilir.');
 const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=userData.user?.id;if(!userId)throw new Error('Oturum doğrulanamadı.');
 const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'mp4';const safeOrder=orderId.replace(/[^0-9a-f-]/gi,'');const path=`${userId}/${safeOrder}/${crypto.randomUUID()}.${ext}`;
 const{error}=await supabase.storage.from('return-evidence').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;return path;
}
export async function removeReturnEvidence(paths:string[]){if(!paths.length)return;const{error}=await supabase.storage.from('return-evidence').remove(paths);if(error)throw error;}
export async function getReturnEvidenceSignedUrl(path:string,expiresIn=900){const{data,error}=await supabase.storage.from('return-evidence').createSignedUrl(path,expiresIn);if(error)throw error;return data.signedUrl;}
