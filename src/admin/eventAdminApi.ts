import { supabase } from '../lib/supabase';

export type AdminEventStatus = 'draft' | 'published' | 'sold_out' | 'cancelled' | 'completed';
export type AdminEventReservationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';

export type AdminEvent = {
  id: string;
  legacy_id: string | null;
  slug: string;
  title: string;
  description: string;
  image_path: string | null;
  location_name: string;
  location_details: Record<string, unknown>;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  reservation_deadline: string | null;
  status: AdminEventStatus;
  created_at: string;
  updated_at: string;
  reservation_count: number;
  reserved_guests: number;
};

export type AdminEventReservation = {
  id: string;
  event_id: string;
  event_title: string;
  event_starts_at: string;
  reservation_code: string;
  user_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_count: number;
  notes: string | null;
  status: AdminEventReservationStatus;
  created_at: string;
  updated_at: string;
};

type AdminEventMutationResult = {
  id: string;
  databaseId: string;
  status: AdminEventStatus;
};

const EVENT_STATUSES = new Set<AdminEventStatus>(['draft', 'published', 'sold_out', 'cancelled', 'completed']);
const RESERVATION_STATUSES = new Set<AdminEventReservationStatus>(['pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalUuid(value: unknown, label: string) {
  if (value == null || value === '') return null;
  return uuid(value, label);
}

function dateTime(value: unknown, label: string, required = true) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return value;
}

function optionalInteger(value: unknown, label: string, min: number, max: number) {
  if (value == null) return null;
  return integer(value, label, min, max);
}

function eventStatus(value: unknown) {
  const status = requiredText(value, 'Etkinlik durumu', 40) as AdminEventStatus;
  if (!EVENT_STATUSES.has(status)) throw new Error('Etkinlik durumu doğrulanamadı.');
  return status;
}

function reservationStatus(value: unknown) {
  const status = requiredText(value, 'Rezervasyon durumu', 40) as AdminEventReservationStatus;
  if (!RESERVATION_STATUSES.has(status)) throw new Error('Rezervasyon durumu doğrulanamadı.');
  return status;
}

function normalizePersistentImage(value?: string | null) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.length > 2048) throw new Error('Etkinlik görsel yolu çok uzun.');
  if (/^(data|blob|javascript):/i.test(image)) throw new Error('Geçici veya güvensiz etkinlik görsel adresi kullanılamaz.');
  if (/^https?:\/\//i.test(image)) {
    let url: URL;
    try { url = new URL(image); } catch { throw new Error('Etkinlik görsel URL adresi geçersiz.'); }
    if (url.protocol !== 'https:') throw new Error('Harici etkinlik görseli yalnız HTTPS üzerinden kullanılabilir.');
    return url.toString();
  }
  const normalized = image.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\\')) throw new Error('Etkinlik görsel dosya yolu geçersiz.');
  return normalized;
}

function normalizeEvent(value: unknown, index: number): AdminEvent {
  if (!isRecord(value)) throw new Error(`${index + 1}. etkinlik kaydı doğrulanamadı.`);
  if (!isRecord(value.location_details)) throw new Error(`${index + 1}. etkinlik konum detayları doğrulanamadı.`);
  const startsAt = dateTime(value.starts_at, `${index + 1}. etkinlik başlangıcı`) as string;
  const endsAt = dateTime(value.ends_at, `${index + 1}. etkinlik bitişi`) as string;
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error(`${index + 1}. etkinlik tarih aralığı doğrulanamadı.`);
  const deadline = dateTime(value.reservation_deadline, `${index + 1}. rezervasyon son tarihi`, false);
  if (deadline && new Date(deadline).getTime() > new Date(startsAt).getTime()) throw new Error(`${index + 1}. rezervasyon son tarihi doğrulanamadı.`);
  return {
    id: uuid(value.id, `${index + 1}. etkinlik kimliği`),
    legacy_id: optionalText(value.legacy_id, `${index + 1}. etkinlik eski kimliği`, 200),
    slug: requiredText(value.slug, `${index + 1}. etkinlik kısa adı`, 220),
    title: requiredText(value.title, `${index + 1}. etkinlik adı`, 180),
    description: typeof value.description === 'string' && value.description.length <= 20000 ? value.description : (() => { throw new Error(`${index + 1}. etkinlik açıklaması doğrulanamadı.`); })(),
    image_path: optionalText(value.image_path, `${index + 1}. etkinlik görseli`, 2048),
    location_name: typeof value.location_name === 'string' && value.location_name.length <= 500 ? value.location_name : (() => { throw new Error(`${index + 1}. etkinlik konumu doğrulanamadı.`); })(),
    location_details: value.location_details,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity: optionalInteger(value.capacity, `${index + 1}. etkinlik kapasitesi`, 1, 1000000),
    reservation_deadline: deadline,
    status: eventStatus(value.status),
    created_at: dateTime(value.created_at, `${index + 1}. etkinlik oluşturma tarihi`) as string,
    updated_at: dateTime(value.updated_at, `${index + 1}. etkinlik güncelleme tarihi`) as string,
    reservation_count: integer(value.reservation_count, `${index + 1}. rezervasyon sayısı`, 0, 1000000000),
    reserved_guests: integer(value.reserved_guests, `${index + 1}. rezerve misafir sayısı`, 0, 1000000000),
  };
}

