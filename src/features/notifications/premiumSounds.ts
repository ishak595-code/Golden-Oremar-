export type NotificationSoundId =
  | 'oremar-drop'
  | 'mountain-birds'
  | 'dawn-rooster'
  | 'partridge-call'
  | 'highland-bell';

export type NotificationSoundOption = {
  id: NotificationSoundId;
  label: string;
  description: string;
};

/* IDs remain backward-compatible with persisted customer preferences. Labels and
   synthesis intentionally avoid novelty animal imitations: Golden Oremar uses a
   restrained five-sound sonic identity that feels native to a premium commerce app. */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  { id: 'oremar-drop', label: 'Oremar Kristali', description: 'Kısa kristal dokunuş ve yumuşak su kuyruğu. Varsayılan Golden Oremar imzası.' },
  { id: 'mountain-birds', label: 'Dağ Esintisi', description: 'Hafif hava dokusu üzerinde iki zarif yüksek nota; ferah ve sakin.' },
  { id: 'dawn-rooster', label: 'Şafak İmzası', description: 'Sıcak üç notalı sabah motifi; doğal çağrışımlı ama taklit ses kullanmaz.' },
  { id: 'partridge-call', label: 'Zümrüt Yankı', description: 'Derin zümrüt tonunda iki kısa yankı ve ince harmonik kapanış.' },
  { id: 'highland-bell', label: 'Şampanya Çanı', description: 'Yumuşak metalik parlaklık ve kısa, rafine bir premium kapanış.' },
];

const SOUND_KEY = 'golden-oremar:notification-sound:v1';
const ENABLED_KEY = 'golden-oremar:notification-sound-enabled:v1';
const PREFERENCE_EVENT = 'golden-oremar:notification-sound-change';
const DEFAULT_SOUND: NotificationSoundId = 'oremar-drop';
let sharedContext: AudioContext | null = null;

function isSound(value: unknown): value is NotificationSoundId { return NOTIFICATION_SOUND_OPTIONS.some(option => option.id === value); }
function audioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioCtor();
  return sharedContext;
}
export function getNotificationSound(): NotificationSoundId { if (typeof window === 'undefined') return DEFAULT_SOUND; try { const value = window.localStorage.getItem(SOUND_KEY); return isSound(value) ? value : DEFAULT_SOUND; } catch { return DEFAULT_SOUND; } }
export function getNotificationSoundEnabled() { if (typeof window === 'undefined') return true; try { return window.localStorage.getItem(ENABLED_KEY) !== 'false'; } catch { return true; } }
function emitPreferenceChange() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFERENCE_EVENT)); }
export function setNotificationSound(sound: NotificationSoundId) { if (typeof window !== 'undefined') { try { window.localStorage.setItem(SOUND_KEY, sound); } catch {} } emitPreferenceChange(); }
export function setNotificationSoundEnabled(enabled: boolean) { if (typeof window !== 'undefined') { try { window.localStorage.setItem(ENABLED_KEY, String(enabled)); } catch {} } emitPreferenceChange(); }
export function subscribeNotificationSoundPreference(listener: () => void) { if (typeof window === 'undefined') return () => {}; window.addEventListener(PREFERENCE_EVENT, listener); return () => window.removeEventListener(PREFERENCE_EVENT, listener); }
export async function primeNotificationAudio() { const ctx = audioContext(); if (ctx?.state === 'suspended') { try { await ctx.resume(); } catch {} } }

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain = 0.04, type: OscillatorType = 'sine', endFrequency?: number) {
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency && endFrequency > 0) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.018, duration / 5));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp); amp.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + duration + 0.025);
}
function air(ctx: AudioContext, start: number, duration: number, gain = 0.006) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate); const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 1.6);
  const source = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const amp = ctx.createGain();
  source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 2800; filter.Q.value = 0.6;
  amp.gain.setValueAtTime(0.0001, start); amp.gain.linearRampToValueAtTime(gain, start + 0.04); amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter); filter.connect(amp); amp.connect(ctx.destination); source.start(start); source.stop(start + duration);
}
function crystal(ctx: AudioContext, now: number) {
  air(ctx, now, 0.34, 0.0045);
  tone(ctx, 1320, now + 0.01, 0.34, 0.045, 'sine', 880);
  tone(ctx, 1980, now + 0.015, 0.24, 0.018, 'sine', 1320);
  tone(ctx, 2640, now + 0.02, 0.16, 0.008, 'sine');
}
function mountain(ctx: AudioContext, now: number) {
  air(ctx, now, 0.48, 0.006);
  tone(ctx, 1244.51, now + 0.04, 0.18, 0.032, 'sine', 1480);
  tone(ctx, 1661.22, now + 0.23, 0.20, 0.028, 'sine', 1864.66);
  tone(ctx, 2489.02, now + 0.29, 0.14, 0.010, 'sine');
}
function dawn(ctx: AudioContext, now: number) {
  tone(ctx, 523.25, now + 0.01, 0.27, 0.032, 'triangle');
  tone(ctx, 659.25, now + 0.15, 0.30, 0.032, 'triangle');
  tone(ctx, 783.99, now + 0.30, 0.36, 0.027, 'sine');
  tone(ctx, 1567.98, now + 0.31, 0.25, 0.008, 'sine');
}
function emerald(ctx: AudioContext, now: number) {
  tone(ctx, 392, now + 0.01, 0.34, 0.030, 'sine');
  tone(ctx, 587.33, now + 0.07, 0.31, 0.020, 'sine');
  tone(ctx, 783.99, now + 0.25, 0.30, 0.025, 'sine');
  tone(ctx, 1174.66, now + 0.26, 0.22, 0.009, 'sine');
}
function champagne(ctx: AudioContext, now: number) {
  tone(ctx, 880, now + 0.01, 0.58, 0.036, 'sine');
  tone(ctx, 1760, now + 0.012, 0.42, 0.016, 'sine');
  tone(ctx, 2640, now + 0.015, 0.27, 0.007, 'sine');
  tone(ctx, 1318.51, now + 0.13, 0.33, 0.014, 'sine');
}

export async function playNotificationSound(sound = getNotificationSound(), options?: { force?: boolean }) {
  if (!options?.force && !getNotificationSoundEnabled()) return false;
  const ctx = audioContext(); if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume(); if (ctx.state !== 'running') return false;
    const now = ctx.currentTime + 0.015;
    if (sound === 'mountain-birds') mountain(ctx, now);
    else if (sound === 'dawn-rooster') dawn(ctx, now);
    else if (sound === 'partridge-call') emerald(ctx, now);
    else if (sound === 'highland-bell') champagne(ctx, now);
    else crystal(ctx, now);
    return true;
  } catch { return false; }
}
