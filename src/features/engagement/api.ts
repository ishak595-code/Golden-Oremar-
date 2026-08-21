import { supabase } from '../../lib/supabase';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_EVENT_STATUSES=new Set<PublicEvent['status']>(['published','sold_out','completed']);
const EVENT_STATUSES=new Set<EventLifecycleStatus>(['draft','published','sold_out','cancelled','completed']);
const RESERVATION_STATUSES=new Set<MyEventReservation['status']>(['pending_payment','pending','confirmed','waitlisted','cancelled','attended','no_show']);
const PAYMENT_STATUSES=new Set<EventPaymentStatus>(['not_required','pending','authorized','paid','failed','expired','refund_required','refunded']);
const SALE_MODES=new Set<PublicEvent['saleMode']>(['reservation','ticketed']);

type EventPaymentStatus='not_required'|'pending'|'authorized'|'paid'|'failed'|'expired'|'refund_required'|'refunded';
export type PublicEvent = {
  id: string;
  legacyId: string | null;
  slug: string;
  title: string;
  description: string;
  imagePath: string | null;
  locationName: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  remainingCapacity: number | null;
  reservationDeadline: string | null;
  status: 'published' | 'sold_out' | 'completed';
  reservable: boolean;
  waitlistOnly: boolean;
  ticketPriceMinor:number;
  currency:string;
  isPaid:boolean;
  saleMode:'reservation'|'ticketed';
};

type EventLifecycleStatus='draft'|'published'|'sold_out'|'cancelled'|'completed';
export type PublicEventsResult = { items: PublicEvent[]; upcomingCount: number; pastCount: number };
export type MyEventReservation = {
  id: string;
  eventId: string;
  reservationCode: string;
  guestName: string;
  guestCount: number;
  status: 'pending_payment'|'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';
  createdAt: string;
  updatedAt: string;
  payment:{status:EventPaymentStatus;requiresPayment:boolean;amountMinor:number;currency:string;expiresAt:string|null;};
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    locationName: string;
    status: EventLifecycleStatus;
    imagePath: string | null;
    ticketPriceMinor:number;
    currency:string;
  };
};
export type EventReservationResult={ok:true;reservationId:string;reservationCode:string;status:'pending_payment'|'pending'|'waitlisted';requiresPayment:boolean;amountMinor:number;currency:string;paymentExpiresAt:string|null;};

