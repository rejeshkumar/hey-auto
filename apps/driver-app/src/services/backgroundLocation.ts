import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

const API_URL = 'https://hey-auto-server-production.up.railway.app/api/v1';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;
  const { latitude, longitude } = data.locations[0].coords;
  try {
    // Use AsyncStorage directly — memCache is unavailable in background task context
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;
    await fetch(`${API_URL}/driver/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ lat: latitude, lng: longitude }),
    });
  } catch {}
});

export async function startBackgroundLocation() {
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') return;

  const { status: bg } = await Location.getBackgroundPermissionsAsync();
  if (bg !== 'granted') {
    await Location.requestBackgroundPermissionsAsync();
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      timeInterval: 15000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Aye Auto',
        notificationBody: 'Tracking your location for ride requests',
        notificationColor: '#ffbe0b',
      },
    });
  }
}

export async function stopBackgroundLocation() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
