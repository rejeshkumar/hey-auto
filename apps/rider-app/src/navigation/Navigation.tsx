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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: { borderTopColor: colors.borderLight, paddingBottom: 8, paddingTop: 8, height: 64 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen}
        options={{ tabBarLabel: t('home.whereTo'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" size={size} color={color} /> }} />
      <Tab.Screen name="HistoryTab" component={HistoryScreen}
        options={{ tabBarLabel: t('profile.myRides'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="history" size={size} color={color} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen}
        options={{ tabBarLabel: t('profile.title'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" size={size} color={color} /> }} />
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
  if (isLoading) return null;

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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
