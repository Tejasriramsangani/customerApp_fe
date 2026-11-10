import type { LocationData } from "../context/LocationContext";
import { apiClient } from "./api-client";
import { locateDevice, validCoordinates } from "./location-access";
import { distanceKm } from "./localities";
import { traceLocation } from './location-diagnostics';

export const hasPincode = (loc: Partial<LocationData>) =>
  /^\d{6}$/.test(loc.pincode || "");

/** Backward-compatible GPS entry point, shared by existing consumers. */
export async function getGpsPosition() {
  const result = await locateDevice();
  return result.position || null;
}

/** Only provider-resolved details are returned; valid coordinates survive lookup failures. */
export async function resolveAddress(
  latitude: number,
  longitude: number,
  prev: Partial<LocationData> = {},
): Promise<LocationData> {
  if (!validCoordinates(latitude, longitude))
    throw new Error("Invalid location coordinates");
  const sameDoorstep =
    prev.latitude != null &&
    prev.longitude != null &&
    distanceKm(prev.latitude, prev.longitude, latitude, longitude) <= 0.03;
  const base: LocationData = {
    areaName: "",
    city: "",
    state: "",
    pincode: "",
    formattedAddress: "",
    latitude,
    longitude,
    source: "gps",
    houseNumber: sameDoorstep ? prev.houseNumber : "",
    landmark: sameDoorstep ? prev.landmark : "",
  };
  try {
    const res = await apiClient.reverseGeocode<
      LocationData & { resolved: boolean }
    >(latitude, longitude);
    traceLocation('reverse.response', {
      requested: { latitude, longitude }, success: res.success,
      returned: { latitude: res.data?.latitude, longitude: res.data?.longitude },
      resolved: res.data?.resolved, areaName: res.data?.areaName,
    });
    if (res.success && res.data?.resolved)
      return { ...base, ...res.data, latitude, longitude };
  } catch {
    /* Preserve coordinates without inventing a locality or PIN. */
  }
  return base;
}

/** New Google map only: never fall back to the legacy suburb-only address. */
export async function resolveGoogleAddress(latitude: number, longitude: number): Promise<LocationData> {
  if (!validCoordinates(latitude, longitude)) throw new Error('Invalid location coordinates');
  const res = await apiClient.googleReverseGeocode<LocationData & { resolved: boolean }>(latitude, longitude);
  traceLocation('google-reverse.response', {
    requested: { latitude, longitude }, success: res.success,
    returned: { latitude: res.data?.latitude, longitude: res.data?.longitude },
    resolved: res.data?.resolved, areaName: res.data?.areaName,
  });
  if (!res.success || !res.data?.resolved)
    throw new Error('Google address lookup is unavailable. Please retry or search manually.');
  return { ...res.data, latitude, longitude, source: 'gps', houseNumber: '', landmark: '' };
}

export interface SearchPlace {
  placeId: string;
  areaName: string;
  label: string;
}
export function newSearchSession(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export interface SearchConfig {
  autocomplete: boolean;
  minimumCharacters: number;
  configured: boolean;
}
let searchConfig: Promise<SearchConfig> | null = null;
export function loadSearchConfig(): Promise<SearchConfig> {
  if (!searchConfig)
    searchConfig = apiClient
      .getSearchConfig<SearchConfig>()
      .then((res) => {
        if (!res.success) {
          searchConfig = null;
          throw new Error("Location search is unavailable");
        }
        return res.data;
      })
      .catch((error) => {
        searchConfig = null;
        throw error;
      });
  return searchConfig;
}
// Coalesce identical requests only while in flight; do not retain Google predictions across searches.
const pending = new Map<string, Promise<SearchPlace[]>>();
export function searchLocations(
  query: string,
  sessionToken: string,
  bias?: { latitude: number; longitude: number },
): Promise<SearchPlace[]> {
  const text = query.trim().replace(/\s+/g, " ").slice(0, 120);
  const key = JSON.stringify([text.toLowerCase(), sessionToken, bias]);
  const current = pending.get(key);
  if (current) return current;
  const promise = apiClient
    .searchPlaces<SearchPlace[]>(text, sessionToken, bias)
    .then((res) => {
      if (!res.success)
        throw new Error("Location search is unavailable. Please retry.");
      return Array.isArray(res.data) ? res.data : [];
    })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
export async function resolveSearchPlace(
  place: SearchPlace,
  sessionToken: string,
): Promise<LocationData> {
  const res = await apiClient.placeDetails<
    LocationData & { resolved: boolean }
  >(place.placeId, sessionToken);
  if (
    !res.success ||
    !res.data?.resolved ||
    !validCoordinates(res.data.latitude!, res.data.longitude!)
  )
    throw new Error("Could not resolve this place. Try again.");
  return res.data;
}
