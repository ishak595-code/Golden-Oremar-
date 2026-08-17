import{ supabase }from'../../lib/supabase';

function unwrap<T>(data:T|null,error:any):T{if(error)throw error;return data as T;}
function boundedInt(value:number,fallback:number,min:number,max:number){const parsed=Number(value);return Number.isSafeInteger(parsed)?Math.min(max,Math.max(min,parsed)):fallback;}
function requiredId(value:string,label:string){const normalized=String(value||'').trim();if(!normalized||normalized.length>128||!/^[A-Za-z0-9_-]+$/.test(normalized))throw new Error(`${label} kimliği geçersiz.`);return normalized;}
function safeStoragePath(value:unknown){const path=String(value||'').trim().replace(/^\/+/, '');if(!path||path.length>700||/[\u0000-\u001f\\]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Ek dosya yolu geçersiz.');return path;}

export async function listMyConversations(limit=50,offset=0){const{data,error}=await supabase.rpc('list_my_conversations_v1',{p_limit:boundedInt(limit,50,1,200),p_offset:boundedInt(offset,0,0,10000)});const rows=unwrap<any[]>(data,error);return Array.isArray(rows)?rows:[];}
export async function getConversationMessages(conversationId:string,limit=100,before?:string|null){const id=requiredId(conversationId,'Konuşma');const cursor=before?.trim()||null;if(cursor&&Number.isNaN(Date.parse(cursor)))throw new Error('Mesaj sayfalama tarihi geçersiz.');const{data,error}=await supabase.rpc('get_conversation_messages_v1',{p_conversation_id:id,p_limit:boundedInt(limit,100,1,200),p_before:cursor});const rows=unwrap<any[]>(data,error);return Array.isArray(rows)?rows:[];}
export async function markConversationRead(conversationId:string){const{data,error}=await supabase.rpc('mark_conversation_read_v1',{p_conversation_id:requiredId(conversationId,'Konuşma')});return unwrap<string>(data,error);}
export async function setConversationOpenState(conversationId:string,open:boolean){const{data,error}=await supabase.rpc('set_conversation_open_state_v1',{p_conversation_id:requiredId(conversationId,'Konuşma'),p_open:open===true});return unwrap<any>(data,error);}
export async function sendConversationMessage(input:{conversationId:string;body:string;attachmentPaths?:string[];messageType?:'text'|'image'|'file'}){const conversationId=requiredId(input.conversationId,'Konuşma');const body=String(input.body||'').trim();if(!body||body.length>5000)throw new Error('Mesaj 1 ile 5000 karakter arasında olmalıdır.');const attachments=[...new Set((Array.isArray(input.attachmentPaths)?input.attachmentPaths:[]).map(safeStoragePath))];if(attachments.length>5)throw new Error('Bir mesajda en fazla 5 ek dosya olabilir.');const messageType=input.messageType||'text';if(!['text','image','file'].includes(messageType))throw new Error('Mesaj türü geçersiz.');const{data,error}=await supabase.rpc('send_conversation_message_v1',{p_conversation_id:conversationId,p_body:body,p_attachment_paths:attachments,p_message_type:messageType});return unwrap<any>(data,error);}

const allowedMime=new Set(['image/jpeg','image/png','image/webp','image/avif','application/pdf']);
const maxBytes=20*1024*1024;
export async function uploadMessageAttachment(conversationId:string,file:File){
 const id=requiredId(conversationId,'Konuşma');
 if(!allowedMime.has(file.type))throw new Error('Ek dosya JPEG, PNG, WebP, AVIF veya PDF olmalıdır.');
 if(file.size<=0||file.size>maxBytes)throw new Error('Her ek dosya boş olmamalı ve en fazla 20 MB olabilir.');
 const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=String(userData.user?.id||'').trim();if(!userId||!/^[0-9a-f-]{36}$/i.test(userId))throw new Error('Oturum doğrulanamadı.');
 const original=safeFilename(file.name);const path=`${userId}/${id}/${crypto.randomUUID()}_${original}`;
 const{error}=await supabase.storage.from('message-attachments').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;return path;
}
export async function removeUnusedMessageAttachments(paths:string[]){const unique=Array.isArray(paths)?[...new Set(paths.map(safeStoragePath))].slice(0,20):[];if(!unique.length)return;const{error}=await supabase.storage.from('message-attachments').remove(unique);if(error)throw error;}
export async function getMessageAttachmentUrl(path:string,expiresIn=900){const normalized=safeStoragePath(path);const ttl=boundedInt(expiresIn,900,60,3600);const{data,error}=await supabase.storage.from('message-attachments').createSignedUrl(normalized,ttl);if(error)throw error;return data.signedUrl;}
export function attachmentDisplayName(path:string){let normalized='';try{normalized=safeStoragePath(path);}catch{return'Ek dosya';}const last=normalized.split('/').pop()||'Ek dosya';const index=last.indexOf('_');return index>=0?last.slice(index+1):last;}
function safeFilename(name:string){const cleaned=String(name||'').normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120);return cleaned||'attachment';}
