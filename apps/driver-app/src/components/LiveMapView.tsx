import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { driverApi, HeatmapCell } from '../services/driver';
import { colors } from '../theme';

interface Props {
  lat: number;
  lng: number;
  isOnline: boolean;
  homeLat?: number;
  homeLng?: number;
  isGoHomeMode?: boolean;
  style?: object;
}

const HEATMAP_REFRESH_MS = 60_000;

function heatmapColor(count: number): string {
  if (count >= 5) return 'rgba(220,38,38,0.45)';   // red — high demand
  if (count >= 3) return 'rgba(234,179,8,0.40)';   // yellow — medium
  return 'rgba(34,197,94,0.30)';                    // green — low
}

export function LiveMapView({ lat, lng, isOnline, homeLat, homeLng, isGoHomeMode, style }: Props) {
  const mapRef = useRef<MapView>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);

  useEffect(() => {
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      600,
    );
  }, [lat, lng]);

  useEffect(() => {
    if (!isOnline) { setHeatmap([]); return; }
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await driverApi.getDemandHeatmap(lat, lng);
        if (!cancelled) setHeatmap(res.data.data ?? []);
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, HEATMAP_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [isOnline, lat, lng]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {/* Driver marker */}
        <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverDot} />
        </Marker>

        {/* Home marker when go-home mode is active */}
        {isGoHomeMode && homeLat && homeLng && (
          <Marker
            coordinate={{ latitude: homeLat, longitude: homeLng }}
            title="Home"
            pinColor={colors.primary}
          />
        )}

        {/* Demand heatmap circles */}
        {heatmap.map((cell) => (
          <Circle
            key={cell.geohash}
            center={{ latitude: cell.lat, longitude: cell.lng }}
            radius={150}
            fillColor={heatmapColor(cell.count)}
            strokeColor="transparent"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  driverDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3, borderColor: colors.ink,
  },
});
