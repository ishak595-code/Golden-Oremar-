// Keyboard shortcuts helper for better accessibility

export const KEYBOARD_SHORTCUTS = {
  navigation: {
    home: { key: 'h', description: 'Ana sayfaya dön' },
    categories: { key: 'c', description: 'Kategorileri göster' },
    cart: { key: 's', description: 'Sepete git' },
    account: { key: 'p', description: 'Hesabıma git' },
    search: { key: '/', description: 'Arama yap' },
    back: { key: 'Escape', description: 'Geri dön' },
  },
  actions: {
    save: { key: 'Ctrl+S', description: 'Kaydet' },
    submit: { key: 'Ctrl+Enter', description: 'Gönder' },
    cancel: { key: 'Escape', description: 'İptal et' },
  },
  accessibility: {
    skipToContent: { key: 'Tab', description: 'İçeriğe atla' },
    closeDialog: { key: 'Escape', description: 'Pencereyi kapat' },
  },
} as const;

export function getShortcutDescription(category: keyof typeof KEYBOARD_SHORTCUTS, action: string): string {
  const shortcuts = KEYBOARD_SHORTCUTS[category] as Record<string, { key: string; description: string }>;
  return shortcuts[action]?.description || '';
}

export function formatKeyboardShortcut(key: string): string {
  if (key.includes('+')) {
    return key.split('+').map(k => k.trim()).join(' + ');
  }
  return key;
}

// Helper to check if a keyboard event matches a shortcut
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string
): boolean {
  const parts = shortcut.toLowerCase().split('+').map(s => s.trim());
  
  const hasCtrl = parts.includes('ctrl') || parts.includes('control');
  const hasShift = parts.includes('shift');
  const hasAlt = parts.includes('alt');
  const hasCmd = parts.includes('cmd') || parts.includes('meta');
  
  const mainKey = parts.find(
    p => !['ctrl', 'control', 'shift', 'alt', 'cmd', 'meta'].includes(p)
  );
  
  if (!mainKey) return false;
  
  return (
    event.key.toLowerCase() === mainKey &&
    event.ctrlKey === hasCtrl &&
    event.shiftKey === hasShift &&
    event.altKey === hasAlt &&
    event.metaKey === hasCmd
  );
}
