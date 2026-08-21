import { supabase } from '../../lib/supabase';

export type PublicFaqItem = {
  id: string;
  slug: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  tags?: string[];
  updatedAt?: string;
};

export type PublicFaqResponse = {
  locale: string;
  fallbackUsed: boolean;
  total: number;
  items: PublicFaqItem[];
};

function normalizeLocale(value: unknown) {
  const locale = String(value || 'tr').trim().toLowerCase().replace('_', '-');
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(locale) ? locale.slice(0, 16) : 'tr';
}

function safeNonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function listPublicFaq(locale = 'tr'): Promise<PublicFaqResponse> {
  const requestedLocale = normalizeLocale(locale);
  const { data, error } = await supabase.rpc('list_public_faq_v1', {
    p_locale: requestedLocale,
  });
  if (error) throw error;
  const raw = (data || {}) as Partial<PublicFaqResponse>;
  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = items.map((item: any) => ({
    id: String(item?.id || '').trim().slice(0, 200),
    slug: String(item?.slug || '').trim().slice(0, 200),
    question: String(item?.question || '').trim().slice(0, 1000),
    answer: String(item?.answer || '').trim().slice(0, 20000),
    category: (String(item?.category || 'Diğer').trim() || 'Diğer').slice(0, 160),
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : 999,
    tags: Array.isArray(item?.tags)
      ? item.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 20).map(tag => tag.slice(0, 80))
      : [],
    updatedAt: item?.updatedAt ? String(item.updatedAt).slice(0, 64) : undefined,
  })).filter(item => item.id && item.question && item.answer);

  return {
    locale: normalizeLocale(raw.locale || requestedLocale),
    fallbackUsed: raw.fallbackUsed === true,
    total: safeNonNegativeInteger(raw.total, normalizedItems.length),
    items: normalizedItems,
  };
}
