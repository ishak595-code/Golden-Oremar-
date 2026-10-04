// Golden Oremar's notification sounds are real, app-specific audio files: the
// settings preview and in-app alerts play public/sounds/<file>, and Android push
// plays the identical android/app/src/main/res/raw/<file> through one channel
// per sound (channel sounds are immutable, so the sender picks the channel from
// the customer's saved preference). Regenerate with
// node scripts/sounds/render-notification-sounds.mjs
import fs from 'node:fs';
const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };
const sounds = read('src/features/notifications/premiumSounds.ts');
const player = read('src/features/notifications/notificationSoundPlayer.ts');
const native = read('src/features/notifications/androidSoundChannels.ts');
const nativePush = read('src/features/notifications/nativePush.ts');
const dispatch = read('supabase/functions/push-dispatch/index.ts');
const migration = read('supabase/migrations/20261004230000_push_notification_sound_v1.sql');
const vite = read('vite.config.ts');
const options = [...sounds.matchAll(/\{ id: '([a-z-]+)', label: '([^']+)'[^\n]*file: '([^']+)', webGain: ([\d.]+) \}/g)].map(m => ({ id: m[1], label: m[2], file: m[3], gain: Number(m[4]) }));
need(options.length === 5, `Expected 5 Golden Oremar sounds with files, found ${options.length}.`);
for (const { id, label, file, gain } of options) {
  need(/^go_sound_[a-z0-9_]+\.wav$/.test(file), `${id}: ${file} is not a valid Android res/raw name.`);
  need(gain > 0 && gain < 0.2, `${id}: webGain out of range.`);
  const web = `public/sounds/${file}`, raw = `android/app/src/main/res/raw/${file}`;
  if (!fs.existsSync(web) || !fs.existsSync(raw)) { failures.push(`${id} (${label}): ${web} and ${raw} must both exist.`); continue; }
  const a = fs.readFileSync(web), b = fs.readFileSync(raw);
  need(a.equals(b), `${id}: web and Android files differ.`);
  const pcm = a.toString('ascii', 0, 4) === 'RIFF' && a.toString('ascii', 8, 12) === 'WAVE' && a.readUInt16LE(20) === 1 && a.readUInt16LE(34) === 16;
  need(pcm, `${id}: ${file} must be a 16-bit PCM WAV.`);
  const seconds = pcm ? a.readUInt32LE(40) / a.readUInt32LE(28) : 0;
  need(seconds > 0.3 && seconds < 1.5, `${id}: duration ${seconds.toFixed(2)}s out of range.`);
  need(dispatch.includes(`"${id}": "${file.replace(/\.wav$/, '')}"`), `push-dispatch must map ${id} to res/raw ${file}.`);
}
need(/fetch\(notificationSoundUrl\(sound\)\)/.test(player) && /decodeAudioData/.test(player) && /playSoundFile\(sound\)/.test(sounds), 'Preview and in-app alerts must play the real file.');
need(/androidChannelIdFor\(sound: NotificationSoundId, enabled = true\) \{ return enabled \? `go-sound-\$\{sound\}-v1` : ANDROID_SILENT_CHANNEL_ID/.test(sounds) && /ANDROID_SILENT_CHANNEL_ID = 'go-sound-silent-v1'/.test(sounds), 'Channel ids must be go-sound-<id>-v1 and go-sound-silent-v1.');
need(/id: androidChannelIdFor\(option\.id\)/.test(native) && /sound: option\.file/.test(native) && /ANDROID_SILENT_CHANNEL_ID, name: 'Golden Oremar · Sessiz'/.test(native), 'The app must create one channel per sound file plus a silent channel.');
need(/channel_id: `go-sound-\$\{id\}-v1`, sound: ANDROID_SOUND_FILES\[id\]/.test(dispatch) && /channel_id: "go-sound-silent-v1"/.test(dispatch) && /rpc\("push_delivery_sound_preferences_v1"/.test(dispatch), 'push-dispatch must choose the channel from the saved sound.');
need(/grant execute on function public\.push_delivery_sound_preferences_v1\(bigint\[\]\) to service_role/.test(migration) && /from public, anon, authenticated/.test(migration) && /delivery\.status = 'processing'/.test(migration), 'Sound lookup must be service-role only and limited to claimed deliveries.');
need(/import\('\.\/androidSoundChannels'\)/.test(nativePush) && (nativePush.match(/ensureAndroidSoundChannels\(\)/g) || []).length >= 2, 'nativePush must create the sound channels on start and on registration.');
need(/startsWith\('\/sounds\/'\)/.test(vite), 'The PWA must cache the sound files.');
if (failures.length) { console.error(`Notification sound files audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`Notification sound files contract audit passed: ${options.map(o => o.label).join(', ')}.`);
