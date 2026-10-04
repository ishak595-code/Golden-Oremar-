import { notificationSoundUrl, soundOption, type NotificationSoundId } from './premiumSounds';

let sharedContext: AudioContext | null = null;
const decodedFiles = new Map<NotificationSoundId, Promise<AudioBuffer | null>>();
const FILE_PEAK = 0.89;

function audioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioCtor();
  return sharedContext;
}
export async function primeNotificationAudio(sound: NotificationSoundId) { const ctx = audioContext(); if (ctx?.state === 'suspended') { try { await ctx.resume(); } catch {} } if (ctx) void decodedFile(ctx, sound); }

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

function decodedFile(ctx: AudioContext, sound: NotificationSoundId) {
  let pending = decodedFiles.get(sound);
  if (!pending) {
    pending = fetch(notificationSoundUrl(sound))
      .then(response => { if (!response.ok) throw new Error(`sound ${response.status}`); return response.arrayBuffer(); })
      .then(data => ctx.decodeAudioData(data))
      .catch(() => { decodedFiles.delete(sound); return null; });
    decodedFiles.set(sound, pending);
  }
  return pending;
}
/** Plays the real sound file (the one Android channels use); the matching
    WebAudio synthesis is only a fallback when the file cannot be loaded. */
export async function playSoundFile(sound: NotificationSoundId) {
  const ctx = audioContext(); if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume(); if (ctx.state !== 'running') return false;
    const buffer = await decodedFile(ctx, sound);
    if (buffer) {
      const source = ctx.createBufferSource(); const amp = ctx.createGain();
      source.buffer = buffer; amp.gain.value = soundOption(sound).webGain / FILE_PEAK;
      source.connect(amp); amp.connect(ctx.destination); source.start(ctx.currentTime + 0.01);
      return true;
    }
    const now = ctx.currentTime + 0.015;
    if (sound === 'mountain-birds') mountain(ctx, now);
    else if (sound === 'dawn-rooster') dawn(ctx, now);
    else if (sound === 'partridge-call') emerald(ctx, now);
    else if (sound === 'highland-bell') champagne(ctx, now);
    else crystal(ctx, now);
    return true;
  } catch { return false; }
}
