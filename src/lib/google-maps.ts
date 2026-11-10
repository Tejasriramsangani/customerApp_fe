export interface LatLng {
  lat(): number;
  lng(): number;
}
export interface Point {
  lat: number;
  lng: number;
}
export interface MapsListener {
  remove(): void;
}
export interface GoogleMap {
  getCenter(): LatLng | undefined;
  setCenter(point: Point): void;
  setZoom(zoom: number): void;
  addListener(event: string, callback: () => void): MapsListener;
}
export interface GoogleOverlay {
  setMap(map: GoogleMap | null): void;
}
export interface GoogleMaps {
  Map: new (
    container: HTMLElement,
    options: {
      center: Point;
      zoom: number;
      disableDefaultUI: boolean;
      gestureHandling: string;
      mapId?: string;
    },
  ) => GoogleMap;
  Circle: new (options: {
    map: GoogleMap;
    center: Point;
    radius: number;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWeight: number;
    clickable: boolean;
  }) => GoogleOverlay;
  Polyline: new (options: {
    map: GoogleMap;
    path: Point[];
    strokeColor: string;
    strokeWeight: number;
    strokeOpacity: number;
    geodesic: boolean;
    clickable: boolean;
  }) => GoogleOverlay;
  event: {
    clearInstanceListeners(instance: GoogleMap): void;
    trigger(instance: GoogleMap, event: string): void;
  };
}
declare global {
  interface Window {
    google?: { maps: GoogleMaps };
    asliGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}
let loading: Promise<GoogleMaps> | null = null;
let authorizationFailed = false;

/** A browser-restricted key is required for Maps JS; the backend credential is never used here. */
export function loadGoogleMaps(): Promise<GoogleMaps> {
  if (authorizationFailed) return Promise.reject(new Error(
    'Google Maps authorization failed. Correct the website key restrictions for this app origin, then reload the app.',
  ));
  if (window.google?.maps.Map) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key)
    return Promise.reject(
      new Error(
        "Google Maps is not configured. Please configure the browser Maps key.",
      ),
    );
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 15000);
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(
        new Error(
          "Google Maps could not load. Check the connection and Maps API configuration.",
        ),
      );
    };
    window.asliGoogleMapsReady = () => {
      window.clearTimeout(timer);
      if (window.google?.maps.Map) resolve(window.google.maps);
      else fail();
    };
    window.gm_authFailure = () => {
      authorizationFailed = true;
      window.dispatchEvent(new Event("google-maps-auth-error"));
      fail();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=asliGoogleMapsReady&v=quarterly`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
