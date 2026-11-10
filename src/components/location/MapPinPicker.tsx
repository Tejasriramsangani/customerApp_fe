"use client";

import { Button } from "../ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Crosshair,
  Loader2,
  MapPin,
  Check,
} from "lucide-react";
import { hasPincode, resolveGoogleAddress } from "../../lib/geo-client";
import type { LocationData } from "../../context/LocationContext";
import { DevicePosition, validCoordinates } from "../../lib/location-access";
import {
  GoogleMap,
  GoogleOverlay,
  loadGoogleMaps,
} from "../../lib/google-maps";
import { useLocationAccess } from "./useLocationAccess";
import styles from './LocationViewport.module.css';
import { locationDiagnosticsEnabled, traceLocation } from '../../lib/location-diagnostics';

export interface PinnedPlace {
  areaName: string;
  city: string;
  state: string;
  pincode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}
interface MapPinPickerProps {
  latitude?: number;
  longitude?: number;
  onConfirm: (place: PinnedPlace) => void;
  onClose: () => void;
  onSearch?: () => void;
  detectOnOpen?: boolean;
  currentPosition?: DevicePosition | null;
  inline?: boolean;
  active?: boolean;
}
const DEFAULT_ZOOM = 17;
type Coordinates = { latitude: number; longitude: number };
const samePoint = (a: Coordinates | null, b: Coordinates) =>
  !!a &&
  Math.abs(a.latitude - b.latitude) < 1e-7 &&
  Math.abs(a.longitude - b.longitude) < 1e-7;

