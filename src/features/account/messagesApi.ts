import{ supabase }from'../../lib/supabase';

function unwrap<T>(data:T|null,error:any):T{if(error)throw error;return data as T;}

export async function listMyConversations(limit=50,offset=0){const{data,error}=await supabase.rpc('list_my_conversations_v1',{p_limit:limit,p_offset:offset});return unwrap<any[]>(data,error)||[];}
export async function getConversationMessages(conversationId:string,limit=100,before?:string|null){const{data,error}=await supabase.rpc('get_conversation_messages_v1',{p_conversation_id:conversationId,p_limit:limit,p_before:before||null});return unwrap<any[]>(data,error)||[];}
export async function markConversationRead(conversationId:string){const{data,error}=await supabase.rpc('mark_conversation_read_v1',{p_conversation_id:conversationId});return unwrap<string>(data,error);}
export async function setConversationOpenState(conversationId:string,open:boolean){const{data,error}=await supabase.rpc('set_conversation_open_state_v1',{p_conversation_id:conversationId,p_open:open});return unwrap<any>(data,error);}
export async function sendConversationMessage(input:{conversationId:string;body:string;attachmentPaths?:string[];messageType?:'text'|'image'|'file'}){const{data,error}=await supabase.rpc('send_conversation_message_v1',{p_conversation_id:input.conversationId,p_body:input.body.trim(),p_attachment_paths:input.attachmentPaths||[],p_message_type:input.messageType||'text'});return unwrap<any>(data,error);}

const allowedMime=new Set(['image/jpeg','image/png','image/webp','image/avif','application/pdf']);
const maxBytes=20*1024*1024;
export async function uploadMessageAttachment(conversationId:string,file:File){
 if(!allowedMime.has(file.type))throw new Error('Ek dosya JPEG, PNG, WebP, AVIF veya PDF olmalıdır.');
 if(file.size<=0||file.size>maxBytes)throw new Error('Her ek dosya en fazla 20 MB olabilir.');
 const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=userData.user?.id;if(!userId)throw new Error('Oturum doğrulanamadı.');
 const original=safeFilename(file.name);const path=`${userId}/${conversationId}/${crypto.randomUUID()}_${original}`;
 const{error}=await supabase.storage.from('message-attachments').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;return path;
}
export async function removeUnusedMessageAttachments(paths:string[]){if(!paths.length)return;const{error}=await supabase.storage.from('message-attachments').remove(paths);if(error)throw error;}
export async function getMessageAttachmentUrl(path:string,expiresIn=900){const{data,error}=await supabase.storage.from('message-attachments').createSignedUrl(path,expiresIn);if(error)throw error;return data.signedUrl;}
export function attachmentDisplayName(path:string){const last=path.split('/').pop()||'Ek dosya';const index=last.indexOf('_');return index>=0?last.slice(index+1):last;}
function safeFilename(name:string){const cleaned=name.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120);return cleaned||'attachment';}
