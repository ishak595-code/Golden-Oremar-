// Renders Golden Oremar's five notification sounds to real audio files, so
// the web preview, in-app alerts and Android push channels play the SAME
// app-specific sound (Android channels can only play a file from res/raw).
// The motifs are the ones in src/features/notifications/premiumSounds.ts
// (that WebAudio synthesis stays as an offline fallback). Deterministic:
// the "air" noise uses a seeded generator, so re-running gives identical files.
//   node scripts/sounds/render-notification-sounds.mjs
import fs from 'node:fs';
import path from 'node:path';

const RATE = 32000;
const SOUNDS = {
  'oremar-drop': { length: 0.48, parts: [['air', 0, 0.34, 0.0045], ['tone', 1320, 0.01, 0.34, 0.045, 'sine', 880], ['tone', 1980, 0.015, 0.24, 0.018, 'sine', 1320], ['tone', 2640, 0.02, 0.16, 0.008, 'sine']] },
  'mountain-birds': { length: 0.62, parts: [['air', 0, 0.48, 0.006], ['tone', 1244.51, 0.04, 0.18, 0.032, 'sine', 1480], ['tone', 1661.22, 0.23, 0.20, 0.028, 'sine', 1864.66], ['tone', 2489.02, 0.29, 0.14, 0.010, 'sine']] },
  'dawn-rooster': { length: 0.78, parts: [['tone', 523.25, 0.01, 0.27, 0.032, 'triangle'], ['tone', 659.25, 0.15, 0.30, 0.032, 'triangle'], ['tone', 783.99, 0.30, 0.36, 0.027, 'sine'], ['tone', 1567.98, 0.31, 0.25, 0.008, 'sine']] },
  'partridge-call': { length: 0.68, parts: [['tone', 392, 0.01, 0.34, 0.030, 'sine'], ['tone', 587.33, 0.07, 0.31, 0.020, 'sine'], ['tone', 783.99, 0.25, 0.30, 0.025, 'sine'], ['tone', 1174.66, 0.26, 0.22, 0.009, 'sine']] },
  'highland-bell': { length: 0.72, parts: [['tone', 880, 0.01, 0.58, 0.036, 'sine'], ['tone', 1760, 0.012, 0.42, 0.016, 'sine'], ['tone', 2640, 0.015, 0.27, 0.007, 'sine'], ['tone', 1318.51, 0.13, 0.33, 0.014, 'sine']] },
};
export const fileNameFor = id => `go_sound_${id.replace(/-/g, '_')}.wav`;

function expRamp(from, to, t) { return from * Math.pow(to / from, Math.min(1, Math.max(0, t))); }
function addTone(out, [, f, start, dur, gain, type, endF]) {
  const attack = Math.min(0.018, dur / 5);
  let phase = 0;
  const first = Math.floor(start * RATE), last = Math.min(out.length, Math.ceil((start + dur + 0.025) * RATE));
  for (let i = first; i < last; i += 1) {
    const t = i / RATE - start;
    const freq = endF ? expRamp(f, endF, t / dur) : f;
    phase += (2 * Math.PI * freq) / RATE;
    const env = t < attack ? expRamp(0.0001, gain, t / attack) : t < dur ? expRamp(gain, 0.0001, (t - attack) / (dur - attack)) : 0.0001;
    const x = phase / (2 * Math.PI) % 1;
    const wave = type === 'triangle' ? 1 - 4 * Math.abs(x - 0.5) : Math.sin(phase);
    out[i] += wave * env;
  }
}
function addAir(out, [, start, dur, gain], seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // RBJ band-pass, 2800 Hz, Q 0.6 (as the WebAudio BiquadFilter in premiumSounds.ts)
  const w0 = 2 * Math.PI * 2800 / RATE, alpha = Math.sin(w0) / (2 * 0.6), a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const frames = Math.floor(dur * RATE), first = Math.floor(start * RATE);
  for (let i = 0; i < frames && first + i < out.length; i += 1) {
    const x = (rand() * 2 - 1) * Math.pow(1 - i / frames, 1.6);
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y;
    const t = i / RATE;
    const env = t < 0.04 ? 0.0001 + (gain - 0.0001) * (t / 0.04) : expRamp(gain, 0.0001, (t - 0.04) / (dur - 0.04));
    out[first + i] += y * env;
  }
}
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
export function render(id) {
  const recipe = SOUNDS[id];
  const out = new Float64Array(Math.ceil(recipe.length * RATE));
  recipe.parts.forEach((part, index) => (part[0] === 'air' ? addAir(out, part, 7919 * (index + 1) + id.length) : addTone(out, part)));
  // Notification files are normalised (peak -1 dBFS) so the phone's notification volume applies;
  // the web player scales them back down to the original in-app loudness.
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  const scale = 0.89 / peak;
  // 5 ms fade-out so the file never ends on a click.
  const fade = Math.floor(0.005 * RATE);
  return { buffer: wav(Array.from(out, (v, i) => v * scale * Math.min(1, (out.length - 1 - i) / fade))), originalPeak: peak };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = ['public/sounds', 'android/app/src/main/res/raw'];
  const manifest = {};
  for (const id of Object.keys(SOUNDS)) {
    const { buffer, originalPeak } = render(id);
    for (const dir of targets) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, fileNameFor(id)), buffer); }
    manifest[id] = { file: fileNameFor(id), bytes: buffer.length, webGain: Number(originalPeak.toFixed(4)) };
  }
  fs.writeFileSync('public/sounds/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
