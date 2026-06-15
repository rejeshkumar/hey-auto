import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';

const MAPS_API_KEY = 'AIzaSyBaOw8Yu2FKHSOSqnBbZNfPVBfJcD4J2i8';

interface Marker {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

interface Props {
  center: { lat: number; lng: number };
  markers?: Marker[];
  zoom?: number;
  style?: any;
}

function autoZoom(markers: Marker[]): number {
  if (markers.length < 2) return 15;
  const lats = markers.map(m => m.lat);
  const lngs = markers.map(m => m.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  const span = Math.max(latSpan, lngSpan);
  if (span < 0.005) return 16;
  if (span < 0.01)  return 15;
  if (span < 0.02)  return 14;
  if (span < 0.05)  return 13;
  if (span < 0.1)   return 12;
  if (span < 0.2)   return 11;
  if (span < 0.5)   return 10;
  return 9;
}

export function StaticMapView({ center, markers = [], zoom, style }: Props) {
  const url = useMemo(() => {
    const z = zoom ?? (markers.length >= 2 ? autoZoom(markers) : 15);
    // Build manually — URLSearchParams encodes | to %7C which breaks Google Static Maps
    const parts: string[] = [
      `center=${center.lat},${center.lng}`,
      `zoom=${z}`,
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
  }, [center.lat, center.lng, markers, zoom]);

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
