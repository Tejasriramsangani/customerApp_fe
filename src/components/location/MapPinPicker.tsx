"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { createPortal } from 'react-dom';
import type { Map as LeafletMap } from 'leaflet';
import { ArrowLeft, Crosshair, Loader2, MapPin, Check } from 'lucide-react';
import { getGpsPosition, hasPincode, loadMapConfig, resolveAddress } from '../../lib/geo-client';
import type { LocationData } from '../../context/LocationContext';

/** What the picker hands back: the pin's exact point and the address worked out for it. */
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
  /** Where the map opens (the customer's current / picked point). */
  latitude?: number;
  longitude?: number;
  onConfirm: (place: PinnedPlace) => void;
  onClose: () => void;
}

/** Vijayawada, used only when there is no point to open on. */
const FALLBACK_CENTER: [number, number] = [16.5062, 80.648];
const DEFAULT_ZOOM = 17;
const SETTLE_MS = 600;

/**
 * Full-screen "move the map under the pin" picker. The pin stays in the middle of the screen; whatever
 * point is under it is the pickup point, and its address is looked up when the map stops moving.
 */
export const MapPinPicker: React.FC<MapPinPickerProps> = ({ latitude, longitude, onConfirm, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lookupSeq = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);

  const [moving, setMoving] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [locating, setLocating] = useState(false);
  const [place, setPlace] = useState<PinnedPlace | null>(null);
  const [error, setError] = useState('');

  const lookup = useCallback(async (lat: number, lng: number) => {
    const seq = ++lookupSeq.current;
    setResolving(true);
    setError('');
    let resolved: LocationData | null = null;
    try {
      resolved = await resolveAddress(lat, lng);
    } catch {
      resolved = null;
    }
    if (seq !== lookupSeq.current) return; // the map moved again: a newer lookup is on its way
    setResolving(false);
    if (resolved && resolved.city && hasPincode(resolved)) {
      setPlace({
        areaName: resolved.areaName,
        city: resolved.city,
        state: resolved.state || '',
        pincode: resolved.pincode,
        formattedAddress: resolved.formattedAddress,
        latitude: lat,
        longitude: lng,
      });
    } else {
      setPlace(null);
      setError('We could not find an address with a PIN code here. Move the pin a little, or try a nearby road.');
    }
  }, []);

  // Build the map once. Leaflet touches window, so it is loaded here in the browser, never during the build.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      // Which tile server to use is decided by the backend (MAP_TILE_* in its .env).
      const [leaflet, mapConfig] = await Promise.all([import('leaflet'), loadMapConfig()]);
      const L = leaflet.default;
      if (cancelled || !containerRef.current) return;

      const center: [number, number] =
        latitude != null && longitude != null ? [latitude, longitude] : FALLBACK_CENTER;
      map = L.map(containerRef.current, { zoomControl: false }).setView(center, DEFAULT_ZOOM);
      L.tileLayer(mapConfig.tileUrl, { maxZoom: mapConfig.maxZoom, attribution: mapConfig.attribution }).addTo(map);

      map.on('movestart', () => {
        window.clearTimeout(settleTimer.current);
        setMoving(true);
      });
      map.on('moveend', () => {
        setMoving(false);
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(() => {
          if (!map) return;
          const c = map.getCenter();
          void lookup(c.lat, c.lng);
        }, SETTLE_MS);
      });

      mapRef.current = map;
      void lookup(center[0], center[1]);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(settleTimer.current);
      lookupSeq.current += 1;
      mapRef.current = null;
      map?.remove();
    };
    // opens once on the point it was given; moving the map is the customer's job from then on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocateMe = async () => {
    setLocating(true);
    const position = await getGpsPosition();
    setLocating(false);
    if (!position) {
      setError('Could not get your location. Allow location access, or move the map yourself.');
      return;
    }
    mapRef.current?.setView([position.latitude, position.longitude], DEFAULT_ZOOM);
  };

  const canConfirm = !!place && !resolving && !moving;

  // Rendered at the page root: the sheets this opens from are animated with transforms, which would
  // otherwise trap a "fixed" full-screen layer inside them.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-white flex flex-col" role="dialog" aria-label="Set pickup location on map">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h2 className="text-sm font-black text-slate-900 leading-tight">Set pickup location</h2>
          <p className="text-[11px] text-slate-500">Move the map so the pin is on your doorstep</p>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 isolate">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* The pin: fixed in the middle, its tip on the exact centre point. It lifts while the map moves. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2">
          <div className="-translate-y-full">
            <MapPin
              className="w-11 h-11 text-[#0A3D2B] fill-[#F59E0B] drop-shadow-lg transition-transform duration-150"
              style={{ transform: moving ? 'translateY(-10px)' : 'translateY(0)' }}
            />
          </div>
          <span className="absolute left-1/2 top-0 w-2.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30 blur-[1px]" />
        </div>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="absolute right-3 bottom-3 z-[500] w-11 h-11 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-70"
          aria-label="Go to my location"
        >
          <Crosshair className={`w-5 h-5 text-[#0A3D2B] ${locating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-4 pt-3 pb-safe bg-white border-t border-slate-100 space-y-3">
        <div className="min-h-[56px]">
          {resolving || moving ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#0A3D2B]" />
              {moving ? 'Move the map…' : 'Finding the address…'}
            </div>
          ) : place ? (
            <div className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 leading-tight">{place.areaName}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {place.city}, {place.state} - {place.pincode}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs font-semibold text-amber-700">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => place && onConfirm(place)}
          disabled={!canConfirm}
          className="w-full py-3.5 rounded-2xl bg-[#0A3D2B] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          Confirm this location
        </button>
      </div>
    </div>,
    document.body,
  );
};
