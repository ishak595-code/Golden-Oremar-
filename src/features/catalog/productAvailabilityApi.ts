import{supabase}from'../../lib/supabase';

function reference(value:unknown){const normalized=String(value||'').trim();if(!/^[a-zA-Z0-9][a-zA-Z0-9._~-]{0,199}$/.test(normalized))throw new Error('Ürün bağlantısı doğrulanamadı.');return normalized;}
function record(value:unknown):value is Record<string,any>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}

export async function getProductAvailabilityState(productReference:string){
 const ref=reference(productReference);
 const[{data:detail,error:detailError},{data:sessionData}]=await Promise.all([supabase.rpc('get_public_product_detail_v6',{p_reference:ref}),supabase.auth.getSession()]);
 if(detailError)throw detailError;
 const commerce=record(detail)&&record(detail.commerce)?detail.commerce:null;
 return{commerce,authenticated:Boolean(sessionData.session?.user)};
}

export async function getProductAvailabilitySubscription(productReference:string){
 const ref=reference(productReference);
 const{data,error}=await supabase.rpc('get_product_availability_subscription_v1',{p_reference:ref});
 if(error)throw error;
 return{active:record(data)&&data.active===true,authenticated:record(data)&&data.authenticated!==false};
}

export async function setProductAvailabilitySubscription(productReference:string,active:boolean){
 const ref=reference(productReference);
 const{data,error}=await supabase.rpc('set_product_availability_subscription_v1',{p_reference:ref,p_active:active});
 if(error)throw error;
 if(!record(data)||data.active!==active)throw new Error('Hatırlatma tercihi kaydedilemedi.');
 return{active:data.active===true};
}

export function currentProductReference(){
 if(typeof window==='undefined')return'';
 try{return reference(new URL(window.location.href).searchParams.get('product'));}catch{return'';}
}
