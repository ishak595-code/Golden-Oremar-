import{supabase}from'../../lib/supabase';

/**
 * Whether the signed-in customer follows one store, for the product page's
 * "Mağazayı takip et" button. Same RPC as the catalogue follow metrics
 * (get_public_producer_follow_metrics_v1); kept in its own module so it ships
 * with the product page chunk instead of the startup bundle.
 */
export async function isFollowingStore(producerId:string):Promise<boolean|null>{
 const id=typeof producerId==='string'?producerId.trim().slice(0,160):'';
 if(!id)return null;
 const{data,error}=await supabase.rpc('get_public_producer_follow_metrics_v1',{p_producer_ids:[id]});
 if(error)throw error;
 const row=Array.isArray(data)?data.find((entry:any)=>entry&&typeof entry==='object'&&entry.producerId===id):null;
 return row&&typeof row.following==='boolean'?row.following:null;
}
