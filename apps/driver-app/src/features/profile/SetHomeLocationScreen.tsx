import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi } from '../../services/driver';

export function SetHomeLocationScreen({ navigation }: any) {
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const detectCurrentLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = pos.coords;
      setCoords({ lat, lng });
      // Reverse geocode
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo[0]) {
        const g = geo[0];
        const parts = [g.name, g.street, g.district, g.city, g.region].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      Alert.alert('Error', 'Could not detect location');
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!address.trim()) { Alert.alert('Required', 'Please enter your home address'); return; }
    if (!coords) { Alert.alert('Required', 'Please detect your location first or enter coordinates'); return; }
    setSaving(true);
    try {
      await driverApi.setHomeLocation(coords.lat, coords.lng, address.trim());
      Alert.alert('Saved', 'Home location updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save home location');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Location</Text>
      <Text style={styles.subtitle}>
        Set your home so drivers can be matched to rides heading your way at end of shift.
      </Text>

      <TouchableOpacity style={styles.detectBtn} onPress={detectCurrentLocation} disabled={detecting}>
        {detecting
          ? <ActivityIndicator color={colors.ink} />
          : <Text style={styles.detectBtnText}>📍 Use Current Location</Text>
        }
      </TouchableOpacity>

      {coords && (
        <Text style={styles.coordsText}>
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </Text>
      )}

      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Home address"
        placeholderTextColor={colors.textSecondary}
        multiline
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color={colors.ink} />
          : <Text style={styles.saveBtnText}>Save Home Location</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: 60 },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 20 },
  detectBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.base, alignItems: 'center', marginBottom: spacing.base,
  },
  detectBtnText: { ...typography.body, fontWeight: '700', color: colors.ink },
  coordsText: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center' },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg,
    padding: spacing.base, ...typography.body, color: colors.text,
    backgroundColor: colors.white, minHeight: 80, textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.base + 2, alignItems: 'center',
  },
  saveBtnText: { ...typography.h4, color: colors.ink },
});
