import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { driverApi, HeatmapCell } from '../services/driver';
import { colors } from '../theme';
import type { Hotspot } from '../hooks/useHotspotStore';

const ORANGE_STROKE = '#F97316';
const ORANGE_FILL_OUTER = 'rgba(249,115,22,0.15)';
const ORANGE_FILL_INNER = 'rgba(249,115,22,0.28)';

interface Props {
  lat: number;
  lng: number;
  isOnline: boolean;
  homeLat?: number;
  homeLng?: number;
  isGoHomeMode?: boolean;
  hotspots?: Hotspot[];
  style?: object;
}

const HEATMAP_REFRESH_MS = 60_000;

function heatmapColor(count: number): string {
  if (count >= 5) return 'rgba(220,38,38,0.45)';   // red — high demand
  if (count >= 3) return 'rgba(234,179,8,0.40)';   // yellow — medium
  return 'rgba(34,197,94,0.30)';                    // green — low
}

export function LiveMapView({ lat, lng, isOnline, homeLat, homeLng, isGoHomeMode, hotspots, style }: Props) {
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

        {/* Hotspot circles — orange glow at demand clusters */}
        {(hotspots ?? []).map((h) => {
          const strokeWidth = Math.min(2 + h.pendingCount * 0.5, 5);
          return (
            <React.Fragment key={h.id}>
              <Circle
                center={{ latitude: h.lat, longitude: h.lng }}
                radius={1500}
                strokeColor={ORANGE_STROKE}
                strokeWidth={strokeWidth}
                fillColor={ORANGE_FILL_OUTER}
              />
              <Circle
                center={{ latitude: h.lat, longitude: h.lng }}
                radius={500}
                strokeColor="transparent"
                fillColor={ORANGE_FILL_INNER}
              />
              <Marker coordinate={{ latitude: h.lat, longitude: h.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.hotspotMarker}>
                  <Text style={styles.hotspotMarkerText}>🔥{h.pendingCount}</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
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
  hotspotMarker: {
    backgroundColor: 'rgba(249,115,22,0.90)',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  hotspotMarkerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
