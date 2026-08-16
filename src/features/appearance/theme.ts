export type AppTheme = 'light' | 'dark';
export type PremiumPalette = 'emerald' | 'ruby' | 'obsidian' | 'pearl' | 'sapphire';

export const PREMIUM_PALETTES: ReadonlyArray<{
  id: PremiumPalette;
  name: string;
  description: string;
  swatches: readonly [string, string, string];
}> = [
  { id: 'emerald', name: 'Oremar Zümrüt', description: 'Derin zümrüt, sıcak altın ve köy doğasının prestijli imzası.', swatches: ['#11643A', '#D4AF37', '#F3F7F4'] },
  { id: 'ruby', name: 'Yakut & Fildişi', description: 'Yakut kırmızısı, fildişi ve dengeli altın vurgular.', swatches: ['#8E1738', '#B58A24', '#FFF9F1'] },
  { id: 'obsidian', name: 'Obsidyen Altın', description: 'Siyah taş karakteri, antik altın ve güçlü premium kontrast.', swatches: ['#161A18', '#C39A35', '#F2EFE7'] },
  { id: 'pearl', name: 'İnci Beyazı', description: 'Temiz inci yüzeyler, koyu yeşil ve zarif bronz dokunuşlar.', swatches: ['#F8F6EF', '#174A35', '#9A6D2F'] },
  { id: 'sapphire', name: 'Dağ Safiri', description: 'Gece mavisi, buz safiri ve altınla sakin bir lüks hissi.', swatches: ['#15395A', '#2C79A4', '#D2A94F'] },
] as const;

const THEME_STORAGE_KEY = 'golden-oremar:appearance-theme:v1';
const PALETTE_STORAGE_KEY = 'golden-oremar:premium-palette:v1';

function isTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark';
}

function isPalette(value: unknown): value is PremiumPalette {
  return PREMIUM_PALETTES.some(option => option.id === value);
}

export function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function getStoredPalette(): PremiumPalette | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPalette(value) ? value : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): AppTheme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function resolveInitialTheme(): AppTheme {
  return getStoredTheme() || getSystemTheme();
}

export function resolveInitialPalette(): PremiumPalette {
  return getStoredPalette() || 'emerald';
}

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function applyPaletteToDocument(palette: PremiumPalette) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-palette', palette);
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable in hardened/private environments.
  }
}

export function persistPalette(palette: PremiumPalette) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // Storage may be unavailable in hardened/private environments.
  }
}

export function setPersonalTheme(theme: AppTheme) {
  persistTheme(theme);
  applyThemeToDocument(theme);
}

export function setPersonalPalette(palette: PremiumPalette) {
  persistPalette(palette);
  applyPaletteToDocument(palette);
}