export const MapPinPicker: React.FC<MapPinPickerProps> = ({
  latitude,
  longitude,
  onConfirm,
  onClose,
  onSearch,
  detectOnOpen = false,
  currentPosition,
  inline = false,
  active = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const lookupSeq = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);
  const [moving, setMoving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [detectedOrigin, setOrigin] = useState<DevicePosition | null>(null);
  const origin = detectedOrigin || currentPosition;
  const [recenter, setRecenter] = useState<DevicePosition | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapAttempt, setMapAttempt] = useState(0);
  const [detectionFailed, setDetectionFailed] = useState(false);
  const [place, setPlace] = useState<PinnedPlace | null>(null);
  const [error, setError] = useState("");
  const [retryPoint, setRetryPoint] = useState<[number, number] | null>(null);
  const initial = useRef({ latitude, longitude });
  const hasSelection = useRef(latitude != null && longitude != null);
  const activeRef = useRef(active);
  const confirmedRef = useRef(false);
  const placeRef = useRef<PinnedPlace | null>(null);
  const centerRef = useRef<Coordinates | null>(null);
  const lookupPoint = useRef<Coordinates | null>(null);
  const lastExternalPoint = useRef<Coordinates | null>(null);
  const selectionEpoch = useRef(0);
  const gpsEpoch = useRef(0);

  const lookup = useCallback(
    async (lat: number, lng: number, force = false) => {
      if (!activeRef.current || confirmedRef.current) return;
      const point = { latitude: lat, longitude: lng };
      // Google also emits idle after layout/zoom changes. Do not clear a resolved address
      // or start another request unless the actual selected coordinates changed.
      if (!force && samePoint(lookupPoint.current, point)) return;
      lookupPoint.current = point;
      const seq = ++lookupSeq.current;
      traceLocation('lookup.start', { seq, requested: point });
      placeRef.current = null;
      setResolving(true);
      setPlace(null);
      setRetryPoint([lat, lng]);
      setError("");
      let resolved: LocationData | null = null;
      let lookupError = '';
      try {
        resolved = await resolveGoogleAddress(lat, lng);
      } catch {
        lookupError = 'Google address lookup is unavailable. Please retry or search manually.';
      }
      traceLocation('lookup.result', {
        seq, currentSeq: lookupSeq.current, requested: point,
        areaName: resolved?.areaName, active: activeRef.current, confirmed: confirmedRef.current,
        accepted: seq === lookupSeq.current && activeRef.current && !confirmedRef.current,
      });
      if (
        seq !== lookupSeq.current ||
        !activeRef.current ||
        confirmedRef.current
      )
        return;
      setResolving(false);
      if (resolved && resolved.city && resolved.state && hasPincode(resolved)) {
        const next: PinnedPlace = {
          areaName: resolved.areaName,
          city: resolved.city,
          state: resolved.state,
          pincode: resolved.pincode,
          formattedAddress: resolved.formattedAddress,
          latitude: lat,
          longitude: lng,
        };
        placeRef.current = next;
        setPlace(next);
      } else
        setError(
          lookupError || "We could not resolve a complete address here. Retry, move the map, or search nearby.",
        );
    },
    [],
  );

  useEffect(() => {
    const center = mapRef.current?.getCenter();
    traceLocation('selection.state', {
      moving, resolving, active, mapReady, hasMapError: !!mapError,
      mapCenter: center ? { latitude: center.lat(), longitude: center.lng() } : null,
      selected: place ? { latitude: place.latitude, longitude: place.longitude, areaName: place.areaName } : null,
    });
  }, [moving, resolving, active, mapReady, mapError, place]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      lookupSeq.current += 1;
      lookupPoint.current = null;
      window.clearTimeout(settleTimer.current);
      return;
    }
    confirmedRef.current = false;
    // Returning from search/details keeps the map instance and draft. Resume a
    // cancelled lookup only if there is no usable address for the current pin.
    const timer = window.setTimeout(() => {
      const point = mapRef.current?.getCenter();
      if (
        point &&
        hasSelection.current &&
        !samePoint(placeRef.current, {
          latitude: point.lat(),
          longitude: point.lng(),
        })
      ) {
        lookupPoint.current = null;
        void lookup(point.lat(), point.lng());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, lookup]);

  const access = useLocationAccess((position) => {
    if (!activeRef.current || confirmedRef.current || gpsEpoch.current !== selectionEpoch.current) return;
    setOrigin(position);
    setDetectionFailed(false);
    setRecenter(position);
  });
  const requestLocation = access.request;
  const handleLocateMe = useCallback(async () => {
    gpsEpoch.current = selectionEpoch.current;
    const position = await requestLocation();
    if (!position) setDetectionFailed(true);
  }, [requestLocation]);

  useEffect(() => {
    let cancelled = false;
    let denied = false;
    let tileDeadline: number | undefined;
    let map: GoogleMap | null = null;
    // Reset SDK load state when the user retries an external Maps load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapError("");
    setMapReady(false);
    const authFailure = () => {
      denied = true;
      window.clearTimeout(tileDeadline);
      lookupSeq.current += 1;
      lookupPoint.current = null;
      window.clearTimeout(settleTimer.current);
      placeRef.current = null;
      setPlace(null);
      setResolving(false);
      setMoving(false);
      setMapReady(false);
      setMapError(
        "Google Maps access was denied. Check the Maps JavaScript API and browser key restrictions.",
      );
    };
    const pointerDiagnostic = (event: PointerEvent) => {
      if (!locationDiagnosticsEnabled() || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      const pin = containerRef.current.parentElement?.querySelector('.pointer-events-none')?.getBoundingClientRect();
      traceLocation('map.pointerdown', {
        insideMap: event.target instanceof Node && containerRef.current.contains(event.target),
        hitStack: document.elementsFromPoint(event.clientX, event.clientY).slice(0, 5).map(element => ({ tag: element.tagName, role: element.getAttribute('role') })),
        pointerEvents: getComputedStyle(containerRef.current).pointerEvents,
        touchAction: getComputedStyle(containerRef.current).touchAction,
        mapRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        pinAnchor: pin ? { x: pin.x + pin.width / 2, y: pin.y } : null,
      });
    };
    document.addEventListener('pointerdown', pointerDiagnostic, true);
    window.addEventListener("google-maps-auth-error", authFailure);
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const { latitude: lat, longitude: lng } = initial.current;
        // A service-area overview is not a selected/current location and cannot be confirmed.
        const center =
          lat != null && lng != null
            ? { lat, lng }
            : { lat: 16.5062, lng: 80.648 };
        map = new maps.Map(containerRef.current, {
          center,
          zoom: lat != null ? DEFAULT_ZOOM : 12,
          disableDefaultUI: true,
          gestureHandling: "greedy",
        });
        mapRef.current = map;
        traceLocation('map.created', { mapAttempt, initialCenter: center });
        // A new map instance must receive the current external selection again.
        lastExternalPoint.current = null;
        centerRef.current = { latitude: center.lat, longitude: center.lng };
        map.addListener("dragstart", () => {
          const point = map?.getCenter();
          traceLocation('map.dragstart', { active: activeRef.current, confirmed: confirmedRef.current, center: point ? { latitude: point.lat(), longitude: point.lng() } : null });
          if (!activeRef.current || confirmedRef.current) return;
          selectionEpoch.current += 1;
          hasSelection.current = true;
          lookupSeq.current += 1;
          lookupPoint.current = null;
          placeRef.current = null;
          window.clearTimeout(settleTimer.current);
          setMoving(true);
          setPlace(null);
        });
        map.addListener("center_changed", () => {
          const observed = map?.getCenter();
          traceLocation('map.center_changed', { active: activeRef.current, confirmed: confirmedRef.current, center: observed ? { latitude: observed.lat(), longitude: observed.lng() } : null });
          if (!activeRef.current || confirmedRef.current) return;
          const point = map?.getCenter();
          if (!point) return;
          const next = { latitude: point.lat(), longitude: point.lng() };
          if (samePoint(centerRef.current, next)) return;
          centerRef.current = next;
          lookupSeq.current += 1;
          lookupPoint.current = null;
          placeRef.current = null;
          window.clearTimeout(settleTimer.current);
          setPlace(null);
          setMoving(true);
        });
        map.addListener("idle", () => {
          const point = map?.getCenter();
          traceLocation('map.idle', { active: activeRef.current, confirmed: confirmedRef.current, hasSelection: hasSelection.current, center: point ? { latitude: point.lat(), longitude: point.lng() } : null });
          if (!activeRef.current || confirmedRef.current) return;
          setMoving(false);
          window.clearTimeout(settleTimer.current);
          settleTimer.current = window.setTimeout(() => {
            const point = map?.getCenter();
            if (point && hasSelection.current && mapRef.current === map)
              void lookup(point.lat(), point.lng());
          }, 350);
        });
        // SDK construction can succeed before tile authorization fails.
        // A pin/address alone does not mean there is a usable map.
        map.addListener('tilesloaded', () => {
          window.clearTimeout(tileDeadline);
          if (!cancelled && !denied) setMapReady(true);
        });
        tileDeadline = window.setTimeout(() => {
          if (cancelled || denied) return;
          authFailure();
          setMapError('The map tiles did not finish loading. Check your connection or search manually.');
        }, 20000);
        if (lat != null && lng != null) void lookup(lat, lng);
      })
      .catch((reason) => {
        if (!cancelled) {
          setMapError(
            reason instanceof Error
              ? reason.message
              : "The map could not load.",
          );
          setResolving(false);
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(tileDeadline);
      lookupSeq.current += 1;
      lookupPoint.current = null;
      placeRef.current = null;
      window.clearTimeout(settleTimer.current);
      if (map) window.google?.maps.event.clearInstanceListeners(map);
      mapRef.current = null;
      window.removeEventListener("google-maps-auth-error", authFailure);
      document.removeEventListener('pointerdown', pointerDiagnostic, true);
    };
  }, [lookup, mapAttempt]);

  const detectedOnOpen = useRef(false);
  useEffect(() => {
    if (detectOnOpen && !detectedOnOpen.current) {
      detectedOnOpen.current = true;
      void handleLocateMe();
    }
  }, [detectOnOpen, handleLocateMe]);
  useEffect(() => {
    if (
      !mapReady ||
      latitude == null ||
      longitude == null ||
      !validCoordinates(latitude, longitude)
    ) return;

    const next = { latitude, longitude };
    traceLocation('external.sync', { next, skipped: samePoint(lastExternalPoint.current, next) });
    if (samePoint(lastExternalPoint.current, next)) return;

    lastExternalPoint.current = next;
    hasSelection.current = true;
    mapRef.current?.setCenter({ lat: latitude, lng: longitude });
    mapRef.current?.setZoom(DEFAULT_ZOOM);
    void lookup(latitude, longitude);
  }, [latitude, longitude, mapReady, lookup]);
  useEffect(() => {
    if (mapReady && recenter) {
      traceLocation('gps.recenter', { latitude: recenter.latitude, longitude: recenter.longitude });
      hasSelection.current = true;
      mapRef.current?.setCenter({
        lat: recenter.latitude,
        lng: recenter.longitude,
      });
      mapRef.current?.setZoom(DEFAULT_ZOOM);
      // A GPS result may arrive before the map SDK is ready.
      void lookup(recenter.latitude, recenter.longitude);
    }
  }, [mapReady, recenter, lookup]);
  useEffect(() => {
    if (!mapReady || !origin || !window.google || !mapRef.current) return;
    const maps = window.google.maps,
      map = mapRef.current;
    const circle = new maps.Circle({
      map,
      center: { lat: origin.latitude, lng: origin.longitude },
      radius: Math.max(4, Math.min(origin.accuracy, 100)),
      fillColor: "#2563eb",
      fillOpacity: 0.7,
      strokeColor: "#fff",
      strokeWeight: 2,
      clickable: false,
    });
    let line: GoogleOverlay | null = null;
    const update = () => {
      line?.setMap(null);
      line = null;
      const point = map.getCenter();
      if (
        point &&
        Math.hypot(
          point.lat() - origin.latitude,
          (point.lng() - origin.longitude) *
            Math.cos((origin.latitude * Math.PI) / 180),
        ) > 0.00009
      ) {
        line = new maps.Polyline({
          map,
          path: [
            { lat: origin.latitude, lng: origin.longitude },
            { lat: point.lat(), lng: point.lng() },
          ],
          strokeColor: "#1B5E3A",
          strokeWeight: 3,
          strokeOpacity: 0.8,
          geodesic: true,
          clickable: false,
        });
      }
    };
    update();
    const listener = map.addListener("center_changed", update);
    return () => {
      listener.remove();
      circle.setMap(null);
      line?.setMap(null);
    };
  }, [mapReady, origin]);
  const canConfirm =
    active && !!place && !resolving && !moving && !mapError && mapReady;
  const handleConfirm = () => {
    const selected = placeRef.current;
    const center = mapRef.current?.getCenter();
    traceLocation('confirm', {
      allowed: canConfirm && !!selected && activeRef.current && !confirmedRef.current,
      center: center ? { latitude: center.lat(), longitude: center.lng() } : null,
      selected: selected ? { latitude: selected.latitude, longitude: selected.longitude, areaName: selected.areaName } : null,
    });
    if (!canConfirm || !selected || !activeRef.current || confirmedRef.current)
      return;
    confirmedRef.current = true;
    lookupSeq.current += 1;
    window.clearTimeout(settleTimer.current);
    onConfirm({ ...selected });
  };

  // Rendered at the page root: the sheets this opens from are animated with transforms, which would
  // otherwise trap a "fixed" full-screen layer inside them.
  if (typeof document === "undefined") return null;
  const content = (
    <div
      className="fixed inset-0 z-[60] bg-white flex flex-col"
      role="dialog"
      aria-label="Set pickup location on map"
    >
      <div className="shrink-0 px-4 pb-3 border-b border-slate-100 bg-white"
        style={{ paddingTop: 'calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))' }}>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Set pickup location
            </h2>
            <p className="text-[11px] text-slate-500">
              Move the map so the pin is on your doorstep
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 isolate">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {mapError && (
          <div
            role="alert"
            className="absolute inset-0 z-[550] bg-canvas flex flex-col items-center justify-center gap-4 p-6 text-center"
          >
            <p className="text-sm text-slate-600">{mapError}</p>
            <Button
              variant="secondary"
              onClick={() => setMapAttempt((value) => value + 1)}
            >
              Retry map
            </Button>
            {onSearch && <Button onClick={onSearch}>Search Manually</Button>}
          </div>
        )}

        {/* The pin: fixed in the middle, its tip on the exact centre point. It lifts while the map moves. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2">
          <div className="-translate-y-full">
            <MapPin
              className="w-11 h-11 text-brand fill-gold drop-shadow-lg transition-transform duration-150"
              style={{
                transform: moving ? "translateY(-10px)" : "translateY(0)",
              }}
            />
          </div>
          <span className="absolute left-1/2 top-0 w-2.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30 blur-[1px]" />
        </div>

        <Button
          type="button"
          onClick={handleLocateMe}
          disabled={access.locating}
          className="absolute right-3 bottom-10 z-[500] px-4 py-3 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          aria-label="Current Location"
        >
          <Crosshair
            className={`w-5 h-5 text-brand ${access.locating ? "animate-spin" : ""}`}
          />
          <span className="text-xs font-bold text-brand">
            {access.locating ? "Locating…" : "Current Location"}
          </span>
        </Button>
      </div>

      <div className={`shrink-0 max-h-[45%] overflow-y-auto px-4 pt-3 bg-white border-t border-slate-100 space-y-3 ${styles.bottom}`}>
        {access.error && (
          <p role="status" className="text-xs text-amber-800">
            {access.error}
          </p>
        )}
        {access.needsPermission && (
          <Button
            variant="secondary"
            onClick={handleLocateMe}
            disabled={access.locating}
          >
            Grant Location Permission
          </Button>
        )}
        <div className="min-h-[56px]">
          {resolving || moving ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
              {moving ? "Move the map…" : "Finding the address…"}
            </div>
          ) : place ? (
            <div className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 leading-tight">
                  {place.areaName}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {place.formattedAddress}
                </p>
                <p className="data-value text-[11px] text-slate-400 mt-0.5 font-mono">
                  {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs font-semibold text-amber-700">{error}</p>
          )}
        </div>
        {!place && !resolving && retryPoint && (
          <Button
            variant="secondary"
            onClick={() => void lookup(...retryPoint, true)}
          >
            Retry address lookup
          </Button>
        )}
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full py-3.5 rounded-2xl bg-brand text-white text-sm font-bold flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          Confirm &amp; Proceed
        </Button>
      </div>
      {detectionFailed && !access.dialog && (
        <div className="absolute inset-0 z-[80] bg-slate-950/60 flex items-center justify-center p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unable to Detect Location"
            className="bg-white rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-xl font-bold text-brand">
              Unable to Detect Location
            </h2>
            <p className="text-sm text-slate-600">
              We couldn’t identify your current location. Try again or search
              for your address manually.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDetectionFailed(false);
                  void handleLocateMe();
                }}
              >
                Retry
              </Button>
              {onSearch && (
                <Button
                  onClick={() => {
                    setDetectionFailed(false);
                    onSearch();
                  }}
                >
                  Search Manually
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetectionFailed(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
      {access.dialog}
    </div>
  );
  return inline
    ? content
    : createPortal(
        content,
        document.getElementById("customer-mobile-shell") || document.body,
      );
};
