import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return; // User declined — silent, don't block login
    }

    // On Android, a channel is required for notifications to appear
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rides', {
        name: 'Ride Requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F5C800',
        sound: 'default',
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.put('/notification/fcm-token', { fcmToken: token });
  } catch (err) {
    // Non-fatal — app works without push, just falls back to socket
    console.warn('[push] Token registration failed:', err);
  }
}