function unwrap<T>(data:T|null,error:unknown):T{if(error)throw error;return data as T;}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function boundedText(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function requiredText(value:unknown,label:string,max:number){const normalized=boundedText(value,max+1);if(!normalized||normalized.length>max||/[\u0000-\u001f\u007f]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function optionalText(value:unknown,label:string,max:number){if(value==null||value==='')return null;if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const normalized=value.trim();if(!normalized)return null;if(normalized.length>max||/[\u0000-\u001f\u007f]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function uuid(value:unknown,label:string){const id=typeof value==='string'?value.trim():'';if(!UUID_RE.test(id))throw new Error(`${label} kimliği doğrulanamadı.`);return id;}
function safeDate(value:unknown,label:string){const normalized=requiredText(value,label,80);if(Number.isNaN(Date.parse(normalized)))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function optionalDate(value:unknown,label:string){if(value==null||value==='')return null;return safeDate(value,label);}
function integer(value:unknown,label:string,min=0,max=Number.MAX_SAFE_INTEGER){const parsed=typeof value==='number'?value:Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${label} doğrulanamadı.`);return parsed;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function enumValue<T extends string>(value:unknown,label:string,allowed:Set<T>){if(typeof value!=='string'||!allowed.has(value as T))throw new Error(`${label} doğrulanamadı.`);return value as T;}
function currency(value:unknown,label:string){const normalized=requiredText(value,label,3).toUpperCase();if(!/^[A-Z]{3}$/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}

function normalizePublicEvent(value:unknown,index:number):PublicEvent{
  if(!isRecord(value))throw new Error(`${index+1}. etkinlik doğrulanamadı.`);
  const startsAt=safeDate(value.startsAt,`${index+1}. etkinlik başlangıç tarihi`),endsAt=safeDate(value.endsAt,`${index+1}. etkinlik bitiş tarihi`);
  if(Date.parse(endsAt)<=Date.parse(startsAt))throw new Error(`${index+1}. etkinlik tarih aralığı tutarsız.`);
  const capacity=value.capacity==null?null:integer(value.capacity,`${index+1}. etkinlik kapasitesi`,1);
  const remainingCapacity=value.remainingCapacity==null?null:integer(value.remainingCapacity,`${index+1}. kalan kapasite`,0);
  if(capacity===null&&remainingCapacity!==null)throw new Error(`${index+1}. sınırsız etkinlikte kalan kapasite sayı olamaz.`);
  if(capacity!==null&&remainingCapacity!==null&&remainingCapacity>capacity)throw new Error(`${index+1}. kalan kapasite toplam kapasiteyi aşıyor.`);
  const reservationDeadline=optionalDate(value.reservationDeadline,`${index+1}. kayıt son tarihi`);
  if(reservationDeadline&&Date.parse(reservationDeadline)>Date.parse(startsAt))throw new Error(`${index+1}. kayıt son tarihi etkinlik başlangıcından sonra olamaz.`);
  const status=enumValue(value.status,`${index+1}. etkinlik durumu`,PUBLIC_EVENT_STATUSES),reservable=bool(value.reservable,`${index+1}. kayıt uygunluğu`),waitlistOnly=bool(value.waitlistOnly,`${index+1}. bekleme listesi durumu`);
  if(status==='completed'&&(reservable||waitlistOnly))throw new Error(`${index+1}. tamamlanmış etkinlik kayıt kabul edemez.`);
  if(status==='sold_out'&&!waitlistOnly)throw new Error(`${index+1}. dolu etkinlik bekleme listesi durumuyla tutarsız.`);
  const ticketPriceMinor=integer(value.ticketPriceMinor,`${index+1}. bilet fiyatı`,0),eventCurrency=currency(value.currency,`${index+1}. para birimi`),isPaid=bool(value.isPaid,`${index+1}. ücret durumu`),saleMode=enumValue(value.saleMode,`${index+1}. satış modu`,SALE_MODES);
  if(isPaid!==(ticketPriceMinor>0))throw new Error(`${index+1}. etkinlik ücret bilgisi tutarsız.`);
  if((saleMode==='ticketed')!==isPaid)throw new Error(`${index+1}. etkinlik satış modu ücret bilgisiyle tutarsız.`);
  return{id:uuid(value.id,`${index+1}. etkinlik`),legacyId:optionalText(value.legacyId,`${index+1}. eski etkinlik referansı`,160),slug:requiredText(value.slug,`${index+1}. etkinlik bağlantısı`,220),title:requiredText(value.title,`${index+1}. etkinlik başlığı`,240),description:requiredText(value.description,`${index+1}. etkinlik açıklaması`,5000),imagePath:optionalText(value.imagePath,`${index+1}. etkinlik görseli`,1000),locationName:requiredText(value.locationName,`${index+1}. etkinlik konumu`,300),startsAt,endsAt,capacity,remainingCapacity,reservationDeadline,status,reservable,waitlistOnly,ticketPriceMinor,currency:eventCurrency,isPaid,saleMode};
}
function normalizePublicEvents(value:unknown):PublicEventsResult{
  if(!isRecord(value)||!Array.isArray(value.items)||value.items.length>200)throw new Error('Etkinlik listesi sunucudan doğrulanamadı.');
  const items=value.items.map(normalizePublicEvent),upcomingCount=integer(value.upcomingCount,'Yaklaşan etkinlik sayısı',0,200),pastCount=integer(value.pastCount,'Geçmiş etkinlik sayısı',0,200);
  if(upcomingCount+pastCount!==items.length)throw new Error('Etkinlik özet sayaçları listeyle tutarsız.');
  return{items,upcomingCount,pastCount};
}
function normalizePayment(value:unknown,index:number){if(!isRecord(value))throw new Error(`${index+1}. etkinlik ödeme bilgisi doğrulanamadı.`);const status=enumValue(value.status,`${index+1}. ödeme durumu`,PAYMENT_STATUSES),requiresPayment=bool(value.requiresPayment,`${index+1}. ödeme gereksinimi`),amountMinor=integer(value.amountMinor,`${index+1}. ödeme tutarı`,0),paymentCurrency=currency(value.currency,`${index+1}. ödeme para birimi`),expiresAt=optionalDate(value.expiresAt,`${index+1}. ödeme son tarihi`);if(status==='not_required'&&(requiresPayment||amountMinor!==0))throw new Error(`${index+1}. ücretsiz etkinlik ödeme bilgisi tutarsız.`);if(requiresPayment&&(status!=='pending'||amountMinor<=0||!expiresAt))throw new Error(`${index+1}. bekleyen etkinlik ödeme bilgisi tutarsız.`);return{status,requiresPayment,amountMinor,currency:paymentCurrency,expiresAt};}
function normalizeReservation(value:unknown,index:number):MyEventReservation{
  if(!isRecord(value))throw new Error(`${index+1}. etkinlik kaydı doğrulanamadı.`);
  const rawEvent=Array.isArray(value.event)?value.event[0]:value.event;
  if(!isRecord(rawEvent))throw new Error(`${index+1}. etkinlik kayıt detayı bağlı etkinlik olmadan geldi.`);
  const startsAt=safeDate(rawEvent.starts_at,`${index+1}. etkinlik başlangıç tarihi`),endsAt=safeDate(rawEvent.ends_at,`${index+1}. etkinlik bitiş tarihi`);
  if(Date.parse(endsAt)<=Date.parse(startsAt))throw new Error(`${index+1}. etkinlik tarih aralığı tutarsız.`);
  const eventId=uuid(value.event_id,`${index+1}. etkinlik`),nestedEventId=uuid(rawEvent.id,`${index+1}. bağlı etkinlik`);if(eventId!==nestedEventId)throw new Error(`${index+1}. etkinlik kaydı başka etkinlik detayıyla eşleşiyor.`);
  const eventTicketPrice=integer(rawEvent.ticket_price_minor,`${index+1}. etkinlik bilet fiyatı`,0),eventCurrency=currency(rawEvent.currency,`${index+1}. etkinlik para birimi`),payment=normalizePayment(value.payment,index);
  return{id:uuid(value.id,`${index+1}. etkinlik kaydı`),eventId,reservationCode:requiredText(value.reservation_code,`${index+1}. etkinlik kayıt kodu`,120),guestName:requiredText(value.guest_name,`${index+1}. etkinlik kayıt sahibi`,120),guestCount:integer(value.guest_count,`${index+1}. kişi sayısı`,1,20),status:enumValue(value.status,`${index+1}. etkinlik kayıt durumu`,RESERVATION_STATUSES),createdAt:safeDate(value.created_at,`${index+1}. etkinlik kayıt tarihi`),updatedAt:safeDate(value.updated_at,`${index+1}. etkinlik güncelleme tarihi`),payment,event:{id:nestedEventId,slug:requiredText(rawEvent.slug,`${index+1}. etkinlik bağlantısı`,220),title:requiredText(rawEvent.title,`${index+1}. etkinlik başlığı`,240),startsAt,endsAt,locationName:requiredText(rawEvent.location_name,`${index+1}. etkinlik konumu`,300),status:enumValue(rawEvent.status,`${index+1}. etkinlik durumu`,EVENT_STATUSES),imagePath:optionalText(rawEvent.image_path,`${index+1}. etkinlik görseli`,1000),ticketPriceMinor:eventTicketPrice,currency:eventCurrency}};
}
function normalizeReservationResult(value:unknown):EventReservationResult{if(!isRecord(value)||value.ok!==true)throw new Error('Etkinlik kayıt sonucu doğrulanamadı.');const status=value.status;if(status!=='pending_payment'&&status!=='pending'&&status!=='waitlisted')throw new Error('Etkinlik kayıt başlangıç durumu doğrulanamadı.');const requiresPayment=bool(value.requiresPayment,'Etkinlik ödeme gereksinimi'),amountMinor=integer(value.amountMinor,'Etkinlik ödeme tutarı',0),resultCurrency=currency(value.currency,'Etkinlik para birimi'),paymentExpiresAt=optionalDate(value.paymentExpiresAt,'Etkinlik ödeme bitiş zamanı');if((status==='pending_payment')!==requiresPayment)throw new Error('Etkinlik ödeme gereksinimi kayıt durumuyla tutarsız.');if(requiresPayment&&(amountMinor<=0||!paymentExpiresAt))throw new Error('Ücretli etkinlik ödeme bilgisi eksik.');if(!requiresPayment&&amountMinor!==0)throw new Error('Ücretsiz etkinlik ödeme tutarı sıfır olmalıdır.');return{ok:true,reservationId:uuid(value.reservationId,'Etkinlik kaydı'),reservationCode:requiredText(value.reservationCode,'Etkinlik kayıt kodu',120),status,requiresPayment,amountMinor,currency:resultCurrency,paymentExpiresAt};}
function idempotencyKey(scope:string){if(typeof globalThis.crypto?.randomUUID!=='function')throw new Error('Güvenli istek kimliği üretilemedi.');return`${scope}_${Date.now()}_${globalThis.crypto.randomUUID().replaceAll('-','')}`;}

export async function getPublicContactConfig(){const{data,error}=await supabase.rpc('get_public_contact_config_v1');return unwrap<any>(data,error);}
export async function submitContactForm(input:{name:string;email:string;phone?:string;subject:string;message:string;locale?:string;website?:string}){const key=idempotencyKey('contact');const{data,error}=await supabase.functions.invoke('contact-submit',{body:{...input,locale:input.locale||'tr',source:'mobile-app',idempotencyKey:key},headers:{'x-idempotency-key':key}});if(error)throw error;if(data?.ok===false)throw new Error(String(data.error||'submission_failed'));return data;}

export async function listPublicEvents(includePast=true):Promise<PublicEventsResult>{const{data,error}=await supabase.rpc('list_public_events_v1',{p_include_past:includePast});return normalizePublicEvents(unwrap<unknown>(data,error));}
export async function listMyEventReservations(limit=30):Promise<MyEventReservation[]>{if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Etkinlik kayıt liste sınırı geçersiz.');const{data,error}=await supabase.rpc('list_my_event_reservations_v1',{p_limit:limit});const rows=unwrap<unknown>(data,error);if(!Array.isArray(rows)||rows.length>limit)throw new Error('Etkinlik kayıtlarınız sunucudan doğrulanamadı.');return rows.map(normalizeReservation);}
export async function submitEventReservation(input:{eventReference:string;guestName:string;guestEmail:string;guestPhone:string;guestCount:number;notes?:string;website?:string}):Promise<EventReservationResult>{const eventReference=requiredText(input.eventReference,'Etkinlik referansı',200),guestName=requiredText(input.guestName,'Ad soyad',120),guestEmail=requiredText(input.guestEmail,'E-posta',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))throw new Error('invalid_email');const guestPhone=requiredText(input.guestPhone,'Telefon',40),phoneDigits=guestPhone.replace(/\D/g,'').length;if(phoneDigits<7||phoneDigits>20)throw new Error('invalid_phone');if(!Number.isSafeInteger(input.guestCount)||input.guestCount<1||input.guestCount>20)throw new Error('invalid_guest_count');const notes=boundedText(input.notes,1001);if(notes.length>1000)throw new Error('invalid_notes');const key=idempotencyKey('event');const{data,error}=await supabase.functions.invoke('event-reservation',{body:{eventReference,guestName,guestEmail,guestPhone,guestCount:input.guestCount,notes,website:boundedText(input.website,200),idempotencyKey:key},headers:{'x-idempotency-key':key}});if(error)throw error;if(isRecord(data)&&data.ok===false)throw new Error(String(data.error||'submission_failed'));return normalizeReservationResult(data);}

export function publicContentUrl(path?:string|null){const raw=typeof path==='string'?path.trim():'';if(!raw||/[\u0000-\u001F\u007F]/.test(raw))return'';if(/^https:\/\//i.test(raw)){try{return new URL(raw).toString();}catch{return'';}}if(/^[a-z][a-z0-9+.-]*:/i.test(raw))return'';const normalized=raw.replace(/^\/+/, '');if(!normalized||normalized.split('/').some(part=>part==='..'||part==='.'||!part))return'';return supabase.storage.from('content-public').getPublicUrl(normalized).data.publicUrl;}
