import{supabase}from'../lib/supabase';

export type MessageModerationSettings={
 enabled:boolean;
 blockEmail:boolean;
 blockPhone:boolean;
 blockMessagingApps:boolean;
 blockExternalLinks:boolean;
 blockSocialHandles:boolean;
 blockBankDetails:boolean;
 blockExternalPayments:boolean;
 blockQrCodes:boolean;
 customBlockedPhrases:string[];
 applyToSupport:boolean;
 allowAttachments:boolean;
 allowImages:boolean;
 allowPdf:boolean;
 maxAttachments:number;
 maxAttachmentMb:number;
 updatedAt:string;
};

function unwrap<T>(data:T|null,error:unknown):T{if(error)throw error;return data as T;}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function int(value:unknown,label:string,min:number,max:number){const parsed=typeof value==='number'?value:Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${label} doğrulanamadı.`);return parsed;}
function dateTime(value:unknown,label:string){if(typeof value!=='string'||Number.isNaN(new Date(value).getTime()))throw new Error(`${label} doğrulanamadı.`);return value;}
function phrases(value:unknown){if(!Array.isArray(value)||value.length>100)throw new Error('Özel engelli ifade listesi doğrulanamadı.');const result=value.map((item,index)=>{if(typeof item!=='string'){throw new Error(`${index+1}. özel engelli ifade doğrulanamadı.`);}const text=item.trim().toLowerCase();if(text.length<2||text.length>80||/[\u0000-\u001f\u007f]/.test(text))throw new Error(`${index+1}. özel engelli ifade doğrulanamadı.`);return text;});if(new Set(result).size!==result.length)throw new Error('Özel engelli ifade listesinde tekrar eden kayıt var.');return result;}
function normalize(value:unknown):MessageModerationSettings{if(!isRecord(value))throw new Error('Mesaj güvenliği ayarları doğrulanamadı.');return{enabled:bool(value.enabled,'Mesaj güvenliği ana anahtarı'),blockEmail:bool(value.blockEmail,'E-posta filtresi'),blockPhone:bool(value.blockPhone,'Telefon filtresi'),blockMessagingApps:bool(value.blockMessagingApps,'Harici mesajlaşma filtresi'),blockExternalLinks:bool(value.blockExternalLinks,'Dış bağlantı filtresi'),blockSocialHandles:bool(value.blockSocialHandles,'Sosyal medya filtresi'),blockBankDetails:bool(value.blockBankDetails,'Banka bilgisi filtresi'),blockExternalPayments:bool(value.blockExternalPayments,'Harici ödeme filtresi'),blockQrCodes:bool(value.blockQrCodes,'QR kod filtresi'),customBlockedPhrases:phrases(value.customBlockedPhrases),applyToSupport:bool(value.applyToSupport,'Destek konuşması filtresi'),allowAttachments:bool(value.allowAttachments,'Mesaj ekleri'),allowImages:bool(value.allowImages,'Görsel ekleri'),allowPdf:bool(value.allowPdf,'PDF ekleri'),maxAttachments:int(value.maxAttachments,'Maksimum ek sayısı',0,5),maxAttachmentMb:int(value.maxAttachmentMb,'Maksimum ek boyutu',1,20),updatedAt:dateTime(value.updatedAt,'Mesaj güvenliği güncelleme tarihi')};}

export async function adminGetMessageModeration(){const{data,error}=await supabase.rpc('admin_get_message_moderation_v1');return normalize(unwrap<unknown>(data,error));}
export async function adminUpdateMessageModeration(input:Omit<MessageModerationSettings,'updatedAt'>){if(new Set(input.customBlockedPhrases.map(item=>item.trim().toLowerCase())).size!==input.customBlockedPhrases.length)throw new Error('Özel engelli ifade listesinde tekrar eden kayıt var.');const{data,error}=await supabase.rpc('admin_update_message_moderation_v1',{p_payload:input});return normalize(unwrap<unknown>(data,error));}
export function messageModerationAdminError(error:unknown,fallback='Mesaj güvenliği ayarı tamamlanamadı.'){const message=error instanceof Error?error.message:String((error as any)?.message??'');if(message.includes('super_admin_required'))return'Bu bölüm yalnız Super Admin tarafından yönetilebilir.';if(message.includes('message_moderation_configuration_missing'))return'Mesaj güvenliği yapılandırması bulunamadı.';if(message.includes('invalid_custom_blocked'))return'Özel engelli ifadeler 2-80 karakter olmalı ve en fazla 100 kayıt içermelidir.';if(message.includes('invalid_message_attachment_limit'))return'Maksimum ek sayısı 0 ile 5 arasında olmalıdır.';if(message.includes('invalid_message_attachment_size'))return'Maksimum dosya boyutu 1 ile 20 MB arasında olmalıdır.';return message&&message.length<=280?message:fallback;}
