import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeSpeechResult = { text?: unknown; matches?: unknown };
type NativeSpeechPlugin = {
  available(options?: { language?: string }): Promise<{ available?: boolean }>;
  start(options?: { language?: string }): Promise<NativeSpeechResult>;
  stop(): Promise<void>;
};

type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type VoiceSearchOptions = {
  language?: string;
  onInterim?: (text: string) => void;
};

const NativeSpeech = registerPlugin<NativeSpeechPlugin>('NativeSpeech');
let activeWebRecognition: WebSpeechRecognition | null = null;
let nativeActive = false;

function cleanTranscript(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 100);
}

function errorCode(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return String(candidate?.code || candidate?.message || '').trim().toLowerCase();
}

export function voiceSearchErrorMessage(error: unknown) {
  const code = errorCode(error);
  if (code.includes('speech_cancelled') || code.includes('aborted')) return '';
  if (code.includes('microphone_denied') || code.includes('not-allowed') || code.includes('permission')) {
    return 'Mikrofon izni verilmedi. Arama kutusunu kullanmaya devam edebilirsiniz.';
  }
  if (code.includes('speech_unavailable') || code.includes('not-supported')) {
    return 'Bu cihazda sesli arama kullanılamıyor. Arama kutusunu kullanmaya devam edebilirsiniz.';
  }
  if (code.includes('speech_no_match') || code.includes('no-speech')) {
    return 'Konuşma anlaşılamadı. Tekrar deneyebilir veya arama kutusunu kullanabilirsiniz.';
  }
  if (code.includes('network')) {
    return 'Sesli arama için bağlantı kurulamadı. Metin araması çalışmaya devam ediyor.';
  }
  return 'Sesli arama tamamlanamadı. Arama kutusunu kullanmaya devam edebilirsiniz.';
}

async function recognizeNative(language: string) {
  const availability = await NativeSpeech.available({ language });
  if (availability?.available !== true) throw Object.assign(new Error('speech_unavailable'), { code: 'speech_unavailable' });
  nativeActive = true;
  try {
    const result = await NativeSpeech.start({ language });
    const text = cleanTranscript(result?.text);
    if (!text) throw Object.assign(new Error('speech_no_match'), { code: 'speech_no_match' });
    return text;
  } finally {
    nativeActive = false;
  }
}

function recognizeWeb(language: string, onInterim?: (text: string) => void) {
  return new Promise<string>((resolve, reject) => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      reject(Object.assign(new Error('speech_not_supported'), { code: 'speech_not_supported' }));
      return;
    }
    const recognition: WebSpeechRecognition = new Recognition();
    activeWebRecognition = recognition;
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    let finalText = '';
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (activeWebRecognition === recognition) activeWebRecognition = null;
      callback();
    };
    recognition.onresult = event => {
      let visible = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = cleanTranscript(event.results[index]?.[0]?.transcript);
        if (!transcript) continue;
        visible = `${visible} ${transcript}`.trim();
        if (event.results[index]?.isFinal) finalText = `${finalText} ${transcript}`.trim();
      }
      const interim = cleanTranscript(visible || finalText);
      if (interim) onInterim?.(interim);
    };
    recognition.onerror = event => finish(() => reject(Object.assign(new Error(String(event?.error || 'speech_failed')), { code: String(event?.error || 'speech_failed') })));
    recognition.onend = () => finish(() => {
      const text = cleanTranscript(finalText);
      if (text) resolve(text);
      else reject(Object.assign(new Error('speech_no_match'), { code: 'speech_no_match' }));
    });
    try {
      recognition.start();
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export async function recognizeVoiceSearch(options: VoiceSearchOptions = {}) {
  const language = String(options.language || 'tr-TR').trim() || 'tr-TR';
  if (Capacitor.isNativePlatform()) return recognizeNative(language);
  return recognizeWeb(language, options.onInterim);
}

export async function stopVoiceSearch() {
  if (Capacitor.isNativePlatform()) {
    if (!nativeActive) return;
    try {
      await NativeSpeech.stop();
    } finally {
      nativeActive = false;
    }
    return;
  }
  const recognition = activeWebRecognition;
  activeWebRecognition = null;
  try {
    recognition?.abort();
  } catch {
    // Voice search is an enhancement. Text search must remain unaffected.
  }
}
