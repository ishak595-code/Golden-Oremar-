import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getProducerFinance() {
  const { data, error } = await supabase.rpc('get_my_producer_finance_summary_v1');
  return unwrap<any[]>(data, error) || [];
}

export async function listProducerPayouts(limit = 20, offset = 0) {
  const { data, error } = await supabase.rpc('list_my_producer_payouts_v1', {
    p_limit: limit,
    p_offset: offset,
  });
  return unwrap<any[]>(data, error) || [];
}
