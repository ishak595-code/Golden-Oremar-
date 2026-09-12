import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const STORAGE_KEY = 'golden-oremar:pwa-install-dismissed:v1';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return false;
    const timestamp = parseInt(value, 10);
    if (Number.isNaN(timestamp)) return false;
    return Date.now() - timestamp < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function setDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage unavailable
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      const timer = window.setTimeout(() => setVisible(true), 3000);
      return () => window.clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setVisible(false);
        setDismissed();
      }
    } catch {
      // Cancelled
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setVisible(false);
    setDismissed();
  }

  if (!visible || !deferredPrompt) return null;

  return (
    <aside role="dialog" aria-labelledby="pwa-title" aria-describedby="pwa-desc" className="fixed bottom-20 left-4 right-4 z-[100] sm:left-auto sm:right-4 sm:w-96">
      <div className="overflow-hidden rounded-2xl border-2 border-brand-green bg-white shadow-2xl dark:border-brand-green/80 dark:bg-gray-900">
        <div className="flex items-start gap-3 border-b-2 border-gray-100 bg-gradient-to-br from-brand-green/5 to-brand-gold/5 p-4 dark:border-gray-800">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-green to-green-600 text-white shadow-lg">
            <Smartphone aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="pwa-title" className="font-black text-gray-900 dark:text-white">Uygulamayı Yükle</h2>
            <p id="pwa-desc" className="mt-0.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">Ana ekranınıza ekleyin</p>
          </div>
          <button type="button" onClick={handleDismiss} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-gray-200 bg-white transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Kapat">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <ul className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <li className="flex gap-2"><span className="text-brand-green">✓</span><span>Tek dokunuşla açılır</span></li>
            <li className="flex gap-2"><span className="text-brand-green">✓</span><span>Daha hızlı yüklenir</span></li>
            <li className="flex gap-2"><span className="text-brand-green">✓</span><span>Tam ekran deneyim</span></li>
          </ul>
          <button type="button" onClick={handleInstall} disabled={installing} className="min-h-12 w-full rounded-xl border-2 border-brand-green bg-brand-green px-4 font-bold text-white shadow-lg transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
            <span className="flex items-center justify-center gap-2">
              <Download aria-hidden="true" className="h-5 w-5" />
              {installing ? 'Yükleniyor…' : 'Ana Ekrana Ekle'}
            </span>
          </button>
          <button type="button" onClick={handleDismiss} className="w-full rounded-lg px-3 py-2 text-center text-sm font-semibold text-gray-600 transition-all hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">Şimdi değil</button>
        </div>
        <div className="border-t-2 border-gray-100 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <span className="font-semibold">Bilgi:</span> 7 gün boyunca tekrar gösterilmeyecek.
        </div>
      </div>
    </aside>
  );
}
