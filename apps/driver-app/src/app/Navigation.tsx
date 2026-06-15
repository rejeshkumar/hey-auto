import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme';
import { useAuthStore } from '../hooks/useAuthStore';

import { PhoneScreen } from '../features/auth/PhoneScreen';
import { OtpScreen } from '../features/auth/OtpScreen';
import { RegistrationScreen } from '../features/auth/RegistrationScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { ActiveRideScreen } from '../features/ride/ActiveRideScreen';
import { EarningsScreen } from '../features/earnings/EarningsScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { DocumentsScreen } from '../features/profile/DocumentsScreen';
import { SubscriptionScreen } from '../features/profile/SubscriptionScreen';
import { VehicleScreen } from '../features/profile/VehicleScreen';
import { SetHomeLocationScreen } from '../features/profile/SetHomeLocationScreen';
import { RewardsScreen } from '../features/earnings/RewardsScreen';

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
          paddingBottom: 8,
          paddingTop: 8,
          height: 72,
          elevation: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 3, letterSpacing: 0.3 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Drive',
          tabBarIcon: ({ color, size }) => <Icon name="steering" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="EarningsTab"
        component={EarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ color, size }) => <Icon name="cash-multiple" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Icon name="history" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <Icon name="account" size={size} color={color} />,
        }}
      />
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
          <Stack.Screen name="Registration" component={RegistrationScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ActiveRide" component={ActiveRideScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="Vehicle" component={VehicleScreen} />
            <Stack.Screen name="SetHomeLocation" component={SetHomeLocationScreen} />
            <Stack.Screen name="Rewards" component={RewardsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
