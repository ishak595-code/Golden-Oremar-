import { supabase } from '../../lib/supabase';

export type StorefrontInterface = {
  heroTitle: string;
  heroSubtitle: string;
  heroButtonText: string;
  featuredTitle: string;
  seasonalTitle: string;
  categoriesTitle: string;
  footerText: string | null;
};

export type StorefrontHomeSection = {
  id: string;
  title: string;
  active: boolean;
};

export type StorefrontHeroCategory = {
  id: string;
  icon: string | null;
  image: string | null;
  title: string;
  subtitle: string;
  targetCategory: string;
};

export type StorefrontConfig = {
  brand: {
    name: string;
    slug: string;
    defaultLocale: string;
    defaultCurrency: string;
  };
  interface: StorefrontInterface;
  homeSections: StorefrontHomeSection[];
  heroCategories: StorefrontHeroCategory[];
  salesReadiness: {
    status: string;
    message: string;
  };
  updatedAt: string;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, label: string, max = 1000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function safeLocale(value: unknown, label = 'Dil') {
  const locale = requiredText(value, label, 16);
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) throw new Error(`${label} doğrulanamadı.`);
  return locale;
}

function safeCurrency(value: unknown) {
  const currency = requiredText(value, 'Varsayılan para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Varsayılan para birimi doğrulanamadı.');
  return currency;
}

function safeAssetPath(value: unknown, label: string) {
  const path = optionalText(value, label, 1200);
  if (!path) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`${label} doğrulanamadı.`);
  return path;
}

function normalizeStorefrontConfig(value: unknown): StorefrontConfig {
  if (!isRecord(value) || !isRecord(value.brand) || !isRecord(value.interface) || !isRecord(value.salesReadiness)) throw new Error('Mağaza arayüz ayarları sunucudan doğrulanamadı.');
  if (!Array.isArray(value.homeSections) || value.homeSections.length > 40) throw new Error('Ana sayfa bölüm ayarları doğrulanamadı.');
  if (!Array.isArray(value.heroCategories) || value.heroCategories.length > 30) throw new Error('Vitrin kategori ayarları doğrulanamadı.');

  const homeSections = value.homeSections.map((section: unknown, index: number): StorefrontHomeSection => {
    if (!isRecord(section) || typeof section.active !== 'boolean') throw new Error(`${index + 1}. ana sayfa bölümü doğrulanamadı.`);
    return {
      id: requiredText(section.id, 'Ana sayfa bölüm kimliği', 80),
      title: requiredText(section.title, 'Ana sayfa bölüm başlığı', 160),
      active: section.active,
    };
  });
  if (new Set(homeSections.map(section => section.id)).size !== homeSections.length) throw new Error('Ana sayfa bölüm kimlikleri tekrar ediyor.');

  const heroCategories = value.heroCategories.map((category: unknown, index: number): StorefrontHeroCategory => {
    if (!isRecord(category)) throw new Error(`${index + 1}. vitrin kategorisi doğrulanamadı.`);
    return {
      id: requiredText(category.id, 'Vitrin kategori kimliği', 100),
      icon: optionalText(category.icon, 'Vitrin kategori ikonu', 80),
      image: safeAssetPath(category.image, 'Vitrin kategori görseli'),
      title: requiredText(category.title, 'Vitrin kategori başlığı', 160),
      subtitle: requiredText(category.subtitle, 'Vitrin kategori açıklaması', 240),
      targetCategory: requiredText(category.targetCategory, 'Vitrin hedef kategorisi', 220),
    };
  });
  if (new Set(heroCategories.map(category => category.id)).size !== heroCategories.length) throw new Error('Vitrin kategori kimlikleri tekrar ediyor.');

  const updatedAt = requiredText(value.updatedAt, 'Mağaza ayarı güncelleme zamanı', 80);
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error('Mağaza ayarı güncelleme zamanı doğrulanamadı.');

  return {
    brand: {
      name: requiredText(value.brand.name, 'Marka adı', 120),
      slug: requiredText(value.brand.slug, 'Marka bağlantısı', 120),
      defaultLocale: safeLocale(value.brand.defaultLocale, 'Varsayılan dil'),
      defaultCurrency: safeCurrency(value.brand.defaultCurrency),
    },
    interface: {
      heroTitle: requiredText(value.interface.heroTitle, 'Ana vitrin başlığı', 180),
      heroSubtitle: requiredText(value.interface.heroSubtitle, 'Ana vitrin açıklaması', 500),
      heroButtonText: requiredText(value.interface.heroButtonText, 'Ana vitrin buton metni', 80),
      featuredTitle: requiredText(value.interface.featuredTitle, 'Öne çıkanlar başlığı', 160),
      seasonalTitle: requiredText(value.interface.seasonalTitle, 'Mevsimlik ürün başlığı', 160),
      categoriesTitle: requiredText(value.interface.categoriesTitle, 'Kategori başlığı', 160),
      footerText: optionalText(value.interface.footerText, 'Alt bilgi metni', 500),
    },
    homeSections,
    heroCategories,
    salesReadiness: {
      status: requiredText(value.salesReadiness.status, 'Satış hazırlık durumu', 100),
      message: requiredText(value.salesReadiness.message, 'Satış hazırlık açıklaması', 500),
    },
    updatedAt,
  };
}

export async function getPublicStorefrontConfig(locale = 'tr'): Promise<StorefrontConfig> {
  const requestedLocale = safeLocale(locale, 'İstenen dil');
  const { data, error } = await supabase.rpc('get_public_storefront_config_v1', {
    p_locale: requestedLocale,
  });
  return normalizeStorefrontConfig(unwrap<unknown>(data, error));
}

export async function getPublicInfoPages(locale = 'tr') {
  const requestedLocale = safeLocale(locale, 'İstenen dil');
  const { data, error } = await supabase.rpc('get_account_help_content_v1', {
    p_locale: requestedLocale,
  });
  return unwrap<any>(data, error);
}
