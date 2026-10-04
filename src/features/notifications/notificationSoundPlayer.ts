import { notificationSoundUrl, soundOption, type NotificationSoundId } from './premiumSounds';

let sharedContext: AudioContext | null = null;
const decodedFiles = new Map<NotificationSoundId, Promise<AudioBuffer | null>>();

function audioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioCtor();
  return sharedContext;
}
export async function primeNotificationAudio(sound: NotificationSoundId) { const ctx = audioContext(); if (ctx?.state === 'suspended') { try { await ctx.resume(); } catch {} } if (ctx) void decodedFile(ctx, sound); }

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

/* Only when the file cannot be loaded at all: a soft, short chime so the
   customer still notices the notification. */
function fallbackChime(ctx: AudioContext) {
  const now = ctx.currentTime + 0.01;
  for (const [frequency, gain, decay] of [[880, 0.05, 0.6], [1318.5, 0.018, 0.35]] as const) {
    const oscillator = ctx.createOscillator(); const amp = ctx.createGain();
    oscillator.frequency.value = frequency;
    amp.gain.setValueAtTime(0.0001, now); amp.gain.exponentialRampToValueAtTime(gain, now + 0.008); amp.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    oscillator.connect(amp); amp.connect(ctx.destination); oscillator.start(now); oscillator.stop(now + decay + 0.02);
  }
}

/** Plays the real sound file (the same file Android channels use). */
export async function playSoundFile(sound: NotificationSoundId) {
  const ctx = audioContext(); if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume(); if (ctx.state !== 'running') return false;
    const buffer = await decodedFile(ctx, sound);
    if (!buffer) { fallbackChime(ctx); return true; }
    const source = ctx.createBufferSource(); const amp = ctx.createGain();
    source.buffer = buffer; amp.gain.value = soundOption(sound).webGain;
    source.connect(amp); amp.connect(ctx.destination); source.start(ctx.currentTime + 0.01);
    return true;
  } catch { return false; }
}
