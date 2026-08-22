export type AppTheme = 'custom' | 'light' | 'dark' | 'emerald' | 'ruby' | 'champagne';

export type AppThemeOption = {
  id: AppTheme;
  label: string;
  description: string;
  surface: string;
  accent: string;
  text: string;
};

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  {
    id: 'custom',
    label: 'Golden Oremar Marka Teması',
    description: 'Super Admin tarafından canlı yönetilen fildişi, koyu orman ve rafine eski-altın resmi marka görünümü.',
    surface: '#F5F2E8',
    accent: '#0E4A31',
    text: '#18251F',
  },
  {
    id: 'emerald',
    label: 'Zümrüt Oremar',
    description: 'Porselen yüzeylerde derin zümrüt, kontrollü eski-altın ve yüksek okunabilirlik.',
    surface: '#EFF4EF',
    accent: '#0B6B49',
    text: '#0F2F23',
  },
  {
    id: 'ruby',
    label: 'Yakut Prestige',
    description: 'İnci pembesi yüzeylerde derin yakut, şampanya-altın detay ve rafine koyu tipografi.',
    surface: '#F8F2F3',
    accent: '#821C38',
    text: '#381721',
  },
  {
    id: 'dark',
    label: 'Obsidyen Gece',
    description: 'Obsidyen-orman yüzeylerde dengeli zümrüt ve metalik altın, gece kullanımında güçlü kontrast.',
    surface: '#07100D',
    accent: '#1F9D63',
    text: '#F4F3EE',
  },
  {
    id: 'light',
    label: 'İnci Beyazı',
    description: 'Yumuşak inci yüzey, koyu orman tipografi ve eski-altın vurgularla sade lüks görünüm.',
    surface: '#FAF9F5',
    accent: '#0E4A31',
    text: '#18251F',
  },
  {
    id: 'champagne',
    label: 'Şampanya Altın',
    description: 'Sıcak şampanya-krem yüzeylerde bronz altın, zeytin-orman vurgu ve rafine koyu metin.',
    surface: '#F6F0E2',
    accent: '#5F5428',
    text: '#342A18',
  },
];

const STORAGE_KEY = 'golden-oremar:appearance-theme:v2';
const LEGACY_STORAGE_KEY = 'golden-oremar:appearance-theme:v1';
const THEME_EVENT = 'golden-oremar:appearance-theme-change';

export function isTheme(value: unknown): value is AppTheme {
  return value === 'custom' || value === 'light' || value === 'dark' || value === 'emerald' || value === 'ruby' || value === 'champagne';
}

function readStored(key: string): AppTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function getStoredTheme(): AppTheme | null {
  return readStored(STORAGE_KEY) || readStored(LEGACY_STORAGE_KEY);
}

export function getSystemTheme(): AppTheme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function resolveInitialTheme(): AppTheme {
  return getStoredTheme() || getSystemTheme();
}

export function isDarkTheme(theme: AppTheme) {
  return theme === 'dark';
}

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = isDarkTheme(theme) ? 'dark' : 'light';
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in hardened/private environments.
  }
}

function emitThemeChange(theme: AppTheme) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppTheme>(THEME_EVENT, { detail: theme }));
}

export function subscribePersonalTheme(listener: (theme: AppTheme) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const next = (event as CustomEvent<unknown>).detail;
    if (isTheme(next)) listener(next);
  };
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}

export function setPersonalTheme(theme: AppTheme) {
  if (!isTheme(theme)) return;
  persistTheme(theme);
  applyThemeToDocument(theme);
  emitThemeChange(theme);
}
