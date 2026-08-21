import { supabase } from '../../lib/supabase';
import { applyThemeToDocument, getStoredTheme, isTheme, subscribePersonalTheme, type AppTheme } from './theme';

export type BrandAppearanceTokens = {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  brandGold: string;
  brandGreen: string;
  brandEarth: string;
  onGold: string;
  onGreen: string;
};

export type BrandAppearance = {
  defaultTheme: AppTheme;
  colorScheme: 'light' | 'dark';
  tokens: BrandAppearanceTokens;
  updatedAt?: string | null;
};

const TOKEN_KEYS: Array<keyof BrandAppearanceTokens> = [
  'background','card','text','muted','border','brandGold','brandGreen','brandEarth','onGold','onGreen',
];
const HEX = /^#[0-9A-F]{6}$/;
const STYLE_ID = 'golden-oremar-brand-appearance';
let activeAppearance: BrandAppearance | null = null;
let themeSubscriptionInstalled = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeHex(value: unknown, label: string) {
  const color = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!HEX.test(color)) throw new Error(`${label} doğrulanamadı.`);
  return color;
}

function normalize(value: unknown): BrandAppearance {
  if (!isRecord(value) || !isRecord(value.tokens)) throw new Error('Marka görünümü sunucudan doğrulanamadı.');
  if (!isTheme(value.defaultTheme)) throw new Error('Varsayılan marka teması doğrulanamadı.');
  if (value.colorScheme !== 'light' && value.colorScheme !== 'dark') throw new Error('Marka renk şeması doğrulanamadı.');
  const tokens = {} as BrandAppearanceTokens;
  for (const key of TOKEN_KEYS) tokens[key] = safeHex(value.tokens[key], `Marka rengi ${key}`);
  const updatedAt = value.updatedAt == null ? null : String(value.updatedAt);
  if (updatedAt && Number.isNaN(Date.parse(updatedAt))) throw new Error('Marka görünümü güncelleme tarihi doğrulanamadı.');
  const appearance = { defaultTheme: value.defaultTheme, colorScheme: value.colorScheme, tokens, updatedAt };
  const issues = brandAppearanceContrastIssues(appearance);
  if (issues.length) throw new Error(issues[0]);
  return appearance;
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex: string) {
  const value = hex.slice(1);
  const r = channel(Number.parseInt(value.slice(0,2),16));
  const g = channel(Number.parseInt(value.slice(2,4),16));
  const b = channel(Number.parseInt(value.slice(4,6),16));
  return 0.2126*r + 0.7152*g + 0.0722*b;
}

export function contrastRatio(foreground: string, background: string) {
  const a = luminance(safeHex(foreground,'Ön plan rengi'));
  const b = luminance(safeHex(background,'Arka plan rengi'));
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

export function brandAppearanceContrastIssues(appearance: Pick<BrandAppearance,'tokens'>) {
  const { tokens } = appearance;
  const issues: string[] = [];
  if (contrastRatio(tokens.text,tokens.background) < 4.5) issues.push('Ana metin ile arka plan kontrastı en az 4.5:1 olmalıdır.');
  if (contrastRatio(tokens.onGreen,tokens.brandGreen) < 4.5) issues.push('Yeşil buton metni kontrastı en az 4.5:1 olmalıdır.');
  if (contrastRatio(tokens.onGold,tokens.brandGold) < 4.5) issues.push('Altın buton metni kontrastı en az 4.5:1 olmalıdır.');
  return issues;
}

function cssRule(appearance: BrandAppearance) {
  const t = appearance.tokens;
  return `:root[data-theme="custom"]{color-scheme:${appearance.colorScheme};--bg-main:${t.background};--bg-card:${t.card};--text-main:${t.text};--text-muted:${t.muted};--text-muted-darker:${t.muted};--border-main:${t.border};--border-light:${t.border};--brand-gold:${t.brandGold};--brand-green:${t.brandGreen};--brand-earth:${t.brandEarth};--text-on-gold:${t.onGold};--text-on-green:${t.onGreen};}`;
}

function syncCustomColorScheme(theme: AppTheme) {
  if (typeof document === 'undefined' || theme !== 'custom' || !activeAppearance) return;
  document.documentElement.style.colorScheme = activeAppearance.colorScheme;
}

export function applyBrandAppearance(appearance: BrandAppearance, options: { applyDefaultWhenUnchosen?: boolean } = {}) {
  if (typeof document === 'undefined') return;
  activeAppearance = normalize(appearance);
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = cssRule(activeAppearance);
  if (!themeSubscriptionInstalled) {
    themeSubscriptionInstalled = true;
    subscribePersonalTheme(theme => syncCustomColorScheme(theme));
  }
  if (options.applyDefaultWhenUnchosen !== false && !getStoredTheme()) applyThemeToDocument(activeAppearance.defaultTheme);
  const current = document.documentElement.getAttribute('data-theme') as AppTheme | null;
  if (current && isTheme(current)) syncCustomColorScheme(current);
}

export async function getPublicBrandAppearance(): Promise<BrandAppearance> {
  const { data, error } = await supabase.rpc('get_public_brand_appearance_v1');
  if (error) throw error;
  return normalize(data);
}

export async function loadAndApplyBrandAppearance() {
  const appearance = await getPublicBrandAppearance();
  applyBrandAppearance(appearance);
  return appearance;
}

export async function superAdminGetBrandAppearance(): Promise<BrandAppearance> {
  const { data, error } = await supabase.rpc('super_admin_get_brand_appearance_v1');
  if (error) throw error;
  return normalize(data);
}

export async function superAdminUpdateBrandAppearance(appearance: BrandAppearance): Promise<BrandAppearance> {
  const normalized = normalize(appearance);
  const { data, error } = await supabase.rpc('super_admin_update_brand_appearance_v1', {
    p_appearance: {
      defaultTheme: normalized.defaultTheme,
      colorScheme: normalized.colorScheme,
      tokens: normalized.tokens,
    },
  });
  if (error) throw error;
  return normalize(data);
}
