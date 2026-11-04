"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { getGpsPosition, hasPincode, resolveAddress } from '../lib/geo-client';
import { useAuth } from './AuthContext';

export interface LocationData {
  areaName: string;
  city: string;
  state?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  formattedAddress: string;
  /** Optional house / flat number the customer typed, so the picker can find the door. */
  houseNumber?: string;
  /** Nearby landmark, detected from the map or typed by the customer. */
  landmark?: string;
  /** 'gps' = detected from the phone, 'manual' = picked from the locality list. */
  source?: 'gps' | 'manual';
}

interface RequestLocationOptions {
  /** Only update the GPS coordinates; keep the locality / pincode already chosen. */
  coordsOnly?: boolean;
}

interface LocationContextType {
  location: LocationData;
  isSheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  setLocation: (newLoc: Partial<LocationData>) => void;
  requestCurrentLocation: (options?: RequestLocationOptions) => Promise<LocationData | null>;
}

const STORAGE_KEY = 'aslikaata_customer_location';

const DEFAULT_LOCATION: LocationData = {
  areaName: "",
  city: "",
  state: "",
  pincode: "",
  formattedAddress: "",
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocationState] = useState<LocationData>(DEFAULT_LOCATION);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Always-current copy for async code (the state value inside a callback can be stale).
  const locationRef = useRef<LocationData>(DEFAULT_LOCATION);
  const lastSavedKeyRef = useRef('');

  const commit = useCallback((next: LocationData) => {
    locationRef.current = next;
    setLocationState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const requestCurrentLocation = useCallback(
    async (options?: RequestLocationOptions): Promise<LocationData | null> => {
      const position = await getGpsPosition();
      if (!position) return null;
      const prev = locationRef.current;
      const next = options?.coordsOnly
        ? { ...prev, latitude: position.latitude, longitude: position.longitude }
        : await resolveAddress(position.latitude, position.longitude, prev);
      commit(next);
      return next;
    },
    [commit],
  );

  // Restore the saved location. An older version stored GPS without an address (no PIN code), which made
  // the booking screen say "Pickup address incomplete": complete those from their coordinates now.
  useEffect(() => {
    let saved: LocationData | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (!saved) return;
    locationRef.current = saved;
    setLocationState(saved);

    if (saved.latitude != null && saved.longitude != null && !hasPincode(saved)) {
      void resolveAddress(saved.latitude, saved.longitude, saved).then((fixed) => {
        if (hasPincode(fixed)) commit(fixed);
      });
    }

    // Already allowed GPS earlier: quietly note where the customer is now (unless they chose a locality by hand).
    let cancelled = false;
    if (saved.source !== 'manual' && localStorage.getItem('aslikaata_location_set') === 'true') {
      try {
        navigator.permissions
          ?.query({ name: 'geolocation' as PermissionName })
          .then((status) => {
            if (!cancelled && status.state === 'granted') void requestCurrentLocation();
          })
          .catch(() => undefined);
      } catch {
        /* permissions API not available: skip the refresh */
      }
    }
    return () => {
      cancelled = true;
    };
  }, [commit, requestCurrentLocation]);

  const setLocation = useCallback(
    (newLoc: Partial<LocationData>) => {
      commit({ ...locationRef.current, ...newLoc });
    },
    [commit],
  );

  // Keep the saved location on the customer's profile in step with what the app has: every time it is
  // captured or changed, including the house/flat number. A location captured before login (the first
  // launch) is saved as soon as the profile exists, i.e. right after the name step.
  const canSave = isAuthenticated && !!user?.fullName;
  useEffect(() => {
    if (!canSave || location.latitude == null || location.longitude == null) return;
    const key = [
      location.latitude,
      location.longitude,
      location.pincode,
      location.areaName,
      location.formattedAddress,
      location.houseNumber || '',
      location.landmark || '',
    ].join('|');
    if (key === lastSavedKeyRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.saveMyLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          areaName: location.areaName || undefined,
          city: location.city || undefined,
          state: location.state || undefined,
          pincode: location.pincode || undefined,
          formattedAddress: location.formattedAddress || undefined,
          houseNumber: location.houseNumber || undefined,
          landmark: location.landmark || undefined,
        });
        if (res.success && res.data?.saved) lastSavedKeyRef.current = key;
      } catch {
        /* retried on the next change */
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [canSave, location]);

  // A different customer signing in on this phone must save their own location.
  useEffect(() => {
    lastSavedKeyRef.current = '';
  }, [user?.id]);

  const openSheet = () => setIsSheetOpen(true);
  const closeSheet = () => setIsSheetOpen(false);

  return (
    <LocationContext.Provider
      value={{
        location,
        isSheetOpen,
        openSheet,
        closeSheet,
        setLocation,
        requestCurrentLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
