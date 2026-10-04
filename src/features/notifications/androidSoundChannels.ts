import { PushNotifications } from '@capacitor/push-notifications';
import { ANDROID_SILENT_CHANNEL_ID, NOTIFICATION_SOUND_OPTIONS, RETIRED_ANDROID_CHANNEL_IDS, androidChannelIdFor } from './premiumSounds';

let soundChannelsReady: Promise<void> | null = null;

/* One Android channel per Golden Oremar sound (res/raw/go_sound_*.wav) plus a
   silent one. A channel's sound is fixed once created, so the push sender picks
   the channel matching the customer's saved sound instead of editing a channel.
   The legacy channel stays for notifications sent before this version. */
export function ensureAndroidSoundChannels(legacyChannelId: string) {
  if (!soundChannelsReady) {
    soundChannelsReady = (async () => {
      const description = 'Sipariş, ödeme, teslimat, mesaj ve hesap bildirimleri';
      await PushNotifications.createChannel({ id: legacyChannelId, name: 'Golden Oremar', description });
      for (const option of NOTIFICATION_SOUND_OPTIONS) {
        await PushNotifications.createChannel({
          id: androidChannelIdFor(option.id),
          name: `Golden Oremar · ${option.label}`,
          description,
          sound: option.file,
          importance: 3,
        });
      }
      await PushNotifications.createChannel({ id: ANDROID_SILENT_CHANNEL_ID, name: 'Golden Oremar · Sessiz', description, importance: 2 });
      // Sound files changed in 1.3.14: drop the -v1 channels (their sound is fixed).
      for (const id of RETIRED_ANDROID_CHANNEL_IDS) await PushNotifications.deleteChannel({ id }).catch(() => {});
    })().catch(error => {
      soundChannelsReady = null;
      if (process.env.NODE_ENV === 'development') console.warn('Notification channels failed', error);
    });
  }
  return soundChannelsReady;
}
