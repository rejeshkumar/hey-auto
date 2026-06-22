import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// silent=true when called from AppState foreground listener — skips prompts,
// just refreshes the token if permission is already granted
export async function registerPushToken(silent = false): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing === 'undetermined' && !silent) {
      // First time — explain why before the system prompt appears
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Enable Ride Alerts',
          'Allow notifications so you never miss a ride request, even when the app is in the background.',
          [{ text: 'Continue', onPress: () => resolve() }],
          { cancelable: false }
        );
      });
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    } else if (existing === 'denied' && !silent) {
      // Previously denied — prompt to open Settings (only on explicit login, not every foreground)
      Alert.alert(
        'Notifications Disabled',
        'You will miss ride requests when the app is in the background. Enable notifications in Settings to fix this.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rides', {
        name: 'Ride Requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ffbe0b',
        sound: 'default',
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '63955e68-b790-4b60-a828-f1108e1bac6f',
    })).data;
    await api.put('/notification/fcm-token', { fcmToken: token });
  } catch (err) {
    console.warn('[push] Token registration failed:', err);
  }
}
