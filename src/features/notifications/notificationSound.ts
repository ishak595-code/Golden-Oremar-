export type NotificationSoundId = 'rain-drop' | 'mountain-rooster' | 'bird-chorus' | 'stream-wind' | 'pasture-bell';

export const DEFAULT_NOTIFICATION_SOUND: NotificationSoundId = 'rain-drop';
export const NOTIFICATION_SOUND_PROFILES: ReadonlyArray<{
  id: NotificationSoundId;
  name: string;
  description: string;
  recommended?: boolean;
}> = [
  { id: 'rain-drop', name: 'Yağmur Damlası', description: 'Berrak damla vuruşları ve çok hafif yağmur dokusu.', recommended: true },
  { id: 'mountain-rooster', name: 'Dağ Horozu', description: 'Köy sabahını çağrıştıran kısa, yumuşak üçlü çağrı.' },
  { id: 'bird-chorus', name: 'Kuş Korosu', description: 'Dağ kuşlarını çağrıştıran iki zarif ötüş katmanı.' },
  { id: 'stream-wind', name: 'Dere & Rüzgâr', description: 'Kısa dere parıltısı ve sakin vadi esintisi.' },
  { id: 'pasture-bell', name: 'Yayla Çanı', description: 'Uzak yayla çanını andıran sıcak, metalik ve kısa imza.' },
] as const;

const STORAGE_KEY = 'golden-oremar:notification-sound:v1';

function isSoundId(value: unknown): value is NotificationSoundId {
  return NOTIFICATION_SOUND_PROFILES.some(profile => profile.id === value);
}

export function getStoredNotificationSound(): NotificationSoundId {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SOUND;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isSoundId(value) ? value : DEFAULT_NOTIFICATION_SOUND;
  } catch {
    return DEFAULT_NOTIFICATION_SOUND;
  }
}

export function persistNotificationSound(sound: NotificationSoundId) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, sound); } catch { /* private storage may be unavailable */ }
}

function createGain(ctx: AudioContext, destination: AudioNode, value = 1) {
  const gain = ctx.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}

function tone(ctx: AudioContext, destination: AudioNode, options: {
  start: number; duration: number; from: number; to?: number; volume?: number;
  type?: OscillatorType; attack?: number;
}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + options.start;
  const end = start + options.duration;
  const attack = Math.min(options.attack ?? 0.012, options.duration / 3);
  const volume = options.volume ?? 0.08;
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.from, start);
  if (options.to && options.to !== options.from) osc.frequency.exponentialRampToValueAtTime(options.to, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function noise(ctx: AudioContext, destination: AudioNode, options: {
  start: number; duration: number; volume: number; lowpass?: number; highpass?: number;
}) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * options.duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length * 0.3);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  let node: AudioNode = source;
  if (options.highpass) {
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = options.highpass; node.connect(filter); node = filter;
  }
  if (options.lowpass) {
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = options.lowpass; node.connect(filter); node = filter;
  }
  const gain = ctx.createGain();
  const start = ctx.currentTime + options.start;
  const end = start + options.duration;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume, start + Math.min(0.04, options.duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  node.connect(gain); gain.connect(destination);
  source.start(start); source.stop(end + 0.02);
}

function rainDrop(ctx: AudioContext, out: AudioNode) {
  noise(ctx, out, { start: 0, duration: 0.42, volume: 0.012, highpass: 900, lowpass: 5200 });
  tone(ctx, out, { start: 0.02, duration: 0.16, from: 720, to: 1320, volume: 0.085 });
  tone(ctx, out, { start: 0.14, duration: 0.14, from: 980, to: 1680, volume: 0.055 });
  tone(ctx, out, { start: 0.25, duration: 0.12, from: 820, to: 1450, volume: 0.04 });
}

function mountainRooster(ctx: AudioContext, out: AudioNode) {
  tone(ctx, out, { start: 0.00, duration: 0.16, from: 620, to: 960, volume: 0.055, type: 'triangle' });
  tone(ctx, out, { start: 0.12, duration: 0.18, from: 760, to: 1180, volume: 0.07, type: 'triangle' });
  tone(ctx, out, { start: 0.27, duration: 0.22, from: 900, to: 610, volume: 0.06, type: 'triangle' });
  tone(ctx, out, { start: 0.29, duration: 0.18, from: 1350, to: 980, volume: 0.022, type: 'sine' });
}

function birdChorus(ctx: AudioContext, out: AudioNode) {
  tone(ctx, out, { start: 0.00, duration: 0.09, from: 1500, to: 2400, volume: 0.045 });
  tone(ctx, out, { start: 0.08, duration: 0.08, from: 2050, to: 1650, volume: 0.036 });
  tone(ctx, out, { start: 0.18, duration: 0.10, from: 1750, to: 2850, volume: 0.04 });
  tone(ctx, out, { start: 0.28, duration: 0.10, from: 2500, to: 1950, volume: 0.03 });
}

function streamWind(ctx: AudioContext, out: AudioNode) {
  noise(ctx, out, { start: 0, duration: 0.55, volume: 0.018, lowpass: 1800 });
  tone(ctx, out, { start: 0.04, duration: 0.26, from: 560, to: 920, volume: 0.035, type: 'sine' });
  tone(ctx, out, { start: 0.25, duration: 0.20, from: 740, to: 1100, volume: 0.025, type: 'sine' });
}

function pastureBell(ctx: AudioContext, out: AudioNode) {
  tone(ctx, out, { start: 0, duration: 0.72, from: 660, volume: 0.055, type: 'sine', attack: 0.008 });
  tone(ctx, out, { start: 0, duration: 0.62, from: 990, volume: 0.03, type: 'sine', attack: 0.008 });
  tone(ctx, out, { start: 0, duration: 0.48, from: 1320, volume: 0.016, type: 'sine', attack: 0.008 });
}

export async function playNotificationSound(sound: NotificationSoundId): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return false;
  const ctx = new AudioContextCtor();
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const master = createGain(ctx, ctx.destination, 0.9);
    if (sound === 'mountain-rooster') mountainRooster(ctx, master);
    else if (sound === 'bird-chorus') birdChorus(ctx, master);
    else if (sound === 'stream-wind') streamWind(ctx, master);
    else if (sound === 'pasture-bell') pastureBell(ctx, master);
    else rainDrop(ctx, master);
    window.setTimeout(() => { void ctx.close().catch(() => {}); }, 1200);
    return true;
  } catch {
    void ctx.close().catch(() => {});
    return false;
  }
}
