import type { LocationData } from '../context/LocationContext';
import { apiClient } from './api-client';
import { distanceKm, nearestLocality } from './localities';

export interface MapConfig {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
}

/** Used only when the backend cannot be reached: OpenStreetMap's free tiles. */
const FALLBACK_MAP_CONFIG: MapConfig = {
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

let mapConfigPromise: Promise<MapConfig> | null = null;

/** Map tile settings from the backend (asked once, then remembered); never rejects. */
export function loadMapConfig(): Promise<MapConfig> {
  if (!mapConfigPromise) {
    mapConfigPromise = apiClient
      .getMapConfig<MapConfig>()
      .then((res) => (res.success && res.data?.tileUrl ? res.data : null))
      .catch(() => null)
      .then((config) => {
        if (!config) mapConfigPromise = null; // not reachable right now: ask again next time
        return config || FALLBACK_MAP_CONFIG;
      });
  }
  return mapConfigPromise;
}

export const hasPincode = (loc: Partial<LocationData>) => /^\d{6}$/.test(loc.pincode || '');

/** A GPS fix this close to the last one is the same place (the old address still applies). */
const SAME_PLACE_KM = 1;

/** The phone's current GPS position, or null when it is denied / unavailable / times out. */
export function getGpsPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

/**
 * Turns a GPS fix into a full address: area, city, state and PIN code. Asks the server to look the
 * coordinates up; if that is unavailable, falls back to the nearest known locality, and only as a last
 * resort keeps the bare coordinates (which the app then treats as an incomplete address).
 *
 * `prev` is the last known location: its other fields (house number, ...) are kept, and its address is
 * reused when the new fix is still the same place and the lookup is unavailable.
 */
export async function resolveAddress(
  latitude: number,
  longitude: number,
  prev: Partial<LocationData> = {},
): Promise<LocationData> {
  // House number and landmark belong to one doorstep: keep them while the customer is still at the same
  // place (an app restart), drop them once the position has really moved.
  const stillThere =
    prev.latitude == null ||
    prev.longitude == null ||
    distanceKm(prev.latitude, prev.longitude, latitude, longitude) < SAME_PLACE_KM;
  const base = {
    areaName: '',
    city: '',
    state: '',
    pincode: '',
    formattedAddress: '',
    ...prev,
    houseNumber: stillThere ? prev.houseNumber : '',
    landmark: stillThere ? prev.landmark : '',
    latitude,
    longitude,
    source: 'gps' as const,
  } satisfies LocationData;

  let place: any = null;
  try {
    const res = await apiClient.reverseGeocode<any>(latitude, longitude);
    if (res.success && res.data?.resolved) place = res.data;
  } catch {
    /* fall through to the fallbacks */
  }

  if (place) {
    let pincode: string = place.pincode || '';
    let formattedAddress: string = place.formattedAddress || '';
    if (!pincode) {
      // The lookup found the area but no PIN: borrow it from a known locality right next to it.
      const near = nearestLocality(latitude, longitude, 5);
      if (near) {
        pincode = near.pincode;
        formattedAddress = `${formattedAddress || near.areaName} - ${near.pincode}`;
      }
    }
    return {
      ...base,
      areaName: place.areaName || place.city || 'Current location',
      city: place.city || '',
      state: place.state || '',
      pincode,
      formattedAddress: formattedAddress || `GPS Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
    };
  }

  // Still the same place as the last resolved address: keep that address, just refresh the coordinates.
  if (
    hasPincode(prev) &&
    prev.latitude != null &&
    prev.longitude != null &&
    distanceKm(prev.latitude, prev.longitude, latitude, longitude) < SAME_PLACE_KM
  ) {
    return base;
  }

  const near = nearestLocality(latitude, longitude, 12);
  if (near) {
    return {
      ...base,
      areaName: near.areaName,
      city: near.city,
      state: near.state || '',
      pincode: near.pincode,
      formattedAddress: near.formattedAddress,
    };
  }

  return {
    ...base,
    areaName: 'Current location',
    city: '',
    state: '',
    pincode: '',
    formattedAddress: `GPS Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
  };
}
