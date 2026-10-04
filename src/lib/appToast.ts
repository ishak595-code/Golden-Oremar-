// One short confirmation toast for the whole app ("Kaydedildi"). Screens that
// live in lazy chunks announce through this event; App renders the toast.
export const APP_TOAST_EVENT = 'golden-oremar:toast';

export function showAppToast(message: string) {
  if (typeof window === 'undefined') return;
  const text = String(message || '').trim().slice(0, 160);
  if (text) window.dispatchEvent(new CustomEvent<string>(APP_TOAST_EVENT, { detail: text }));
}
