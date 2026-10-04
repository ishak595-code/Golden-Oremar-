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
  /** Real audio file rendered by scripts/sounds/render-notification-sounds.mjs.
      The same file ships at public/sounds/<file> (web/PWA) and
      android/app/src/main/res/raw/<file> (Android notification channel). */
  file: string;
  /** Loudness of the original in-app motif; the files are normalised to -1 dBFS. */
  webGain: number;
};

/* IDs remain backward-compatible with persisted customer preferences. Labels and
   synthesis intentionally avoid novelty animal imitations: Golden Oremar uses a
   restrained five-sound sonic identity that feels native to a premium commerce app. */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  { id: 'oremar-drop', label: 'Oremar Kristali', description: 'Kısa kristal dokunuş ve yumuşak su kuyruğu. Varsayılan Golden Oremar imzası.', file: 'go_sound_oremar_drop.wav', webGain: 0.06 },
  { id: 'mountain-birds', label: 'Dağ Esintisi', description: 'Hafif hava dokusu üzerinde iki zarif yüksek nota; ferah ve sakin.', file: 'go_sound_mountain_birds.wav', webGain: 0.0335 },
  { id: 'dawn-rooster', label: 'Şafak İmzası', description: 'Sıcak üç notalı sabah motifi; doğal çağrışımlı ama taklit ses kullanmaz.', file: 'go_sound_dawn_rooster.wav', webGain: 0.0319 },
  { id: 'partridge-call', label: 'Zümrüt Yankı', description: 'Derin zümrüt tonunda iki kısa yankı ve ince harmonik kapanış.', file: 'go_sound_partridge_call.wav', webGain: 0.0297 },
  { id: 'highland-bell', label: 'Şampanya Çanı', description: 'Yumuşak metalik parlaklık ve kısa, rafine bir premium kapanış.', file: 'go_sound_highland_bell.wav', webGain: 0.0497 },
];

const SOUND_KEY = 'golden-oremar:notification-sound:v1';
const ENABLED_KEY = 'golden-oremar:notification-sound-enabled:v1';
const PREFERENCE_EVENT = 'golden-oremar:notification-sound-change';
const DEFAULT_SOUND: NotificationSoundId = 'oremar-drop';

/* Android notification channels cannot change their sound after creation, so
   every sound has its own channel id (and a silent one for "sound off"). The
   push sender picks the channel from the customer's saved preference; bump the
   -v suffix whenever a sound file changes. Keep in sync with
   supabase/functions/push-dispatch/index.ts. */
export const ANDROID_SILENT_CHANNEL_ID = 'go-sound-silent-v1';
export function androidChannelIdFor(sound: NotificationSoundId, enabled = true) { return enabled ? `go-sound-${sound}-v1` : ANDROID_SILENT_CHANNEL_ID; }
export function notificationSoundUrl(sound: NotificationSoundId) { return `/sounds/${soundOption(sound).file}`; }
export function soundOption(sound: NotificationSoundId) { return NOTIFICATION_SOUND_OPTIONS.find(option => option.id === sound) || NOTIFICATION_SOUND_OPTIONS[0]; }

function isSound(value: unknown): value is NotificationSoundId { return NOTIFICATION_SOUND_OPTIONS.some(option => option.id === value); }
export function getNotificationSound(): NotificationSoundId { if (typeof window === 'undefined') return DEFAULT_SOUND; try { const value = window.localStorage.getItem(SOUND_KEY); return isSound(value) ? value : DEFAULT_SOUND; } catch { return DEFAULT_SOUND; } }
export function getNotificationSoundEnabled() { if (typeof window === 'undefined') return true; try { return window.localStorage.getItem(ENABLED_KEY) !== 'false'; } catch { return true; } }
function emitPreferenceChange() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFERENCE_EVENT)); }
export function setNotificationSound(sound: NotificationSoundId) { if (typeof window !== 'undefined') { try { window.localStorage.setItem(SOUND_KEY, sound); } catch {} } emitPreferenceChange(); }
export function setNotificationSoundEnabled(enabled: boolean) { if (typeof window !== 'undefined') { try { window.localStorage.setItem(ENABLED_KEY, String(enabled)); } catch {} } emitPreferenceChange(); }
export function subscribeNotificationSoundPreference(listener: () => void) { if (typeof window === 'undefined') return () => {}; window.addEventListener(PREFERENCE_EVENT, listener); return () => window.removeEventListener(PREFERENCE_EVENT, listener); }
// The player (file decoding + WebAudio fallback synthesis) is a lazy chunk.
const loadPlayer = () => import('./notificationSoundPlayer');
export async function primeNotificationAudio() { try { await (await loadPlayer()).primeNotificationAudio(getNotificationSound()); } catch {} }
/** Plays the real sound file (the one Android channels use). */
export async function playNotificationSound(sound = getNotificationSound(), options?: { force?: boolean }) {
  if (!options?.force && !getNotificationSoundEnabled()) return false;
  try { return await (await loadPlayer()).playSoundFile(sound); } catch { return false; }
}
