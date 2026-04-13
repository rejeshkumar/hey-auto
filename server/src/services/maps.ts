import { env } from '../config/env';
import { logger } from '../utils/logger';

const MAPS_BASE = 'https://maps.googleapis.com/maps/api';

interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  polyline: string;
  steps: RouteStep[];
  startAddress: string;
  endAddress: string;
}

export interface RouteStep {
  instruction: string;
  distanceKm: number;
  durationMin: number;
  startLocation: LatLng;
  endLocation: LatLng;
  polyline: string;
  maneuver?: string;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface GeocodedAddress {
  address: string;
  lat: number;
  lng: number;
  locality?: string;
  district?: string;
  state?: string;
}

class MapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = env.GOOGLE_MAPS_API_KEY || '';
  }

  private get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async fetch<T>(url: string): Promise<T> {
    const response = await globalThis.fetch(url);
    if (!response.ok) {
      throw new Error(`Maps API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  /**
   * Get driving route between two points using Directions API.
   * Falls back to haversine estimation if API key is not configured.
   */
  async getRoute(origin: LatLng, destination: LatLng): Promise<RouteInfo> {
    if (!this.isConfigured) {
      return this.estimateRoute(origin, destination);
    }

    try {
      const url =
        `${MAPS_BASE}/directions/json` +
        `?origin=${origin.lat},${origin.lng}` +
        `&destination=${destination.lat},${destination.lng}` +
        `&mode=driving` +
        `&language=ml` +
        `&region=in` +
        `&key=${this.apiKey}`;

      const data = await this.fetch<any>(url);

      if (data.status !== 'OK' || !data.routes?.length) {
        logger.warn({ status: data.status }, 'Directions API returned no routes, falling back');
        return this.estimateRoute(origin, destination);
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      const steps: RouteStep[] = leg.steps.map((step: any) => ({
        instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
        distanceKm: step.distance.value / 1000,
        durationMin: Math.ceil(step.duration.value / 60),
        startLocation: { lat: step.start_location.lat, lng: step.start_location.lng },
        endLocation: { lat: step.end_location.lat, lng: step.end_location.lng },
        polyline: step.polyline.points,
        maneuver: step.maneuver,
      }));

      return {
        distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
        durationMin: Math.ceil(leg.duration.value / 60),
        polyline: route.overview_polyline.points,
        steps,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
      };
    } catch (err) {
      logger.error({ err }, 'Directions API failed, falling back to estimate');
      return this.estimateRoute(origin, destination);
    }
  }

  /**
   * Search for places using Places Autocomplete API.
   * Biased towards Taliparamba / Kannur area.
   */
  async searchPlaces(query: string, sessionToken?: string): Promise<PlacePrediction[]> {
    if (!this.isConfigured) {
      return this.searchLocalPlaces(query);
    }

    try {
      const url =
        `${MAPS_BASE}/place/autocomplete/json` +
        `?input=${encodeURIComponent(query)}` +
        `&location=12.0368,75.3614` +
        `&radius=20000` +
        `&strictbounds=false` +
        `&components=country:in` +
        `&language=en` +
        `&types=establishment|geocode` +
        (sessionToken ? `&sessiontoken=${sessionToken}` : '') +
        `&key=${this.apiKey}`;

      const data = await this.fetch<any>(url);

      if (data.status !== 'OK') {
        return this.searchLocalPlaces(query);
      }

      return data.predictions.map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));
    } catch (err) {
      logger.error({ err }, 'Places Autocomplete failed');
      return this.searchLocalPlaces(query);
    }
  }

  /**
   * Get place details (coordinates) from a place ID.
   */
  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<PlaceDetails | null> {
    if (!this.isConfigured) return null;

    try {
      const url =
        `${MAPS_BASE}/place/details/json` +
        `?place_id=${placeId}` +
        `&fields=name,formatted_address,geometry` +
        (sessionToken ? `&sessiontoken=${sessionToken}` : '') +
        `&key=${this.apiKey}`;

      const data = await this.fetch<any>(url);

      if (data.status !== 'OK' || !data.result) return null;

      return {
        placeId,
        name: data.result.name,
        address: data.result.formatted_address,
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng,
      };
    } catch (err) {
      logger.error({ err }, 'Place Details failed');
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to an address.
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress | null> {
    if (!this.isConfigured) {
      return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng };
    }

    try {
      const url =
        `${MAPS_BASE}/geocode/json` +
        `?latlng=${lat},${lng}` +
        `&language=en` +
        `&key=${this.apiKey}`;

      const data = await this.fetch<any>(url);

      if (data.status !== 'OK' || !data.results?.length) return null;

      const result = data.results[0];
      const components = result.address_components || [];
      const getComponent = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name;

      return {
        address: result.formatted_address,
        lat,
        lng,
        locality: getComponent('locality'),
        district: getComponent('administrative_area_level_2'),
        state: getComponent('administrative_area_level_1'),
      };
    } catch (err) {
      logger.error({ err }, 'Reverse geocode failed');
      return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng };
    }
  }

  /**
   * Get ETA from driver's current position to pickup point.
   */
  async getDriverETA(driverLocation: LatLng, pickup: LatLng): Promise<{ distanceKm: number; durationMin: number }> {
    if (!this.isConfigured) {
      const dist = this.haversineDistance(driverLocation, pickup);
      return { distanceKm: dist, durationMin: Math.ceil(dist * 3) };
    }

    try {
      const url =
        `${MAPS_BASE}/distancematrix/json` +
        `?origins=${driverLocation.lat},${driverLocation.lng}` +
        `&destinations=${pickup.lat},${pickup.lng}` +
        `&mode=driving` +
        `&region=in` +
        `&key=${this.apiKey}`;

      const data = await this.fetch<any>(url);

      if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
        const dist = this.haversineDistance(driverLocation, pickup);
        return { distanceKm: dist, durationMin: Math.ceil(dist * 3) };
      }

      const el = data.rows[0].elements[0];
      if (el.status !== 'OK') {
        const dist = this.haversineDistance(driverLocation, pickup);
        return { distanceKm: dist, durationMin: Math.ceil(dist * 3) };
      }

      return {
        distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
        durationMin: Math.ceil(el.duration.value / 60),
      };
    } catch {
      const dist = this.haversineDistance(driverLocation, pickup);
      return { distanceKm: dist, durationMin: Math.ceil(dist * 3) };
    }
  }

  // ── Fallback methods (no API key needed) ──

  private estimateRoute(origin: LatLng, destination: LatLng): RouteInfo {
    const distKm = this.haversineDistance(origin, destination);
    const roadFactor = 1.35;
    const roadDistance = Math.round(distKm * roadFactor * 10) / 10;
    const durationMin = Math.ceil(roadDistance * 3);

    return {
      distanceKm: roadDistance,
      durationMin,
      polyline: this.encodePolyline([origin, destination]),
      steps: [
        {
          instruction: `Head towards destination (${roadDistance} km)`,
          distanceKm: roadDistance,
          durationMin,
          startLocation: origin,
          endLocation: destination,
          polyline: this.encodePolyline([origin, destination]),
        },
      ],
      startAddress: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
      endAddress: `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`,
    };
  }

  private searchLocalPlaces(query: string): PlacePrediction[] {
    const TALIPARAMBA_PLACES = [
      { id: 'tp_bus', name: 'Taliparamba Bus Stand', ml: 'തളിപ്പറമ്പ് ബസ് സ്റ്റാൻഡ്' },
      { id: 'tp_kannapuram', name: 'Kannapuram Railway Station', ml: 'കണ്ണപുരം റെയിൽവേ സ്റ്റേഷൻ' },
      { id: 'tp_trichambaram', name: 'Trichambaram Temple', ml: 'തൃച്ചംബരം ക്ഷേത്രം' },
      { id: 'tp_rajarajeshwara', name: 'Rajarajeshwara Temple', ml: 'രാജരാജേശ്വര ക്ഷേത്രം' },
      { id: 'tp_hospital', name: 'Govt Hospital Taliparamba', ml: 'താലൂക്ക് ആശുപത്രി' },
      { id: 'tp_manna', name: 'Manna Junction', ml: 'മണ്ണ ജംഗ്ഷൻ' },
      { id: 'tp_parassinikadavu', name: 'Parassinikkadavu Temple', ml: 'പറശ്ശിനിക്കടവ് ക്ഷേത്രം' },
      { id: 'tp_kuttiyeri', name: 'Kuttiyeri Hanging Bridge', ml: 'കുറ്റിയേരി തൂക്കുപാലം' },
    ];

    const q = query.toLowerCase();
    return TALIPARAMBA_PLACES
      .filter((p) => p.name.toLowerCase().includes(q) || p.ml.includes(query))
      .map((p) => ({
        placeId: p.id,
        description: `${p.name}, Taliparamba, Kannur`,
        mainText: p.name,
        secondaryText: 'Taliparamba, Kannur District',
      }));
  }

  private haversineDistance(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(a.lat)) * Math.cos(this.toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Encode an array of lat/lng points into a Google polyline string.
   * Used as fallback when no API key is present.
   */
  private encodePolyline(points: LatLng[]): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const point of points) {
      const lat = Math.round(point.lat * 1e5);
      const lng = Math.round(point.lng * 1e5);
      encoded += this.encodeSignedNumber(lat - prevLat);
      encoded += this.encodeSignedNumber(lng - prevLng);
      prevLat = lat;
      prevLng = lng;
    }
    return encoded;
  }

  private encodeSignedNumber(num: number): string {
    let sgn = num << 1;
    if (num < 0) sgn = ~sgn;
    return this.encodeNumber(sgn);
  }

  private encodeNumber(num: number): string {
    let encoded = '';
    while (num >= 0x20) {
      encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
      num >>= 5;
    }
    encoded += String.fromCharCode(num + 63);
    return encoded;
  }
}

export const mapsService = new MapsService();
