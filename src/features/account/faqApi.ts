import { supabase } from '../../lib/supabase';

export type PublicFaqItem = {
  id: string;
  slug: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  tags: string[];
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
  return {
    locale: String(raw.locale || 'tr'),
    fallbackUsed: raw.fallbackUsed === true,
    total: Math.max(0, Number(raw.total || 0)),
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}
