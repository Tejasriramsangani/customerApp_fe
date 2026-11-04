import type { LocationData } from '../context/LocationContext';

// Approximate locality centroids so address create works even if GPS is denied, and so a GPS fix can be
// matched to a known locality when the address lookup is unavailable.
export const POPULAR_LOCALITIES: LocationData[] = [
  {
    areaName: "Satyanarayanapuram",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520011",
    latitude: 16.5205,
    longitude: 80.6305,
    formattedAddress: "Satyanarayanapuram, Vijayawada, AP - 520011",
  },
  {
    areaName: "Benz Circle",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520010",
    latitude: 16.5033,
    longitude: 80.6469,
    formattedAddress: "Benz Circle, MG Road, Vijayawada, AP - 520010",
  },
  {
    areaName: "Moghalrajpuram",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520010",
    latitude: 16.5108,
    longitude: 80.6482,
    formattedAddress: "Moghalrajpuram, Siddhartha College Area, Vijayawada, AP - 520010",
  },
  {
    areaName: "Governorpet",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520002",
    latitude: 16.5132,
    longitude: 80.6215,
    formattedAddress: "Governorpet, Commercial District, Vijayawada, AP - 520002",
  },
  {
    areaName: "Bhavanipuram",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520012",
    latitude: 16.5402,
    longitude: 80.5985,
    formattedAddress: "Bhavanipuram, National Highway, Vijayawada, AP - 520012",
  },
  {
    areaName: "Patamata",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520014",
    latitude: 16.4955,
    longitude: 80.6698,
    formattedAddress: "Patamata, High School Road, Vijayawada, AP - 520014",
  },
  {
    areaName: "Auto Nagar",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520007",
    latitude: 16.4821,
    longitude: 80.6884,
    formattedAddress: "Auto Nagar Industrial Hub, Vijayawada, AP - 520007",
  },
  {
    areaName: "One Town",
    city: "Vijayawada", state: "Andhra Pradesh",
    pincode: "520001",
    latitude: 16.5158,
    longitude: 80.6152,
    formattedAddress: "One Town, Temple Road, Vijayawada, AP - 520001",
  },
];

const EARTH_RADIUS_KM = 6371;

/** Straight-line distance between two GPS points, in km. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** The known locality closest to a GPS point, if one is within maxKm. */
export function nearestLocality(latitude: number, longitude: number, maxKm: number): LocationData | null {
  let best: LocationData | null = null;
  let bestKm = Infinity;
  for (const locality of POPULAR_LOCALITIES) {
    const km = distanceKm(latitude, longitude, locality.latitude!, locality.longitude!);
    if (km < bestKm) {
      best = locality;
      bestKm = km;
    }
  }
  return best && bestKm <= maxKm ? best : null;
}