function normalizeReservation(value: unknown, index: number): AdminEventReservation {
  if (!isRecord(value)) throw new Error(`${index + 1}. etkinlik rezervasyonu doğrulanamadı.`);
  return {
    id: uuid(value.id, `${index + 1}. rezervasyon kimliği`),
    event_id: uuid(value.event_id, `${index + 1}. rezervasyon etkinlik kimliği`),
    event_title: requiredText(value.event_title, `${index + 1}. rezervasyon etkinlik adı`, 180),
    event_starts_at: dateTime(value.event_starts_at, `${index + 1}. rezervasyon etkinlik tarihi`) as string,
    reservation_code: requiredText(value.reservation_code, `${index + 1}. rezervasyon kodu`, 160),
    user_id: optionalUuid(value.user_id, `${index + 1}. rezervasyon kullanıcı kimliği`),
    guest_name: requiredText(value.guest_name, `${index + 1}. misafir adı`, 180),
    guest_email: requiredText(value.guest_email, `${index + 1}. misafir e-postası`, 320),
    guest_phone: optionalText(value.guest_phone, `${index + 1}. misafir telefonu`, 80),
    guest_count: integer(value.guest_count, `${index + 1}. misafir sayısı`, 1, 20),
    notes: optionalText(value.notes, `${index + 1}. rezervasyon notu`, 5000),
    status: reservationStatus(value.status),
    created_at: dateTime(value.created_at, `${index + 1}. rezervasyon oluşturma tarihi`) as string,
    updated_at: dateTime(value.updated_at, `${index + 1}. rezervasyon güncelleme tarihi`) as string,
  };
}

function normalizeMutationResult(value: unknown): AdminEventMutationResult {
  if (!isRecord(value)) throw new Error('Etkinlik kayıt sonucu doğrulanamadı.');
  return {
    id: requiredText(value.id, 'Etkinlik referansı', 200),
    databaseId: uuid(value.databaseId, 'Etkinlik veritabanı kimliği'),
    status: eventStatus(value.status),
  };
}

export async function adminListEvents(): Promise<{ events: AdminEvent[]; reservations: AdminEventReservation[] }> {
  const { data, error } = await supabase.rpc('admin_list_events_v1');
  const raw = unwrap<unknown>(data, error);
  if (!isRecord(raw) || !Array.isArray(raw.events) || !Array.isArray(raw.reservations)) {
    throw new Error('Etkinlik yönetim cevabı doğrulanamadı.');
  }
  if (raw.events.length > 10000 || raw.reservations.length > 100000) throw new Error('Etkinlik yönetim cevabı beklenen sınırı aşıyor.');
  return {
    events: raw.events.map(normalizeEvent),
    reservations: raw.reservations.map(normalizeReservation),
  };
}

export async function adminSaveEvent(input: {
  reference?: string | null;
  title: string;
  description?: string | null;
  image?: string | null;
  location: string;
  startsAt: string;
}) {
  const title = input.title.trim();
  const description = String(input.description || '').trim();
  const location = input.location.trim();
  const image = normalizePersistentImage(input.image);
  if (title.length < 2 || title.length > 180) throw new Error('Etkinlik adı 2 ile 180 karakter arasında olmalıdır.');
  if (description.length > 20000) throw new Error('Etkinlik açıklaması 20000 karakteri aşamaz.');
  if (location.length > 500) throw new Error('Etkinlik konumu 500 karakteri aşamaz.');
  const date = new Date(input.startsAt);
  if (!input.startsAt || Number.isNaN(date.getTime())) throw new Error('Etkinlik tarihi geçersiz.');
  const reference = input.reference == null ? null : requiredText(input.reference, 'Etkinlik referansı', 200);
  const { data, error } = await supabase.rpc('management_upsert_event_v1', {
    p_reference: reference,
    p_payload: {
      title,
      description,
      image,
      location,
      date: date.toISOString(),
    },
  });
  return normalizeMutationResult(unwrap<unknown>(data, error));
}

export async function adminArchiveEvent(reference: string) {
  const normalized = requiredText(reference, 'Etkinlik referansı', 200);
  const { data, error } = await supabase.rpc('management_archive_event_v1', { p_reference: normalized });
  const result = unwrap<unknown>(data, error);
  if (result !== true) throw new Error('Etkinlik arşivleme sonucu doğrulanamadı.');
  return true;
}

export async function adminCancelEventReservation(reservationId: string) {
  const id = uuid(reservationId, 'Rezervasyon kimliği');
  const { data, error } = await supabase.rpc('management_cancel_event_reservation_v1', { p_reservation_id: id });
  const result = unwrap<unknown>(data, error);
  if (result !== true) throw new Error('Rezervasyon iptal sonucu doğrulanamadı.');
  return true;
}

export function eventAdminErrorMessage(error: unknown, fallback = 'Etkinlik işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['event_not_found', 'Etkinlik artık bulunamadı. Listeyi yenileyin.'],
    ['reservation_not_found_or_cancelled', 'Rezervasyon bulunamadı veya zaten iptal edilmiş.'],
    ['invalid_event_payload', 'Etkinlik veri yapısı geçersiz.'],
    ['event_title_required', 'Etkinlik adı zorunludur.'],
    ['invalid_event_title', 'Etkinlik adı 2 ile 180 karakter arasında olmalıdır.'],
    ['invalid_event_date', 'Etkinlik tarihi geçersiz.'],
    ['event_date_required', 'Yeni etkinlik için tarih zorunludur.'],
    ['persistent_event_image_required', 'Geçici blob veya data URL etkinlik görseli olarak kaydedilemez.'],
    ['invalid_event_field_length', 'Etkinlik alanlarından biri izin verilen uzunluğu aşıyor.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}
