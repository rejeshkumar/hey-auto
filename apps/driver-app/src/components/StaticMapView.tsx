import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';

const MAPS_API_KEY = 'AIzaSyBaOw8Yu2FKHSOSqnBbZNfPVBfJcD4J2i8';
const ZOOM = 15;

interface Marker {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

interface Props {
  center: { lat: number; lng: number };
  markers?: Marker[];
  style?: any;
}

export function StaticMapView({ center, markers = [], style }: Props) {
  const url = useMemo(() => {
    // Build manually — URLSearchParams encodes | to %7C which breaks Google Static Maps
    const parts: string[] = [
      `center=${center.lat},${center.lng}`,
      `zoom=${ZOOM}`,
      `size=640x400`,
      `scale=2`,
      `maptype=roadmap`,
      `key=${MAPS_API_KEY}`,
    ];

    markers.forEach((m) => {
      const label = m.label ? `label:${m.label}|` : '';
      parts.push(`markers=color:${m.color}|${label}${m.lat},${m.lng}`);
    });

    return `https://maps.googleapis.com/maps/api/staticmap?${parts.join('&')}`;
  }, [center.lat, center.lng, markers]);

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: url }}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#EAF3EA' },
  image: { width: '100%', height: '100%' },
});
