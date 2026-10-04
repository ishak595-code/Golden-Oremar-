/* The safety centre (Kullanım Şartları, report, block) is required for user
   content. On browsing screens it is a floating shield button; on screens with
   forms and bottom actions (account, settings, messages, cart, help, admin)
   the button would cover inputs, so those screens open it from an inline
   entry instead (Ayarlar row, Mesajlar thread header). */
export const OPEN_SAFETY_CENTER_EVENT = 'golden-oremar:open-safety-center';
export const SAFETY_FAB_TABS = new Set(['home', 'categories', 'search-results', 'favorites', 'product-detail', 'producer-profile', 'events']);
export function openSafetyCenter() { window.dispatchEvent(new Event(OPEN_SAFETY_CENTER_EVENT)); }
