import { supabase } from '../lib/supabase';

export type ProducerEventSubmissionStatus='pending'|'needs_changes'|'approved'|'rejected'|'withdrawn';
export type ProducerEventReviewDecision='approve'|'reject'|'needs_changes';
export type AdminProducerEventSubmission={
  id:string;producerId:string;producerName:string;producerLocation:string;producerCommissionBasisPoints:number;producerBadgeActive:boolean;
  title:string;description:string;imagePath:string|null;locationName:string;locationDetails:Record<string,unknown>;startsAt:string;endsAt:string;
  capacity:number|null;reservationDeadline:string|null;ticketPriceMinor:number;currency:string;requestedCommissionBasisPoints:number|null;
  approvedCommissionBasisPoints:number|null;status:ProducerEventSubmissionStatus;reviewReason:string|null;eventId:string|null;createdAt:string;updatedAt:string;
};
export type ProducerEventReviewResult={id:string;decision:ProducerEventReviewDecision;status:Exclude<ProducerEventSubmissionStatus,'pending'|'withdrawn'>;eventId:string|null;commissionBasisPoints:number;reason:string|null;};

const STATUSES=new Set<ProducerEventSubmissionStatus>(['pending','needs_changes','approved','rejected','withdrawn']);
const DECISIONS=new Set<ProducerEventReviewDecision>(['approve','reject','needs_changes']);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function unwrap<T>(data:T|null,error:unknown):T{if(error)throw error;return data as T;}
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,label:string,max:number,required=true){if(value==null||value===''){if(required)throw new Error(`${label} doğrulanamadı.`);return null;}if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const next=value.trim();if((required&&!next)||next.length>max||/[\u0000-\u001F\u007F]/.test(next))throw new Error(`${label} doğrulanamadı.`);return next||null;}
function uuid(value:unknown,label:string,required=true){const next=text(value,label,36,required);if(next==null)return null;if(!UUID_RE.test(next))throw new Error(`${label} doğrulanamadı.`);return next;}
function integer(value:unknown,label:string,min:number,max:number,required=true){if(value==null){if(required)throw new Error(`${label} doğrulanamadı.`);return null;}if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function dateTime(value:unknown,label:string,required=true){const next=text(value,label,80,required);if(next==null)return null;if(Number.isNaN(Date.parse(next)))throw new Error(`${label} doğrulanamadı.`);return next;}
function currency(value:unknown){const next=(text(value,'Para birimi',3,true) as string).toUpperCase();if(!/^[A-Z]{3}$/.test(next))throw new Error('Para birimi doğrulanamadı.');return next;}
function normalizeStatus(value:unknown){const next=text(value,'Etkinlik başvuru durumu',40,true) as ProducerEventSubmissionStatus;if(!STATUSES.has(next))throw new Error('Etkinlik başvuru durumu doğrulanamadı.');return next;}
function normalize(value:unknown,index:number):AdminProducerEventSubmission{
  if(!record(value)||!record(value.locationDetails))throw new Error(`${index+1}. etkinlik başvurusu doğrulanamadı.`);
  const startsAt=dateTime(value.startsAt,`${index+1}. başlangıç tarihi`,true) as string;
  const endsAt=dateTime(value.endsAt,`${index+1}. bitiş tarihi`,true) as string;
  if(new Date(endsAt).getTime()<=new Date(startsAt).getTime())throw new Error(`${index+1}. etkinlik tarih aralığı doğrulanamadı.`);
  const deadline=dateTime(value.reservationDeadline,`${index+1}. kayıt son tarihi`,false);
  if(deadline&&new Date(deadline).getTime()>new Date(startsAt).getTime())throw new Error(`${index+1}. kayıt son tarihi doğrulanamadı.`);
  return{
    id:uuid(value.id,`${index+1}. başvuru kimliği`,true) as string,
    producerId:uuid(value.producerId,`${index+1}. satıcı kimliği`,true) as string,
    producerName:text(value.producerName,`${index+1}. satıcı adı`,240,true) as string,
    producerLocation:text(value.producerLocation,`${index+1}. üretim yeri`,500,true) as string,
    producerCommissionBasisPoints:integer(value.producerCommissionBasisPoints,`${index+1}. satıcı komisyonu`,0,10000,true) as number,
    producerBadgeActive:bool(value.producerBadgeActive,`${index+1}. satıcı rozeti`),
    title:text(value.title,`${index+1}. etkinlik adı`,180,true) as string,
    description:text(value.description,`${index+1}. açıklama`,20000,true) as string,
    imagePath:text(value.imagePath,`${index+1}. görsel yolu`,1200,false),
    locationName:text(value.locationName,`${index+1}. etkinlik konumu`,500,true) as string,
    locationDetails:value.locationDetails,
    startsAt,endsAt,
    capacity:integer(value.capacity,`${index+1}. kapasite`,1,1000000,false),
    reservationDeadline:deadline,
    ticketPriceMinor:integer(value.ticketPriceMinor,`${index+1}. bilet fiyatı`,0,100000000000,true) as number,
    currency:currency(value.currency),
    requestedCommissionBasisPoints:integer(value.requestedCommissionBasisPoints,`${index+1}. talep komisyonu`,0,10000,false),
    approvedCommissionBasisPoints:integer(value.approvedCommissionBasisPoints,`${index+1}. onay komisyonu`,0,10000,false),
    status:normalizeStatus(value.status),
    reviewReason:text(value.reviewReason,`${index+1}. inceleme notu`,2000,false),
    eventId:uuid(value.eventId,`${index+1}. etkinlik kimliği`,false),
    createdAt:dateTime(value.createdAt,`${index+1}. oluşturma tarihi`,true) as string,
    updatedAt:dateTime(value.updatedAt,`${index+1}. güncelleme tarihi`,true) as string,
  };
}

export async function adminListProducerEventSubmissions(){
  const{data,error}=await supabase.rpc('admin_list_producer_event_submissions_v1');
  const rows=unwrap<unknown>(data,error);
  if(!Array.isArray(rows)||rows.length>10000)throw new Error('Etkinlik başvuru kuyruğu doğrulanamadı.');
  return rows.map(normalize);
}

export async function adminReviewProducerEventSubmission(input:{submissionId:string;decision:ProducerEventReviewDecision;reason?:string|null;commissionPercent:number}){
  const submissionId=uuid(input.submissionId,'Etkinlik başvuru kimliği',true) as string;
  if(!DECISIONS.has(input.decision))throw new Error('Etkinlik inceleme kararı doğrulanamadı.');
  const reason=String(input.reason||'').trim();
  if(input.decision!=='approve'&&(reason.length<8||reason.length>2000))throw new Error('Ret veya düzeltme kararında 8 ile 2000 karakter arasında gerekçe zorunludur.');
  if(input.decision==='approve'&&reason.length>2000)throw new Error('İnceleme notu 2000 karakteri aşamaz.');
  if(!Number.isFinite(input.commissionPercent)||input.commissionPercent<0||input.commissionPercent>100)throw new Error('Etkinlik platform komisyonu %0 ile %100 arasında olmalıdır.');
  const commissionBasisPoints=Math.round(input.commissionPercent*100);
  const{data,error}=await supabase.rpc('admin_review_producer_event_submission_v1',{
    p_submission_id:submissionId,p_decision:input.decision,p_reason:reason||null,p_commission_basis_points:commissionBasisPoints,
  });
  const raw=unwrap<unknown>(data,error);
  if(!record(raw))throw new Error('Etkinlik inceleme sonucu doğrulanamadı.');
  const decision=text(raw.decision,'İnceleme kararı',40,true) as ProducerEventReviewDecision;
  if(!DECISIONS.has(decision)||decision!==input.decision)throw new Error('Etkinlik inceleme kararı doğrulanamadı.');
  const status=normalizeStatus(raw.status);
  const expectedStatus=input.decision==='approve'?'approved':input.decision==='reject'?'rejected':'needs_changes';
  if(status!==expectedStatus)throw new Error('Etkinlik inceleme durumu doğrulanamadı.');
  const returnedCommission=integer(raw.commissionBasisPoints,'Etkinlik komisyonu',0,10000,true) as number;
  if(returnedCommission!==commissionBasisPoints)throw new Error('Etkinlik komisyonu sunucu sonucuyla eşleşmiyor.');
  return{
    id:uuid(raw.id,'Etkinlik başvuru kimliği',true) as string,
    decision,status:status as ProducerEventReviewResult['status'],
    eventId:uuid(raw.eventId,'Yayınlanan etkinlik kimliği',false),
    commissionBasisPoints:returnedCommission,
    reason:text(raw.reason,'İnceleme gerekçesi',2000,false),
  } satisfies ProducerEventReviewResult;
}

export function producerEventSubmissionImageUrl(path:string|null){
  if(!path)return'';
  return supabase.storage.from('event-public').getPublicUrl(path).data.publicUrl;
}
export function producerEventAdminErrorMessage(error:unknown,fallback='Etkinlik başvurusu işlemi tamamlanamadı.'){
  const message=String((error as{message?:unknown}|null)?.message||'').trim();
  if(!message)return fallback;
  const map:Array<[string,string]>=[
    ['super_admin_required','Bu kuyruk ve kararlar yalnızca Super Admin tarafından yönetilebilir.'],
    ['event_submission_not_reviewable','Başvuru artık incelemeye açık değil. Listeyi yenileyin.'],
    ['event_review_reason_required','Ret veya düzeltme talebinde açık bir gerekçe yazmalısınız.'],
    ['producer_trust_badge_required','Satıcının aktif doğrulama rozeti olmadığı için etkinlik yayınlanamaz.'],
    ['producer_not_event_eligible','Satıcının hesap, kimlik veya menşe doğrulaması etkinlik yayınlamaya uygun değil.'],
    ['event_start_must_be_future','Etkinliğin başlangıç tarihi artık geçmişte. Satıcıdan yeni tarih isteyin.'],
    ['stored_event_image_required','Etkinlik görseli güvenli depolamada doğrulanamadı.'],
    ['invalid_event_commission','Etkinlik komisyon oranı geçersiz.'],
    ['producer_not_found','Satıcı profili artık bulunamadı.'],
  ];
  for(const[key,value]of map)if(message.includes(key))return value;
  return message.length<=300?message:fallback;
}
