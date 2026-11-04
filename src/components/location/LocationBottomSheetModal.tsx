"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MapPin, Crosshair, History, Check, Loader2, Map as MapIcon } from 'lucide-react';
import { useLocation, LocationData } from '../../context/LocationContext';
import { POPULAR_LOCALITIES } from '../../lib/localities';
import { isCompleteBookingAddress } from '../../lib/booking-helpers';
import { apiClient } from '../../lib/api-client';
import { hasPincode } from '../../lib/geo-client';
import { LandmarkPicker } from './LandmarkPicker';
import { MapPinPicker, PinnedPlace } from './MapPinPicker';

interface LocationBottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation?: (location: LocationData) => void;
  /** Message shown when the sheet opens, e.g. why the detected location could not be used. */
  initialHint?: string;
}

export const LocationBottomSheetModal: React.FC<LocationBottomSheetModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  initialHint,
}) => {
  const { location, setLocation, requestCurrentLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [gpsHint, setGpsHint] = useState(initialHint || "");
  // The address worked out from the phone's GPS, shown for the customer to confirm.
  const [detected, setDetected] = useState<LocationData | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [placeResults, setPlaceResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen && initialHint) setGpsHint(initialHint);
    if (!isOpen) {
      setDetected(null);
      setSearchQuery('');
    }
  }, [isOpen, initialHint]);

  // Typing 3+ characters also searches real places (streets, landmarks, PIN codes), not just the short list below.
  useEffect(() => {
    const text = searchQuery.trim();
    if (text.length < 3) {
      setPlaceResults([]);
      setIsSearching(false);
      return;
    }
    let stale = false;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.searchPlaces<any[]>(text);
        if (stale) return;
        const found: LocationData[] =
          res.success && Array.isArray(res.data)
            ? res.data.map((p: any) => ({
                areaName: p.areaName,
                city: p.city,
                state: p.state,
                pincode: p.pincode,
                latitude: p.latitude,
                longitude: p.longitude,
                formattedAddress: p.label || p.formattedAddress,
              }))
            : [];
        setPlaceResults(found);
      } catch {
        if (!stale) setPlaceResults([]);
      } finally {
        if (!stale) setIsSearching(false);
      }
    }, 450);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredLocalities = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_LOCALITIES;
    const query = searchQuery.toLowerCase();
    return POPULAR_LOCALITIES.filter(
      (loc) =>
        loc.areaName.toLowerCase().includes(query) ||
        loc.pincode.includes(query) ||
        loc.formattedAddress.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  /** A place found by searching: it has its own coordinates, so it is used as-is (no GPS override). */
  const handlePickPlace = async (place: LocationData) => {
    let pincode = place.pincode;
    if (!/^\d{6}$/.test(pincode || '') && place.latitude != null && place.longitude != null) {
      try {
        const res = await apiClient.reverseGeocode<any>(place.latitude, place.longitude);
        if (res.success && /^\d{6}$/.test(res.data?.pincode || '')) pincode = res.data.pincode;
      } catch {
        /* handled below */
      }
    }
    if (!/^\d{6}$/.test(pincode || '')) {
      setGpsHint('That place has no PIN code on the map. Try a nearby area or road.');
      return;
    }
    const selected: LocationData = {
      ...place,
      pincode,
      formattedAddress: place.formattedAddress.includes(pincode) ? place.formattedAddress : `${place.formattedAddress} - ${pincode}`,
      houseNumber: location.houseNumber,
      landmark: '',
      source: 'manual',
    };
    setGpsHint('');
    setLocation(selected);
    if (onSelectLocation) onSelectLocation(selected);
    onClose();
  };

  const handleSelect = async (loc: LocationData) => {
    if (!/^\d{6}$/.test(loc.pincode || '')) {
      setGpsHint('Please pick a locality with a valid 6-digit pincode.');
      return;
    }
    // Prefer live GPS when available; otherwise use locality centroid.
    let latitude = loc.latitude;
    let longitude = loc.longitude;
    if (location.latitude != null && location.longitude != null) {
      latitude = location.latitude;
      longitude = location.longitude;
    } else {
      try {
        const detected = await requestCurrentLocation({ coordsOnly: true });
        if (detected?.latitude != null && detected?.longitude != null) {
          latitude = detected.latitude;
          longitude = detected.longitude;
        }
      } catch {
        /* keep centroid */
      }
    }
    const selected: LocationData = {
      ...loc,
      latitude,
      longitude,
      houseNumber: location.houseNumber,
      landmark: '',
      source: 'manual',
    };
    setGpsHint('');
    setLocation(selected);
    if (onSelectLocation) onSelectLocation(selected);
    onClose();
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setGpsHint('');
    setDetected(null);
    const found = await requestCurrentLocation();
    setIsLocating(false);
    if (found && isCompleteBookingAddress(found)) {
      // Already saved on the phone by requestCurrentLocation; show it so the customer can see and confirm it.
      setDetected(found);
    } else if (found) {
      setGpsHint('We found your position but not the address. Search your area above, or pick a locality below.');
    } else {
      setGpsHint('Could not get your location. Allow location access, or search / pick a locality below.');
    }
  };

  /** The customer moved the pin: that exact point (and its address) becomes the current location. */
  const handlePinned = (place: PinnedPlace) => {
    const adjusted: LocationData = {
      ...place,
      houseNumber: location.houseNumber,
      landmark: '',
      source: 'manual',
    };
    setLocation(adjusted);
    setDetected(adjusted);
    setGpsHint('');
    setMapOpen(false);
  };

  const confirmDetected = () => {
    if (!detected) return;
    const confirmed: LocationData = { ...detected, houseNumber: location.houseNumber, landmark: location.landmark };
    setLocation(confirmed);
    if (onSelectLocation) onSelectLocation(confirmed);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Bottom Sheet Modal Container */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-t-[32px] shadow-2xl p-6 pb-safe z-10 max-h-[85vh] flex flex-col border-t border-slate-200"
        >
          {/* Top Sheet Drag Grabber Handle */}
          <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto -mt-1 mb-4" />

          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Select Your Location</h2>
              <p className="text-xs text-slate-500">Pick your scrap collection locality in Vijayawada</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box Input */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, street name or pincode..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D2B] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Use Current GPS Location Action */}
          <button
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="mt-3 w-full p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center gap-3 text-left hover:bg-emerald-100/70 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Crosshair className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1 truncate">
              <span className="text-xs font-bold text-[#0A3D2B] block">
                {isLocating ? "Detecting GPS location..." : "Use current location"}
              </span>
              <span className="text-[10px] text-emerald-700">
                Detects your area, city and PIN code automatically
              </span>
            </div>
          </button>

          {detected && (
            <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Your current location</p>
                  <p className="text-sm font-black text-slate-900 leading-tight mt-0.5">{detected.areaName}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {[detected.city, detected.state].filter(Boolean).join(', ')} - {detected.pincode}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    GPS {detected.latitude?.toFixed(5)}, {detected.longitude?.toFixed(5)} · detected just now
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="w-full py-2 rounded-xl border border-emerald-300 bg-white text-xs font-bold text-emerald-900 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-50"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Not exact? Adjust pin on map
              </button>
              <LandmarkPicker
                latitude={detected.latitude}
                longitude={detected.longitude}
                value={location.landmark || ''}
                onChange={(landmark) => setLocation({ landmark })}
              />
              <button
                type="button"
                onClick={confirmDetected}
                className="w-full py-2.5 rounded-xl bg-[#0A3D2B] text-white text-xs font-bold hover:bg-[#0E4D36] cursor-pointer"
              >
                Confirm this location
              </button>
            </div>
          )}

          {/* Not at the detected spot, or GPS is off: place the pin by hand */}
          {!detected && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="mt-2 w-full p-3 rounded-2xl bg-white border border-slate-200 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-[#0A3D2B] text-white flex items-center justify-center shrink-0">
                <MapIcon className="w-4.5 h-4.5" />
              </span>
              <span>
                <span className="text-xs font-bold text-slate-900 block">Choose on map</span>
                <span className="text-[10px] text-slate-500">Move the pin to your exact doorstep</span>
              </span>
            </button>
          )}

          {mapOpen && (
            <MapPinPicker
              latitude={detected?.latitude ?? location.latitude}
              longitude={detected?.longitude ?? location.longitude}
              onConfirm={handlePinned}
              onClose={() => setMapOpen(false)}
            />
          )}

          {/* Optional: the exact door, so the picker can find you */}
          <div className="mt-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              House / Flat no. <span className="font-medium normal-case text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={location.houseNumber || ''}
              onChange={(e) => setLocation({ houseNumber: e.target.value.slice(0, 60) })}
              placeholder="e.g. Flat 4B, Sai Residency"
              className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D2B] focus:border-transparent transition-all"
            />
          </div>

          {gpsHint && (
            <p className="mt-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {gpsHint}
            </p>
          )}

          {/* Scrollable Location List */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-4 no-scrollbar pr-1">
            {/* Recent Selection */}
            {!searchQuery && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <History className="w-3.5 h-3.5" />
                  Recent Location
                </div>
                <div
                  onClick={() => handleSelect(location)}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#0A3D2B] shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{location.areaName}</p>
                      <p className="text-[10px] text-slate-500">{location.formattedAddress}</p>
                      {!hasPincode(location) && location.latitude != null && (
                        <p className="text-[10px] font-semibold text-amber-700 mt-0.5">
                          Address not worked out yet: tap “Use current location”
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                </div>
              </div>
            )}

            {/* Real places matching what was typed */}
            {searchQuery.trim().length >= 3 && (placeResults.length > 0 || isSearching) && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Places
                  {isSearching && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                <div className="space-y-1.5">
                  {placeResults.map((place, idx) => (
                    <div
                      key={`${place.latitude},${place.longitude},${idx}`}
                      onClick={() => handlePickPlace(place)}
                      className="p-3 rounded-2xl flex items-start gap-3 cursor-pointer border border-slate-100 bg-white hover:bg-slate-50"
                    >
                      <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{place.areaName}</p>
                        <p className="text-[10px] text-slate-500 leading-snug">{place.formattedAddress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Localities in Vijayawada */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {searchQuery ? "Search Results" : "Available Localities in Vijayawada"}
              </div>
              <div className="space-y-1.5">
                {filteredLocalities.map((loc, idx) => {
                  const isSelected = location.areaName === loc.areaName;
                  return (
                    <motion.div
                      key={idx}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(loc)}
                      className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${isSelected ? 'text-[#0A3D2B]' : 'text-slate-800'}`}>
                            {loc.areaName}
                          </p>
                          <p className="text-[10px] text-slate-500">{loc.formattedAddress}</p>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </motion.div>
                  );
                })}

                {filteredLocalities.length === 0 && placeResults.length === 0 && !isSearching && (
                  <div className="text-center py-6 text-slate-400">
                    <p className="text-xs">No locality found matching "{searchQuery}"</p>
                    <p className="text-[10px] text-slate-400 mt-1">Please select an area within Vijayawada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
