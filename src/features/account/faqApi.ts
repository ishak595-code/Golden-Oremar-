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

export async function listPublicFaq(locale = 'tr'): Promise<PublicFaqResponse> {
  const { data, error } = await supabase.rpc('list_public_faq_v1', {
    p_locale: locale,
  });
  if (error) throw error;
  const raw = (data || {}) as Partial<PublicFaqResponse>;
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    locale: typeof raw.locale === 'string' ? raw.locale : 'tr',
    fallbackUsed: raw.fallbackUsed === true,
    total: Number.isFinite(Number(raw.total)) ? Number(raw.total) : items.length,
    items: items.map((item: any) => ({
      id: String(item?.id || ''),
      slug: String(item?.slug || ''),
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
      category: String(item?.category || 'Diğer').trim() || 'Diğer',
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : 999,
      tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
      updatedAt: item?.updatedAt ? String(item.updatedAt) : undefined,
    })).filter(item => item.id && item.question && item.answer),
  };
}
