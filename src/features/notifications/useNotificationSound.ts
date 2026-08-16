import { useCallback, useState } from 'react';
import {
  getStoredNotificationSound,
  persistNotificationSound,
  playNotificationSound,
  type NotificationSoundId,
} from './notificationSound';

export function useNotificationSound() {
  const [sound, setSoundState] = useState<NotificationSoundId>(() => getStoredNotificationSound());

  const setSound = useCallback((next: NotificationSoundId) => {
    persistNotificationSound(next);
    setSoundState(next);
  }, []);

  const previewSound = useCallback(async (candidate?: NotificationSoundId) => {
    return playNotificationSound(candidate || sound);
  }, [sound]);

  return { sound, setSound, previewSound };
}
