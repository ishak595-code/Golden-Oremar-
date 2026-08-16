import { supabase } from '../lib/supabase';

export async function listPublicProducers(params: {
  query?: string;
  province?: string;
  district?: string;
  village?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { data, error } = await supabase.rpc('list_public_producers_v1', {
    p_query: params.query ?? null,
    p_province: params.province ?? null,
    p_district: params.district ?? null,
    p_village: params.village ?? null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return data;
}

export async function getPublicProducerProfile(reference: string) {
  const { data, error } = await supabase.rpc('get_public_producer_profile_v1', {
    p_reference: reference,
  });
  if (error) throw error;
  return data;
}

export async function getMyProducerProfile() {
  const { data, error } = await supabase.rpc('get_my_producer_profile_v1');
  if (error) throw error;
  return data;
}

export async function updateMyProducerProfile(input: {
  displayName: string;
  description: string;
  story: string;
  logoPath?: string | null;
  coverPath?: string | null;
}) {
  const { data, error } = await supabase.rpc('update_my_producer_profile_v2', {
    p_display_name: input.displayName,
    p_description: input.description,
    p_story: input.story,
    p_logo_path: input.logoPath ?? null,
    p_cover_path: input.coverPath ?? null,
  });
  if (error) throw error;
  return data;
}
