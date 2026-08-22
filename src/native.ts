import { Capacitor, registerPlugin } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export type NativeTheme = 'light' | 'dark';
export type NativeAppUpdateMode = 'flexible' | 'immediate';
export type NativeAppUpdateState = {
  supported: boolean;
  available: boolean;
  flexibleAllowed: boolean;
  immediateAllowed: boolean;
  availableVersionCode?: number;
  installStatus?: string;
  downloaded: boolean;
  downloading: boolean;
  inProgress: boolean;
  bytesDownloaded?: number;
  totalBytes?: number;
  priority?: number;
  stalenessDays?: number;
  reason?: string;
};

type NativeSpeechResponse = { text?: string; matches?: string[] };
type NativeSpeechBridge = {
  available(options?: { language?: string }): Promise<{ available: boolean }>;
  start(options?: { language?: string }): Promise<NativeSpeechResponse>;
  stop(): Promise<void>;
};
type NativeAppUpdateBridge = {
  check(): Promise<NativeAppUpdateState>;
  start(options?: { mode?: NativeAppUpdateMode }): Promise<{ started: boolean; mode: NativeAppUpdateMode }>;
  complete(): Promise<void>;
  addListener(eventName: 'state', listener: (state: Partial<NativeAppUpdateState>) => void): Promise<{ remove: () => Promise<void> }>;
};

const NativeSpeech = registerPlugin<NativeSpeechBridge>('NativeSpeech');
const NativeAppUpdate = registerPlugin<NativeAppUpdateBridge>('NativeAppUpdate');
let keyboardSignalsReady = false;
let nativeSpeechAdapterReady = false;

function resolveNativeTheme(theme?: string): NativeTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light' || theme === 'emerald' || theme === 'ruby' || theme === 'champagne') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function markNativePlatform() {
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  document.documentElement.dataset.nativePlatform = platform === 'android' || platform === 'ios' ? platform : 'native';
}

function normalizeSpeechLanguage(value: unknown) {
  const language = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/.test(language) ? language : 'tr-TR';
}

function nativeSpeechErrorCode(error: unknown) {
  const raw = error && typeof error === 'object' ? String((error as any).code || (error as any).message || '') : String(error || '');
  const normalized = raw.toLowerCase();
  if (normalized.includes('denied') || normalized.includes('permission')) return 'not-allowed';
  if (normalized.includes('no_match') || normalized.includes('no match') || normalized.includes('timeout')) return 'no-speech';
  if (normalized.includes('network')) return 'network';
  if (normalized.includes('busy')) return 'audio-busy';
  return 'aborted';
}

function installNativeSpeechRecognitionAdapter() {
  if (nativeSpeechAdapterReady || !Capacitor.isNativePlatform() || typeof window === 'undefined') return;
  nativeSpeechAdapterReady = true;

  class NativeSpeechRecognitionAdapter {
    lang = 'tr-TR';
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    private running = false;
    private cancelled = false;
    private ended = false;

    private finish() {
      if (this.ended) return;
      this.ended = true;
      this.running = false;
      this.onend?.();
    }

    async start() {
      if (this.running) throw new Error('Sesli arama zaten dinliyor.');
      this.running = true;
      this.cancelled = false;
      this.ended = false;
      const language = normalizeSpeechLanguage(this.lang);
      try {
        const availability = await NativeSpeech.available({ language });
        if (!availability?.available) throw Object.assign(new Error('speech_unavailable'), { code: 'speech_unavailable' });
        const result = await NativeSpeech.start({ language });
        if (this.cancelled) return;
        const text = typeof result?.text === 'string' ? result.text.trim() : '';
        if (!text) throw Object.assign(new Error('speech_no_match'), { code: 'speech_no_match' });
        const alternative = { transcript: text, confidence: 1 };
        const recognitionResult: any = [alternative];
        recognitionResult.isFinal = true;
        this.onresult?.({ resultIndex: 0, results: [recognitionResult] });
      } catch (error) {
        if (!this.cancelled) this.onerror?.({ error: nativeSpeechErrorCode(error), nativeError: error });
      } finally {
        this.finish();
      }
    }

    abort() {
      if (!this.running) return;
      this.cancelled = true;
      this.running = false;
      void NativeSpeech.stop().catch(() => undefined).finally(() => this.finish());
    }

    stop() {
      this.abort();
    }
  }

  (window as any).SpeechRecognition = NativeSpeechRecognitionAdapter;
  (window as any).webkitSpeechRecognition = NativeSpeechRecognitionAdapter;
}

async function initNativeKeyboardSignals() {
  if (keyboardSignalsReady || !Capacitor.isNativePlatform()) return;
  keyboardSignalsReady = true;
  const root = document.documentElement;
  await Promise.all([
    Keyboard.addListener('keyboardDidShow', info => {
      root.dataset.nativeKeyboard = 'open';
      root.style.setProperty('--native-keyboard-height', `${Math.max(0, Number(info.keyboardHeight) || 0)}px`);
    }),
    Keyboard.addListener('keyboardDidHide', () => {
      delete root.dataset.nativeKeyboard;
      root.style.removeProperty('--native-keyboard-height');
    }),
  ]);
}

function unsupportedUpdateState(reason = 'platform_not_supported'): NativeAppUpdateState {
  return { supported: false, available: false, flexibleAllowed: false, immediateAllowed: false, downloaded: false, downloading: false, inProgress: false, reason };
}

export const checkForNativeAppUpdate = async (): Promise<NativeAppUpdateState> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return unsupportedUpdateState();
  try {
    return await NativeAppUpdate.check();
  } catch (error) {
    const reason = error && typeof error === 'object' ? String((error as any).code || (error as any).message || 'play_update_unavailable') : 'play_update_unavailable';
    return unsupportedUpdateState(reason);
  }
};

export const startNativeAppUpdate = async (mode: NativeAppUpdateMode = 'flexible') => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') throw new Error('Android uygulama güncellemesi bu platformda kullanılamıyor.');
  return NativeAppUpdate.start({ mode });
};

export const completeNativeAppUpdate = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  await NativeAppUpdate.complete();
};

export const subscribeNativeAppUpdateState = async (listener: (state: Partial<NativeAppUpdateState>) => void) => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return { remove: async () => undefined };
  return NativeAppUpdate.addListener('state', listener);
};

export const syncNativeAppearance = async (theme?: string) => {
  if (!Capacitor.isNativePlatform()) return;
  const resolved = resolveNativeTheme(theme);
  await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
};

export const initNativeFeatures = async (theme?: string) => {
  if (!Capacitor.isNativePlatform()) return;
  markNativePlatform();
  installNativeSpeechRecognitionAdapter();
  try {
    await Promise.all([
      syncNativeAppearance(theme),
      initNativeKeyboardSignals(),
    ]);
    await SplashScreen.hide();
  } catch (error) {
    console.warn('Native features init error:', error);
  }
};
