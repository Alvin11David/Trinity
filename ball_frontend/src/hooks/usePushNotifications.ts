import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { registerExpoPushToken } from '../api/notifications';

// Remote push was REMOVED from Expo Go in SDK 53. Merely importing
// expo-notifications there runs its push auto-registration side effect
// (DevicePushTokenAutoRegistration.fx.js), which throws at import time — before
// any try/catch of ours can run. So in Expo Go we must never load the module at
// all: the import below is dynamic and gated on `isExpoGo`. Push works in a
// dev/production build; in-app notifications work everywhere regardless.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Request notification permission, get the Expo push token, and register it
 * with the backend (CLAUDE.md 36.4 / Step 7). No-op in Expo Go and fully
 * defensive elsewhere (simulator, denied permission, missing EAS projectId).
 */
export function useRegisterPushToken(enabled: boolean) {
  useEffect(() => {
    if (!enabled || isExpoGo) return;
    (async () => {
      try {
        // Dynamic import so expo-notifications' module side effects never
        // evaluate in Expo Go (see note above).
        const Notifications = await import('expo-notifications');

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== 'granted') return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          (Constants as any)?.easConfig?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        await registerExpoPushToken(
          tokenResponse.data,
          Platform.OS === 'ios' ? 'ios' : 'android',
        );
      } catch (err) {
        console.warn('Push registration skipped:', err);
      }
    })();
  }, [enabled]);
}
