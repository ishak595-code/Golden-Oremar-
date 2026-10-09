import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * "Ana ekrana ekle", offered quietly: never on a first visit, only once the
 * visitor has scrolled or stayed a while on a later visit, as a slim bar above
 * the tab bar (not a dialog over the page). "Kapat" hides it for 30 days.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'golden-oremar:pwa-install-dismissed:v1';
const VISITS_KEY = 'golden-oremar:pwa-visits:v1';
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 20_000;

function read(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } }

function isDismissed(): boolean {
  const timestamp = Number.parseInt(read(DISMISS_KEY) || '', 10);
  return Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_DURATION_MS;
}

/** Counts this visit (once per browser session) and returns the total. */
function countVisit(): number {
  const total = Number.parseInt(read(VISITS_KEY) || '0', 10) || 0;
  try { if (sessionStorage.getItem(VISITS_KEY)) return total; sessionStorage.setItem(VISITS_KEY, '1'); } catch { return total; }
  write(VISITS_KEY, String(total + 1));
  return total + 1;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true || document.referrer.includes('android-app://');
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone() || isDismissed()) return;
    if (countVisit() < 2) return;
    const onPrompt = (event: Event) => { event.preventDefault(); setDeferredPrompt(event as BeforeInstallPromptEvent); };
    const engage = () => setReady(true);
    const timer = window.setTimeout(engage, SHOW_AFTER_MS);
    const onScroll = () => { if (window.scrollY > 600) engage(); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.clearTimeout(timer); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('scroll', onScroll); };
  }, []);

  function dismiss() { setReady(false); setDeferredPrompt(null); write(DISMISS_KEY, String(Date.now())); }

  async function install() {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') dismiss();
    } catch { /* cancelled */ } finally { setInstalling(false); setDeferredPrompt(null); }
  }

  if (!ready || !deferredPrompt) return null;
  return (
    <aside aria-label="Uygulamayı ana ekrana ekle" className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[90] mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-brand-gold/40 bg-white/95 p-2 pl-4 shadow-xl backdrop-blur dark:bg-gray-900/95">
      <p className="min-w-0 flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Golden Oremar'ı ana ekrana ekleyin</p>
      <button type="button" onClick={() => void install()} disabled={installing} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-green px-3 text-sm font-bold text-brand-on-green disabled:opacity-60">
        <Download aria-hidden="true" className="h-4 w-4" />{installing ? 'Ekleniyor…' : 'Ekle'}
      </button>
      <button type="button" onClick={dismiss} aria-label="Kapat" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </aside>
  );
}
