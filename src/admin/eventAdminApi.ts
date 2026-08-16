import { supabase } from '../lib/supabase';

export type AdminEvent = {
  id: string;
  legacy_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  image_path: string | null;
  location_name: string | null;
  location_details: Record<string, any>;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  reservation_deadline: string | null;
  status: string;
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
  status: string;
  created_at: string;
  updated_at: string;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function adminListEvents(): Promise<{ events: AdminEvent[]; reservations: AdminEventReservation[] }> {
  const { data, error } = await supabase.rpc('admin_list_events_v1');
  const raw = unwrap<any>(data, error) || {};
  return {
    events: Array.isArray(raw.events) ? raw.events.map((event: any) => ({
      ...event,
      id: String(event.id),
      legacy_id: event.legacy_id ? String(event.legacy_id) : null,
      slug: String(event.slug || ''),
      title: String(event.title || 'İsimsiz etkinlik'),
      description: event.description ? String(event.description) : null,
      image_path: event.image_path ? String(event.image_path) : null,
      location_name: event.location_name ? String(event.location_name) : null,
      location_details: event.location_details && typeof event.location_details === 'object' ? event.location_details : {},
      starts_at: String(event.starts_at || ''),
      ends_at: event.ends_at ? String(event.ends_at) : null,
      capacity: event.capacity == null ? null : Number(event.capacity),
      reservation_deadline: event.reservation_deadline ? String(event.reservation_deadline) : null,
      status: String(event.status || 'draft'),
      reservation_count: Number(event.reservation_count || 0),
      reserved_guests: Number(event.reserved_guests || 0),
    })) : [],
    reservations: Array.isArray(raw.reservations) ? raw.reservations.map((reservation: any) => ({
      ...reservation,
      id: String(reservation.id),
      event_id: String(reservation.event_id),
      event_title: String(reservation.event_title || 'Etkinlik'),
      event_starts_at: String(reservation.event_starts_at || ''),
      reservation_code: String(reservation.reservation_code || reservation.id),
      user_id: reservation.user_id ? String(reservation.user_id) : null,
      guest_name: String(reservation.guest_name || 'Misafir'),
      guest_email: String(reservation.guest_email || ''),
      guest_phone: reservation.guest_phone ? String(reservation.guest_phone) : null,
      guest_count: Number(reservation.guest_count || 1),
      notes: reservation.notes ? String(reservation.notes) : null,
      status: String(reservation.status || 'confirmed'),
    })) : [],
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
  const location = input.location.trim();
  if (title.length < 2 || title.length > 180) throw new Error('Etkinlik adı 2 ile 180 karakter arasında olmalıdır.');
  if ((input.description || '').length > 20000) throw new Error('Etkinlik açıklaması 20000 karakteri aşamaz.');
  if (location.length > 500) throw new Error('Etkinlik konumu 500 karakteri aşamaz.');
  if ((input.image || '').length > 2048) throw new Error('Etkinlik görsel yolu çok uzun.');
  const date = new Date(input.startsAt);
  if (Number.isNaN(date.getTime())) throw new Error('Etkinlik tarihi geçersiz.');
  const { data, error } = await supabase.rpc('management_upsert_event_v1', {
    p_reference: input.reference || null,
    p_payload: {
      title,
      description: input.description?.trim() || '',
      image: input.image?.trim() || '',
      location,
      date: date.toISOString(),
    },
  });
  return unwrap<any>(data, error);
}

export async function adminArchiveEvent(reference: string) {
  const { data, error } = await supabase.rpc('management_archive_event_v1', { p_reference: reference });
  return unwrap<boolean>(data, error);
}

export async function adminCancelEventReservation(reservationId: string) {
  const { data, error } = await supabase.rpc('management_cancel_event_reservation_v1', { p_reservation_id: reservationId });
  return unwrap<boolean>(data, error);
}

export function eventAdminErrorMessage(error: unknown, fallback = 'Etkinlik işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['event_not_found', 'Etkinlik artık bulunamadı. Listeyi yenileyin.'],
    ['reservation_not_found_or_cancelled', 'Rezervasyon bulunamadı veya zaten iptal edilmiş.'],
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
