import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme';
import { useAuthStore } from '../hooks/useAuthStore';

import { PhoneScreen } from '../features/auth/PhoneScreen';
import { OtpScreen } from '../features/auth/OtpScreen';
import { ProfileSetupScreen } from '../features/auth/ProfileSetupScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { SearchScreen } from '../features/booking/SearchScreen';
import { BookingConfirmScreen } from '../features/booking/BookingConfirmScreen';
import { ActiveRideScreen } from '../features/ride/ActiveRideScreen';
import { RideCompleteScreen } from '../features/ride/RideCompleteScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { EditProfileScreen } from '../features/profile/EditProfileScreen';
import { SavedPlacesScreen } from '../features/profile/SavedPlacesScreen';
import { EmergencyContactsScreen } from '../features/profile/EmergencyContactsScreen';
import { PaymentMethodsScreen } from '../features/profile/PaymentMethodsScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { VoiceBookingScreen } from '../features/voice/VoiceBookingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 8, paddingTop: 8, height: 72,
          elevation: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" size={size} color={color} /> }} />
      <Tab.Screen name="HistoryTab" component={HistoryScreen}
        options={{ tabBarLabel: 'My Rides', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="history" size={size} color={color} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" size={size} color={color} /> }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="OTP" component={OtpScreen} />
    </Stack.Navigator>
  );
}

export function Navigation() {
  const { isAuthenticated, isLoading, isNewUser } = useAuthStore();
  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setLoadingTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  if (isLoading && !loadingTimedOut) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : isNewUser ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
            <Stack.Screen name="ActiveRide" component={ActiveRideScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="RideComplete" component={RideCompleteScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="SavedPlaces" component={SavedPlacesScreen} />
            <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
            <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <Stack.Screen name="VoiceBooking" component={VoiceBookingScreen} options={{ animation: 'slide_from_bottom' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
