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

export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'oremar-drop',
    label: 'Oremar Damlası',
    description: 'Su damlası ve çok hafif yağmur dokusu. Varsayılan Golden Oremar imzası.',
  },
  {
    id: 'mountain-birds',
    label: 'Dağ Kuşları',
    description: 'İki kısa, temiz kuş ötüşü; canlı ama rahatsız etmeyen bir imza.',
  },
  {
    id: 'dawn-rooster',
    label: 'Şafak Horozu',
    description: 'Köy sabahını çağrıştıran kısa ve yumuşatılmış horoz motifi.',
  },
  {
    id: 'partridge-call',
    label: 'Keklik Çağrısı',
    description: 'Dağ doğasına yakışan zarif, çift vuruşlu keklik motifi.',
  },
  {
    id: 'highland-bell',
    label: 'Yayla Çanı',
    description: 'Sıcak, kısa ve prestijli bir yayla çanı tınısı.',
  },
];

const SOUND_KEY = 'golden-oremar:notification-sound:v1';
const ENABLED_KEY = 'golden-oremar:notification-sound-enabled:v1';
const PREFERENCE_EVENT = 'golden-oremar:notification-sound-change';
const DEFAULT_SOUND: NotificationSoundId = 'oremar-drop';

let sharedContext: AudioContext | null = null;

function isSound(value: unknown): value is NotificationSoundId {
  return NOTIFICATION_SOUND_OPTIONS.some(option => option.id === value);
}

function audioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioCtor();
  return sharedContext;
}

export function getNotificationSound(): NotificationSoundId {
  if (typeof window === 'undefined') return DEFAULT_SOUND;
  try {
    const value = window.localStorage.getItem(SOUND_KEY);
    return isSound(value) ? value : DEFAULT_SOUND;
  } catch {
    return DEFAULT_SOUND;
  }
}

export function getNotificationSoundEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function emitPreferenceChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFERENCE_EVENT));
}

export function setNotificationSound(sound: NotificationSoundId) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(SOUND_KEY, sound); } catch { /* private storage can fail */ }
  }
  emitPreferenceChange();
}

export function setNotificationSoundEnabled(enabled: boolean) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(ENABLED_KEY, String(enabled)); } catch { /* private storage can fail */ }
  }
  emitPreferenceChange();
}

export function subscribeNotificationSoundPreference(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PREFERENCE_EVENT, listener);
  return () => window.removeEventListener(PREFERENCE_EVENT, listener);
}

export async function primeNotificationAudio() {
  const ctx = audioContext();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch { /* browser may keep audio suspended */ }
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gain = 0.055,
  type: OscillatorType = 'sine',
  endFrequency?: number,
) {
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.025, duration / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp);
  amp.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function rainTexture(ctx: AudioContext, start: number, duration = 0.42) {
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = 3400;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(0.012, start + 0.05);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  source.start(start);
  source.stop(start + duration);
}

function playDrop(ctx: AudioContext, now: number) {
  rainTexture(ctx, now, 0.46);
  tone(ctx, 1180, now + 0.03, 0.34, 0.07, 'sine', 520);
  tone(ctx, 1760, now + 0.04, 0.22, 0.025, 'sine', 880);
}

function playBirds(ctx: AudioContext, now: number) {
  tone(ctx, 1600, now + 0.02, 0.16, 0.045, 'sine', 2550);
  tone(ctx, 2100, now + 0.23, 0.14, 0.04, 'sine', 3100);
  tone(ctx, 1850, now + 0.43, 0.13, 0.032, 'sine', 2700);
}

function playRooster(ctx: AudioContext, now: number) {
  tone(ctx, 430, now + 0.02, 0.20, 0.045, 'triangle', 590);
  tone(ctx, 590, now + 0.18, 0.25, 0.05, 'triangle', 710);
  tone(ctx, 520, now + 0.43, 0.30, 0.042, 'triangle', 390);
  tone(ctx, 1040, now + 0.20, 0.42, 0.012, 'sine', 760);
}

function playPartridge(ctx: AudioContext, now: number) {
  tone(ctx, 980, now + 0.02, 0.12, 0.052, 'triangle', 1320);
  tone(ctx, 1040, now + 0.17, 0.12, 0.048, 'triangle', 1450);
  tone(ctx, 1180, now + 0.34, 0.15, 0.037, 'triangle', 1580);
}

function playBell(ctx: AudioContext, now: number) {
  tone(ctx, 740, now + 0.02, 0.66, 0.055, 'sine');
  tone(ctx, 1480, now + 0.02, 0.46, 0.025, 'sine');
  tone(ctx, 2220, now + 0.02, 0.34, 0.012, 'sine');
}

export async function playNotificationSound(sound = getNotificationSound(), options?: { force?: boolean }) {
  if (!options?.force && !getNotificationSoundEnabled()) return false;
  const ctx = audioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return false;
    const now = ctx.currentTime + 0.015;
    if (sound === 'mountain-birds') playBirds(ctx, now);
    else if (sound === 'dawn-rooster') playRooster(ctx, now);
    else if (sound === 'partridge-call') playPartridge(ctx, now);
    else if (sound === 'highland-bell') playBell(ctx, now);
    else playDrop(ctx, now);
    return true;
  } catch {
    return false;
  }
}
