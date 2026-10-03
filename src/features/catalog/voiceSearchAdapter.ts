import { Capacitor } from '@capacitor/core';
import { NativeSpeech } from '../../lib/nativeSpeechPlugin';


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

let activeWebRecognition: WebSpeechRecognition | null = null;
let nativeActive = false;

function cleanTranscript(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 100);
}

/**
 * "bal bal" -> "bal", "kuru üzüm kuru üzüm" -> "kuru üzüm": a phrase the
 * recogniser returned twice in a row. A real query that repeats a word
 * differently ("bal ve bal mumu") is left alone.
 */
export function collapseRepeatedPhrase(value: unknown) {
  const text = cleanTranscript(value);
  const words = text.split(' ').filter(Boolean);
  for (let size = 1; size <= words.length / 2; size += 1) {
    if (words.length % size) continue;
    const head = words.slice(0, size).join(' ').toLocaleLowerCase('tr-TR');
    let repeated = true;
    for (let start = size; start < words.length; start += size) {
      if (words.slice(start, start + size).join(' ').toLocaleLowerCase('tr-TR') !== head) { repeated = false; break; }
    }
    if (repeated) return words.slice(0, size).join(' ');
  }
  return text;
}

function errorCode(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return String(candidate?.code || candidate?.message || '').trim().toLowerCase();
}

export function voiceSearchErrorMessage(error: unknown) {
  const code = errorCode(error);
  if (code.includes('speech_cancelled') || code.includes('aborted')) return '';
  if (code.includes('microphone_denied') || code.includes('not-allowed') || code.includes('permission')) {
    return 'Mikrofon izni verilmedi.|Cihaz ayarlarından Golden Oremar uygulamasına mikrofon erişimi vermelisiniz. Şimdilik arama kutusunu kullanabilirsiniz.';
  }
  if (code.includes('speech_unavailable') || code.includes('not-supported')) {
    return 'Sesli arama bu cihazda desteklenmiyor.|Tarayıcınız veya cihazınız sesli aramayı desteklemiyor. Arama kutusunu kullanabilirsiniz.';
  }
  if (code.includes('speech_no_match') || code.includes('no-speech')) {
    return 'Konuşma anlaşılamadı.|Lütfen daha net konuşarak tekrar deneyin veya arama kutusunu kullanın.';
  }
  if (code.includes('network')) {
    return 'Bağlantı hatası.|Sesli arama için internet bağlantısı gerekli. Metin aramasını kullanabilirsiniz.';
  }
  return 'Sesli arama tamamlanamadı.|Bir sorun oluştu. Lütfen arama kutusunu kullanın veya tekrar deneyin.';
}

async function recognizeNative(language: string) {
  const availability = await NativeSpeech.available({ language });
  if (availability?.available !== true) throw Object.assign(new Error('speech_unavailable'), { code: 'speech_unavailable' });
  nativeActive = true;
  try {
    const result = await NativeSpeech.start({ language });
    const text = collapseRepeatedPhrase(result?.text);
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
    // The final text is rebuilt from every result on each event. Chrome on
    // Android sends the same final result again in later events; adding it up
    // gave "bal bal" and a search for the phrase twice.
    recognition.onresult = event => {
      const finals: string[] = [];
      let interimText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = cleanTranscript(event.results[index]?.[0]?.transcript);
        if (!transcript) continue;
        if (event.results[index]?.isFinal) finals.push(transcript);
        else interimText = `${interimText} ${transcript}`.trim();
      }
      finalText = collapseRepeatedPhrase(finals.join(' '));
      const interim = collapseRepeatedPhrase(`${finalText} ${interimText}`);
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
