import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
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

export async function listPublicEvents(includePast = true) {
  const { data, error } = await supabase.rpc('list_public_events_v1', {
    p_include_past: includePast,
  });
  return unwrap<any>(data, error);
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
  const key = idempotencyKey('event');
  const { data, error } = await supabase.functions.invoke('event-reservation', {
    body: { ...input, idempotencyKey: key },
    headers: { 'x-idempotency-key': key },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(String(data.error || 'submission_failed'));
  return data;
}

export function publicContentUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('content-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
