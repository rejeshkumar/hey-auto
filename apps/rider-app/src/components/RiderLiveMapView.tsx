import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

interface Props {
  driverLat?: number;
  driverLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  showDropoff?: boolean;
  style?: object;
}

export function RiderLiveMapView({
  driverLat, driverLng,
  pickupLat, pickupLng,
  dropoffLat, dropoffLng,
  showDropoff = false,
  style,
}: Props) {
  const mapRef = useRef<MapView>(null);

  // Re-center on driver whenever their location updates
  useEffect(() => {
    if (!driverLat || !driverLng) return;
    mapRef.current?.animateToRegion(
      { latitude: driverLat, longitude: driverLng, latitudeDelta: 0.015, longitudeDelta: 0.015 },
      500,
    );
  }, [driverLat, driverLng]);

  const centerLat = driverLat ?? pickupLat ?? 12.9716;
  const centerLng = driverLng ?? pickupLng ?? 77.5946;

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={{
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {/* Driver pin */}
      {driverLat != null && driverLng != null && (
        <Marker
          coordinate={{ latitude: driverLat, longitude: driverLng }}
          anchor={{ x: 0.5, y: 0.5 }}
          title="Your Sarathi"
        >
          {/* Using default pin styled via title — custom image can be added later */}
        </Marker>
      )}

      {/* Pickup pin */}
      {pickupLat != null && pickupLng != null && (
        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          pinColor="#00C853"
          title="Pickup"
        />
      )}

      {/* Dropoff pin — only shown once ride starts */}
      {showDropoff && dropoffLat != null && dropoffLng != null && (
        <Marker
          coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
          pinColor="#FF3B30"
          title="Drop-off"
        />
      )}

      {/* Straight line driver → pickup while approaching */}
      {!showDropoff && driverLat != null && driverLng != null && pickupLat != null && pickupLng != null && (
        <Polyline
          coordinates={[
            { latitude: driverLat, longitude: driverLng },
            { latitude: pickupLat, longitude: pickupLng },
          ]}
          strokeColor="#F5C800"
          strokeWidth={3}
          lineDashPattern={[8, 4]}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
