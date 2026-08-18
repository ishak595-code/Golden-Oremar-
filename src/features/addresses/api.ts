import { supabase } from '../../lib/supabase';

export type InternationalAddressInput = {
  id?: string | null;
  label: string;
  recipientName: string;
  phone: string;
  countryCode: string;
  administrativeArea?: string | null;
  city: string;
  locality?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  postalCode?: string | null;
  deliveryNotes?: string | null;
  isDefault?: boolean;
};

export type SavedAddressRecord = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  countryCode: string;
  administrativeArea: string;
  city: string;
  locality: string;
  addressLine: string;
  postalCode: string;
  deliveryNotes: string;
  isDefault: boolean;
};

function text(value: unknown, label: string, min: number, max: number, optional = false) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (optional && !normalized) return '';
  if (normalized.length < min || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function uuid(value: unknown, label: string, optional = false) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (optional && !normalized) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function country(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Ülke kodu iki harfli ISO kodu olmalıdır.');
  return normalized;
}

function phone(value: unknown) {
  const normalized = text(value, 'Telefon', 5, 40);
  const digits = normalized.replace(/\D/g, '').length;
  if (digits < 7 || digits > 20) throw new Error('Telefon 7 ile 20 rakam içermelidir.');
  return normalized;
}

function normalizeResponse(value: unknown): SavedAddressRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Kaydedilen adres sunucudan doğrulanamadı.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.is_default !== 'boolean') throw new Error('Adres varsayılan durumu doğrulanamadı.');
  return {
    id: uuid(raw.id, 'Adres kimliği')!,
    label: text(raw.label, 'Adres etiketi', 1, 60),
    recipientName: text(raw.recipient_name, 'Alıcı adı', 2, 120),
    phone: phone(raw.phone),
    countryCode: country(raw.country_code),
    administrativeArea: text(raw.province, 'İl veya bölge', 1, 120),
    city: text(raw.district, 'Şehir', 1, 120),
    locality: text(raw.neighborhood, 'Mahalle veya köy', 0, 160, true),
    addressLine: text(raw.address_line, 'Açık adres', 5, 1000),
    postalCode: text(raw.postal_code, 'Posta kodu', 0, 30, true),
    deliveryNotes: text(raw.delivery_notes, 'Teslimat notu', 0, 500, true),
    isDefault: raw.is_default,
  };
}

export async function saveCustomerAddress(input: InternationalAddressInput): Promise<SavedAddressRecord> {
  const addressId = uuid(input.id, 'Adres kimliği', true);
  const label = text(input.label || 'Teslimat', 'Adres etiketi', 1, 60);
  const recipientName = text(input.recipientName, 'Alıcı adı', 2, 120);
  const normalizedPhone = phone(input.phone);
  const countryCode = country(input.countryCode);
  const administrativeArea = text(input.administrativeArea, 'İl veya bölge', 0, 120, true);
  const city = text(input.city, 'Şehir veya ilçe', 1, 120);
  const locality = text(input.locality, 'Mahalle veya köy', 0, 160, true);
  const addressLine1 = text(input.addressLine1, 'Açık adres', 5, 1000);
  const addressLine2 = text(input.addressLine2, 'Adres devamı', 0, 500, true);
  if (addressLine1.length + (addressLine2 ? addressLine2.length + 1 : 0) > 1000) throw new Error('Açık adres toplamda en fazla 1000 karakter olabilir.');
  const postalCode = text(input.postalCode, 'Posta kodu', 0, 30, true);
  const deliveryNotes = text(input.deliveryNotes, 'Teslimat notu', 0, 500, true);

  const { data, error } = await supabase.rpc('upsert_customer_address_v2', {
    p_address_id: addressId,
    p_label: label,
    p_recipient_name: recipientName,
    p_phone: normalizedPhone,
    p_country_code: countryCode,
    p_administrative_area: administrativeArea || null,
    p_city: city,
    p_locality: locality || null,
    p_address_line1: addressLine1,
    p_address_line2: addressLine2 || null,
    p_postal_code: postalCode || null,
    p_delivery_notes: deliveryNotes || null,
    p_is_default: input.isDefault === true,
  });
  if (error) throw error;
  return normalizeResponse(data);
}
