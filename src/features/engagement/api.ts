import { supabase } from '../../lib/supabase';

export type PublicEvent = {
  id: string;
  legacyId?: string | null;
  slug: string;
  title: string;
  description: string;
  imagePath?: string | null;
  locationName: string;
  startsAt: string;
  endsAt: string;
  capacity?: number | null;
  remainingCapacity?: number | null;
  reservationDeadline?: string | null;
  status: 'published' | 'sold_out' | 'completed';
  reservable: boolean;
  waitlistOnly: boolean;
};

export type PublicEventsResult = {
  items: PublicEvent[];
  upcomingCount: number;
  pastCount: number;
};

export type MyEventReservation = {
  id: string;
  eventId: string;
  reservationCode: string;
  guestName: string;
  guestCount: number;
  status: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    locationName: string;
    status: string;
    imagePath?: string | null;
  } | null;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function requiredText(value: unknown, label: string, max: number) {
  const normalized = boundedText(value, max + 1);
  if (!normalized || normalized.length > max) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function safeDate(value: unknown, label: string) {
  const normalized = requiredText(value, label, 80);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function optionalDate(value: unknown, label: string) {
  if (value == null || value === '') return null;
  return safeDate(value, label);
}

function nonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizePublicEvent(value: unknown): PublicEvent | null {
  if (!isRecord(value)) return null;
  try {
    const status = boundedText(value.status, 40);
    if (!['published', 'sold_out', 'completed'].includes(status)) return null;
    const capacity = value.capacity == null ? null : nonNegativeInteger(value.capacity);
    const remainingCapacity = value.remainingCapacity == null ? null : nonNegativeInteger(value.remainingCapacity);
    if (value.capacity != null && capacity == null) return null;
    if (value.remainingCapacity != null && remainingCapacity == null) return null;
    if (typeof value.reservable !== 'boolean' || typeof value.waitlistOnly !== 'boolean') return null;
    const startsAt = safeDate(value.startsAt, 'Etkinlik başlangıç tarihi');
    const endsAt = safeDate(value.endsAt, 'Etkinlik bitiş tarihi');
    if (Date.parse(endsAt) < Date.parse(startsAt)) return null;
    return {
      id: requiredText(value.id, 'Etkinlik kimliği', 160),
      legacyId: value.legacyId == null ? null : boundedText(value.legacyId, 160),
      slug: requiredText(value.slug, 'Etkinlik bağlantısı', 220),
      title: requiredText(value.title, 'Etkinlik başlığı', 240),
      description: requiredText(value.description, 'Etkinlik açıklaması', 5000),
      imagePath: value.imagePath == null ? null : boundedText(value.imagePath, 1000),
      locationName: requiredText(value.locationName, 'Etkinlik konumu', 300),
      startsAt,
      endsAt,
      capacity,
      remainingCapacity,
      reservationDeadline: optionalDate(value.reservationDeadline, 'Etkinlik kayıt son tarihi'),
      status: status as PublicEvent['status'],
      reservable: value.reservable,
      waitlistOnly: value.waitlistOnly,
    };
  } catch {
    return null;
  }
}

function normalizePublicEvents(value: unknown): PublicEventsResult {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new Error('Etkinlik listesi sunucudan doğrulanamadı.');
  if (value.items.length > 200) throw new Error('Etkinlik listesi beklenenden büyük.');
  const items = value.items.map(normalizePublicEvent).filter((item): item is PublicEvent => Boolean(item));
  const now = Date.now();
  return {
    items,
    upcomingCount: items.filter(item => Date.parse(item.endsAt) >= now).length,
    pastCount: items.filter(item => Date.parse(item.endsAt) < now).length,
  };
}

function normalizeReservation(value: unknown): MyEventReservation | null {
  if (!isRecord(value)) return null;
  const statuses = new Set(['pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show']);
  const status = boundedText(value.status, 40);
  const guestCount = nonNegativeInteger(value.guest_count);
  if (!statuses.has(status) || guestCount == null || guestCount < 1 || guestCount > 20) return null;
  const rawEvent = Array.isArray(value.event) ? value.event[0] : value.event;
  let event: MyEventReservation['event'] = null;
  if (isRecord(rawEvent)) {
    try {
      event = {
        id: requiredText(rawEvent.id, 'Etkinlik kimliği', 160),
        slug: requiredText(rawEvent.slug, 'Etkinlik bağlantısı', 220),
        title: requiredText(rawEvent.title, 'Etkinlik başlığı', 240),
        startsAt: safeDate(rawEvent.starts_at, 'Etkinlik başlangıç tarihi'),
        endsAt: safeDate(rawEvent.ends_at, 'Etkinlik bitiş tarihi'),
        locationName: requiredText(rawEvent.location_name, 'Etkinlik konumu', 300),
        status: requiredText(rawEvent.status, 'Etkinlik durumu', 40),
        imagePath: rawEvent.image_path == null ? null : boundedText(rawEvent.image_path, 1000),
      };
    } catch {
      event = null;
    }
  }
  try {
    return {
      id: requiredText(value.id, 'Etkinlik kayıt kimliği', 160),
      eventId: requiredText(value.event_id, 'Etkinlik kimliği', 160),
      reservationCode: requiredText(value.reservation_code, 'Etkinlik kayıt kodu', 120),
      guestName: requiredText(value.guest_name, 'Etkinlik kayıt sahibi', 120),
      guestCount,
      status: status as MyEventReservation['status'],
      createdAt: safeDate(value.created_at, 'Etkinlik kayıt tarihi'),
      updatedAt: safeDate(value.updated_at, 'Etkinlik güncelleme tarihi'),
      event,
    };
  } catch {
    return null;
  }
}

function idempotencyKey(scope: string) {
  return `${scope}_${Date.now()}_${crypto.randomUUID().replaceAll('-', '')}`;
}

export async function getPublicContactConfig() {
  const { data, error } = await supabase.rpc('get_public_contact_config_v1');
  return unwrap<any>(data, error);
}

export async function submitContactForm(input: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  locale?: string;
  website?: string;
}) {
  const key = idempotencyKey('contact');
  const { data, error } = await supabase.functions.invoke('contact-submit', {
    body: {
      ...input,
      locale: input.locale || 'tr',
      source: 'mobile-app',
      idempotencyKey: key,
    },
    headers: { 'x-idempotency-key': key },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(String(data.error || 'submission_failed'));
  return data;
}

export async function listPublicEvents(includePast = true): Promise<PublicEventsResult> {
  const { data, error } = await supabase.rpc('list_public_events_v1', {
    p_include_past: includePast,
  });
  return normalizePublicEvents(unwrap<unknown>(data, error));
}

export async function listMyEventReservations(limit = 30): Promise<MyEventReservation[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Etkinlik kayıt liste sınırı geçersiz.');
  const { data, error } = await supabase.rpc('list_my_event_reservations_v1', { p_limit: limit });
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > limit) throw new Error('Etkinlik kayıtlarınız sunucudan doğrulanamadı.');
  return rows.map(normalizeReservation).filter((item): item is MyEventReservation => Boolean(item));
}

export async function submitEventReservation(input: {
  eventReference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCount: number;
  notes?: string;
  website?: string;
}) {
  const eventReference = requiredText(input.eventReference, 'Etkinlik referansı', 200);
  const guestName = requiredText(input.guestName, 'Ad soyad', 120);
  const guestEmail = requiredText(input.guestEmail, 'E-posta', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) throw new Error('invalid_email');
  const guestPhone = requiredText(input.guestPhone, 'Telefon', 40);
  const phoneDigits = guestPhone.replace(/\D/g, '').length;
  if (phoneDigits < 7 || phoneDigits > 20) throw new Error('invalid_phone');
  if (!Number.isSafeInteger(input.guestCount) || input.guestCount < 1 || input.guestCount > 20) throw new Error('invalid_guest_count');
  const notes = boundedText(input.notes, 1001);
  if (notes.length > 1000) throw new Error('invalid_notes');
  const key = idempotencyKey('event');
  const { data, error } = await supabase.functions.invoke('event-reservation', {
    body: { eventReference, guestName, guestEmail, guestPhone, guestCount: input.guestCount, notes, website: boundedText(input.website, 200), idempotencyKey: key },
    headers: { 'x-idempotency-key': key },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(String(data.error || 'submission_failed'));
  return data;
}

export function publicContentUrl(path?: string | null) {
  const raw = typeof path === 'string' ? path.trim() : '';
  if (!raw || /[\u0000-\u001F\u007F]/.test(raw)) return '';
  if (/^https:\/\//i.test(raw)) {
    try { return new URL(raw).toString(); } catch { return ''; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
  const normalized = raw.replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some(part => part === '..' || part === '.' || !part)) return '';
  return supabase.storage.from('content-public').getPublicUrl(normalized).data.publicUrl;
}
