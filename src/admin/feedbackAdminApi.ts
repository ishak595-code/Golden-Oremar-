import { supabase } from '../lib/supabase';

/** Geri bildirim and contact-form messages (admins only; enforced in the database). */
export type FeedbackFilter = 'all' | 'unread' | 'read' | 'resolved';
export type FeedbackStatus = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'spam';
export type FeedbackSummary = { id: string; createdAt: string; status: FeedbackStatus; source: string; subject: string; category: string; preview: string; guest: boolean; userName: string | null; senderName: string | null };
export type FeedbackDetail = FeedbackSummary & { message: string; email: string | null; phone: string | null; locale: string | null; readAt: string | null; readBy: string | null; resolvedAt: string | null; resolvedBy: string | null };
export type FeedbackPage = { total: number; unreadCount: number; items: FeedbackSummary[] };

export const FEEDBACK_CHANGED_EVENT = 'golden-oremar:admin-feedback-changed';
const STATUSES = new Set<FeedbackStatus>(['new', 'assigned', 'in_progress', 'resolved', 'spam']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0);

function summary(v: unknown): FeedbackSummary | null {
  if (!rec(v) || !UUID_RE.test(str(v.id, 40))) return null;
  const status = str(v.status, 20) as FeedbackStatus;
  return {
    id: str(v.id, 40), createdAt: str(v.createdAt, 40), status: STATUSES.has(status) ? status : 'new', source: str(v.source, 40),
    subject: str(v.subject, 200), category: str(v.category, 120) || 'Geri bildirim', preview: str(v.preview, 200),
    guest: v.guest === true, userName: str(v.userName, 120) || null, senderName: str(v.senderName, 120) || null,
  };
}

export function feedbackSender(item: Pick<FeedbackSummary, 'guest' | 'userName' | 'senderName'>) {
  return item.guest ? `Misafir${item.senderName ? ` · ${item.senderName}` : ''}` : item.userName || 'Üye';
}

export async function listFeedback(filter: FeedbackFilter, limit = 30, offset = 0): Promise<FeedbackPage> {
  const { data, error } = await supabase.rpc('admin_list_contact_messages_v1', { p_status: filter, p_limit: limit, p_offset: offset });
  if (error) throw error;
  if (!rec(data) || !Array.isArray(data.items)) throw new Error('Geri bildirim listesi doğrulanamadı.');
  return { total: num(data.total), unreadCount: num(data.unreadCount), items: data.items.map(summary).filter((x): x is FeedbackSummary => !!x) };
}

export async function getFeedback(id: string): Promise<FeedbackDetail> {
  const { data, error } = await supabase.rpc('admin_get_contact_message_v1', { p_id: id });
  if (error) throw error;
  const base = summary(data);
  if (!base || !rec(data)) throw new Error('Geri bildirim doğrulanamadı.');
  return {
    ...base, message: str(data.message, 10000), email: str(data.email, 254) || null, phone: str(data.phone, 40) || null, locale: str(data.locale, 10) || null,
    readAt: str(data.readAt, 40) || null, readBy: str(data.readBy, 120) || null, resolvedAt: str(data.resolvedAt, 40) || null, resolvedBy: str(data.resolvedBy, 120) || null,
  };
}

export async function updateFeedback(id: string, action: 'read' | 'unread' | 'resolve' | 'reopen') {
  const { data, error } = await supabase.rpc('admin_update_contact_message_v1', { p_id: id, p_action: action });
  if (error) throw error;
  const status = rec(data) ? (str(data.status, 20) as FeedbackStatus) : 'new';
  const unreadCount = rec(data) ? num(data.unreadCount) : 0;
  try { window.dispatchEvent(new CustomEvent(FEEDBACK_CHANGED_EVENT, { detail: { unreadCount } })); } catch { /* not in a browser */ }
  return { status: STATUSES.has(status) ? status : 'new', unreadCount };
}

export async function getUnreadFeedbackCount() {
  const { data, error } = await supabase.rpc('admin_contact_messages_unread_count_v1');
  if (error) throw error;
  return num(data);
}

export function feedbackAdminError(error: unknown) {
  const message = String((error as { message?: unknown })?.message || '');
  if (/admin_required|permission denied/i.test(message)) return 'Bu alanı yalnız yöneticiler görebilir.';
  if (/not_found/.test(message)) return 'Bu mesaj bulunamadı; silinmiş olabilir.';
  if (/restricted|quota|fetch|network|Failed|timeout/i.test(message)) return 'Mesajlar şu anda yüklenemedi. Bağlantı gelince tekrar deneyin.';
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}
