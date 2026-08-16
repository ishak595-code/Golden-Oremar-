export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'golden-oremar:appearance-theme:v1';

function isTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark';
}

export function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
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

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable in hardened/private environments.
  }
}

export function setPersonalTheme(theme: AppTheme) {
  persistTheme(theme);
  applyThemeToDocument(theme);
}
