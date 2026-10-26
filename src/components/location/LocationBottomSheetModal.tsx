"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MapPin, Crosshair, History, Check } from 'lucide-react';
import { useLocation, LocationData } from '../../context/LocationContext';

interface LocationBottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation?: (location: LocationData) => void;
}

// Approximate locality centroids so address create works even if GPS is denied.
const POPULAR_LOCALITIES: LocationData[] = [
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

export const LocationBottomSheetModal: React.FC<LocationBottomSheetModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
}) => {
  const { location, setLocation, requestCurrentLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [gpsHint, setGpsHint] = useState("");

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
        const detected = await requestCurrentLocation();
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
    };
    setGpsHint('');
    setLocation(selected);
    if (onSelectLocation) onSelectLocation(selected);
    onClose();
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setGpsHint('');
    const detected = await requestCurrentLocation();
    setIsLocating(false);
    if (detected) {
      // GPS alone has no pincode — keep sheet open so user picks a covered locality.
      setGpsHint('GPS captured. Now select your locality below to complete the address.');
    } else {
      setGpsHint('Could not get GPS. Select a locality below — approximate coordinates will be used.');
    }
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
                Captures GPS — then pick a locality for pincode
              </span>
            </div>
          </button>

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
                    </div>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
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

                {filteredLocalities.length === 0 && (
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
