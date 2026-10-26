"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface LocationData {
  areaName: string;
  city: string;
  state?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  formattedAddress: string;
}

interface LocationContextType {
  location: LocationData;
  isSheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  setLocation: (newLoc: Partial<LocationData>) => void;
  requestCurrentLocation: () => Promise<LocationData | null>;
}

const DEFAULT_LOCATION: LocationData = {
  areaName: "",
  city: "",
  state: "",
  pincode: "",
  formattedAddress: "",
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<LocationData>(DEFAULT_LOCATION);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aslikaata_customer_location');
      if (saved) {
        setLocationState(JSON.parse(saved));
      }
    } catch {
      // Ignore storage read error
    }
  }, []);

  const setLocation = (newLoc: Partial<LocationData>) => {
    setLocationState((prev) => {
      const updated = { ...prev, ...newLoc };
      try {
        localStorage.setItem('aslikaata_customer_location', JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  };

  const openSheet = () => setIsSheetOpen(true);
  const closeSheet = () => setIsSheetOpen(false);

  const requestCurrentLocation = async (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Merge GPS coords only — never wipe a selected locality/pincode.
          let merged: LocationData | null = null;
          setLocationState((prev) => {
            const hasLocality = /^\d{6}$/.test(prev.pincode || '');
            const updated: LocationData = hasLocality
              ? { ...prev, latitude, longitude }
              : {
                  ...prev,
                  latitude,
                  longitude,
                  areaName: prev.areaName || 'Current Locality',
                  city: prev.city || '',
                  state: prev.state || '',
                  pincode: prev.pincode || '',
                  formattedAddress:
                    prev.formattedAddress ||
                    `GPS Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
                };
            merged = updated;
            try {
              localStorage.setItem('aslikaata_customer_location', JSON.stringify(updated));
            } catch {
              /* ignore */
            }
            return updated;
          });
          // State updater runs sync in React 18 for this path; fall back if not.
          resolve(merged);
        },
        () => {
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

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
