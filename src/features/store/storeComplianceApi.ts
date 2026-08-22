import { supabase } from '../../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ReportReason = 'harassment'|'hate'|'sexual'|'violence'|'spam'|'fraud'|'privacy'|'illegal'|'other';
export type TermsAcceptance = { accepted:boolean; termsVersion:string; acceptedAt:string|null };
export type ConversationSafety = { conversationId:string; canBlock:boolean; counterpartName:string|null; counterpartRole:string|null; blockedByMe:boolean; blocksMe:boolean };

type Row = Record<string, unknown>;
function record(value:unknown):value is Row{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function uuid(value:unknown,label:string){const text=typeof value==='string'?value.trim():'';if(!UUID_RE.test(text))throw new Error(`${label} doğrulanamadı.`);return text;}
function text(value:unknown,label:string,max=240){const result=typeof value==='string'?value.trim():'';if(!result||result.length>max||/[\u0000-\u001F\u007F]/.test(result))throw new Error(`${label} doğrulanamadı.`);return result;}
function optionalText(value:unknown,max=240){if(value==null||value==='')return null;if(typeof value!=='string')throw new Error('Metin doğrulanamadı.');const result=value.trim();if(!result)return null;if(result.length>max||/[\u0000-\u001F\u007F]/.test(result))throw new Error('Metin doğrulanamadı.');return result;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function date(value:unknown){if(value==null||value==='')return null;if(typeof value!=='string'||Number.isNaN(Date.parse(value)))throw new Error('Tarih doğrulanamadı.');return value;}
function result<T>(data:T|null,error:unknown){if(error)throw error;return data as T;}
function normalizeTerms(value:unknown):TermsAcceptance{if(!record(value))throw new Error('Kullanım şartları durumu doğrulanamadı.');return{accepted:bool(value.accepted,'Kullanım şartları kabulü'),termsVersion:text(value.termsVersion,'Kullanım şartları sürümü',80),acceptedAt:date(value.acceptedAt)};}
function normalizeSafety(value:unknown):ConversationSafety{if(!record(value))throw new Error('Konuşma güvenliği doğrulanamadı.');return{conversationId:uuid(value.conversationId,'Konuşma'),canBlock:bool(value.canBlock,'Engelleme izni'),counterpartName:optionalText(value.counterpartName,160),counterpartRole:optionalText(value.counterpartRole,40),blockedByMe:bool(value.blockedByMe,'Engelleme durumu'),blocksMe:bool(value.blocksMe,'Karşı engelleme durumu')};}

export async function getMyTermsAcceptance(){const{data,error}=await supabase.rpc('get_my_terms_acceptance_v1');return normalizeTerms(result<unknown>(data,error));}
export async function acceptCurrentTerms(){const{data,error}=await supabase.rpc('accept_current_terms_v1');return normalizeTerms(result<unknown>(data,error));}
export async function getConversationSafetyContext(conversationId:string){const id=uuid(conversationId,'Konuşma');const{data,error}=await supabase.rpc('get_conversation_safety_context_v1',{p_conversation_id:id});const normalized=normalizeSafety(result<unknown>(data,error));if(normalized.conversationId!==id)throw new Error('Konuşma güvenliği başka kayda ait.');return normalized;}
export async function setConversationUserBlock(conversationId:string,blocked:boolean){const id=uuid(conversationId,'Konuşma');const{data,error}=await supabase.rpc('set_conversation_user_block_v1',{p_conversation_id:id,p_block:blocked===true});const normalized=normalizeSafety(result<unknown>(data,error));if(normalized.conversationId!==id)throw new Error('Engelleme sonucu başka konuşmaya ait.');return normalized;}
function cleanDetails(value:string){const details=value.trim();if(details.length>1000||/[\u0000-\u001F\u007F]/.test(details))throw new Error('Bildirim açıklaması doğrulanamadı.');return details||null;}
export async function reportConversation(conversationId:string,reason:ReportReason='other',details=''){const id=uuid(conversationId,'Konuşma');const{data,error}=await supabase.rpc('report_conversation_v1',{p_conversation_id:id,p_reason:reason,p_details:cleanDetails(details)});const value=result<unknown>(data,error);if(!record(value)||value.status!=='new'&&value.status!=='reviewing')throw new Error('Konuşma bildirimi doğrulanamadı.');return{reportId:uuid(value.id,'Bildirim'),status:String(value.status)};}
export async function reportPublishedReview(reviewId:string,reason:ReportReason='other',details=''){const id=uuid(reviewId,'Yorum');const{data,error}=await supabase.rpc('report_published_review_v1',{p_review_id:id,p_reason:reason,p_details:cleanDetails(details)});const value=result<unknown>(data,error);if(!record(value)||value.status!=='new'&&value.status!=='reviewing')throw new Error('Yorum bildirimi doğrulanamadı.');return{reportId:uuid(value.id,'Bildirim'),status:String(value.status)};}
