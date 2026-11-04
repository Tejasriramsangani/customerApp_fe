"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Search, MapPin, Loader2, Check, X, Home, Briefcase, Map as MapIcon } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../lib/api-client';
import { getGpsPosition, resolveAddress, hasPincode } from '../../lib/geo-client';
import { nearestLocality } from '../../lib/localities';
import { LandmarkPicker } from '../location/LandmarkPicker';
import { MapPinPicker, PinnedPlace } from '../location/MapPinPicker';
import { useLocation } from '../../context/LocationContext';
import type { AddressLabel } from '../../lib/address-helpers';

/** A place the customer picked, by GPS or by search. */
export interface PickedPlace {
  areaName: string;
  city: string;
  state: string;
  pincode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

interface SearchHit extends PickedPlace {
  label: string;
}

interface AddAddressFormProps {
  /** Called with the saved address returned by the server. */
  onSaved: (address: any) => void;
  onCancel: () => void;
  /** A place to start from (e.g. the customer's current location), so they only choose a name and save. */
  initialPlace?: PickedPlace | null;
  /** Which name is selected first: Home for a first address, Other otherwise. */
  defaultLabel?: AddressLabel;
  /** Hide the "Add New Address" heading (when the surrounding sheet already has one). */
  hideTitle?: boolean;
  /** Hide Cancel (when there is nothing to go back to, e.g. the very first address). */
  hideCancel?: boolean;
}

const LABEL_CHOICES: Array<{ value: AddressLabel; text: string; Icon: typeof Home }> = [
  { value: 'HOME', text: 'Home', Icon: Home },
  { value: 'WORK', text: 'Work', Icon: Briefcase },
  { value: 'OTHER', text: 'Other', Icon: MapPin },
];

const SEARCH_DELAY_MS = 450;

/**
 * "Add new address": pick the place with GPS or by searching, then add the optional house / flat number
 * and landmark. The saved address carries the picked place's own city, PIN and coordinates.
 */
export const AddAddressForm: React.FC<AddAddressFormProps> = ({
  onSaved,
  onCancel,
  initialPlace = null,
  defaultLabel = 'HOME',
  hideTitle = false,
  hideCancel = false,
}) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  const { location } = useLocation();
  const [mapOpen, setMapOpen] = useState(false);
  const [picked, setPicked] = useState<PickedPlace | null>(initialPlace);
  const [label, setLabel] = useState<AddressLabel>(defaultLabel);
  const [labelName, setLabelName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [landmark, setLandmark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Only the newest search may update the list (answers can arrive out of order).
  const searchSeq = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      searchSeq.current += 1;
      setHits([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.searchPlaces<SearchHit[]>(text);
        if (seq !== searchSeq.current) return;
        setHits(res.success && Array.isArray(res.data) ? res.data : []);
      } catch {
        if (seq === searchSeq.current) setHits([]);
      } finally {
        if (seq === searchSeq.current) {
          setSearching(false);
          setSearched(true);
        }
      }
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setError('');
    setLandmark('');
    const position = await getGpsPosition();
    if (!position) {
      setLocating(false);
      setError('Could not get your location. Allow location access, or search for the place below.');
      return;
    }
    const place = await resolveAddress(position.latitude, position.longitude);
    setLocating(false);
    if (!hasPincode(place) || !place.city) {
      setError('We found your position but not its address. Search for a nearby area instead.');
      return;
    }
    setPicked({
      areaName: place.areaName,
      city: place.city,
      state: place.state || '',
      pincode: place.pincode,
      formattedAddress: place.formattedAddress,
      latitude: place.latitude!,
      longitude: place.longitude!,
    });
    setQuery('');
    setHits([]);
  };

  const handlePickHit = async (hit: SearchHit) => {
    setError('');
    setLandmark('');
    let pincode = hit.pincode;
    let formattedAddress = hit.formattedAddress;
    if (!/^\d{6}$/.test(pincode)) {
      // Many map places carry no PIN: look it up from the point itself, then from a known nearby locality.
      try {
        const res = await apiClient.reverseGeocode<any>(hit.latitude, hit.longitude);
        if (res.success && /^\d{6}$/.test(res.data?.pincode || '')) pincode = res.data.pincode;
      } catch {
        /* try the fallback */
      }
      if (!pincode) pincode = nearestLocality(hit.latitude, hit.longitude, 5)?.pincode || '';
      if (pincode) formattedAddress = `${formattedAddress} - ${pincode}`;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setError('That place has no PIN code on the map. Try searching a nearby area or road.');
      return;
    }
    setPicked({
      areaName: hit.areaName,
      city: hit.city,
      state: hit.state,
      pincode,
      formattedAddress,
      latitude: hit.latitude,
      longitude: hit.longitude,
    });
    setQuery('');
    setHits([]);
  };

  /** The pin was placed on the map: its point and address replace the picked place (landmarks start over). */
  const handlePinned = (place: PinnedPlace) => {
    setPicked(place);
    setLandmark('');
    setQuery('');
    setHits([]);
    setError('');
    setMapOpen(false);
  };

  const handleSave = async () => {
    if (!picked) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post<any>('/customer/addresses', {
        line1: picked.formattedAddress,
        houseNumber: houseNumber.trim() || undefined,
        landmark: landmark.trim() || undefined,
        label,
        labelName: label === 'OTHER' ? labelName.trim() || undefined : undefined,
        city: picked.city,
        state: picked.state,
        pincode: picked.pincode,
        coordinates: [picked.longitude, picked.latitude],
      });
      if (res.success && res.data) {
        onSaved(res.data);
      } else {
        setError(getApiErrorMessage(res.error, 'Could not save the address. Please try again.'));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the address. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50/40 space-y-3 mt-2">
      {!hideTitle && <h4 className="text-xs font-bold text-emerald-950">Add New Address</h4>}

      {!picked && (
        <>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="w-full p-3 rounded-2xl bg-white border border-emerald-200 flex items-center gap-3 text-left hover:bg-emerald-50 transition-colors disabled:opacity-70 cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Crosshair className={`w-4.5 h-4.5 ${locating ? 'animate-spin' : ''}`} />
            </span>
            <span>
              <span className="text-xs font-bold text-[#0A3D2B] block">
                {locating ? 'Detecting your location…' : 'Use my current location'}
              </span>
              <span className="text-[10px] text-emerald-700">GPS fills in your area, city and PIN code</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="w-full p-3 rounded-2xl bg-white border border-slate-200 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-[#0A3D2B] text-white flex items-center justify-center shrink-0">
              <MapIcon className="w-4.5 h-4.5" />
            </span>
            <span>
              <span className="text-xs font-bold text-slate-900 block">Choose on map</span>
              <span className="text-[10px] text-slate-500">Move the pin to your exact doorstep</span>
            </span>
          </button>

          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex-1 h-px bg-slate-200" />
            or search
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search area, street, landmark or PIN"
              autoComplete="off"
              className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0A3D2B]/30 focus:border-[#0A3D2B]"
            />
            {searching ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            ) : (
              query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )
            )}
          </div>

          {hits.length > 0 && (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto">
              {hits.map((hit, i) => (
                <li key={`${hit.latitude},${hit.longitude},${i}`}>
                  <button
                    type="button"
                    onClick={() => handlePickHit(hit)}
                    className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 flex items-start gap-2.5 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">{hit.areaName}</span>
                      <span className="text-[10px] text-slate-500 block leading-snug">{hit.label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searched && !searching && hits.length === 0 && query.trim().length >= 3 && (
            <p className="text-[11px] text-slate-500 px-1">
              No places found for “{query.trim()}”. Try a nearby area, road or PIN code.
            </p>
          )}
        </>
      )}

      {picked && (
        <>
          <div className="p-3 rounded-2xl bg-white border border-emerald-300 flex items-start gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-[3]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">{picked.areaName}</p>
              <p className="text-[11px] text-slate-500 leading-snug">
                {picked.city}, {picked.state} - {picked.pincode}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <MapIcon className="w-3 h-3" />
                Adjust pin
              </button>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Save address as</p>
            <div className="grid grid-cols-3 gap-2">
              {LABEL_CHOICES.map(({ value, text, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLabel(value)}
                  aria-pressed={label === value}
                  className={`py-2.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    label === value
                      ? 'border-[#0A3D2B] bg-emerald-50 text-[#0A3D2B]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {text}
                </button>
              ))}
            </div>
            {label === 'OTHER' && (
              <input
                type="text"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value.slice(0, 30))}
                placeholder="Name it, e.g. Mom's house (optional)"
                className="mt-2 w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0A3D2B]/30 focus:border-[#0A3D2B]"
              />
            )}
          </div>

          <div className="relative">
            <Home className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value.slice(0, 60))}
              placeholder="House / Flat No (Optional)"
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0A3D2B]/30 focus:border-[#0A3D2B]"
            />
          </div>
          <LandmarkPicker
            latitude={picked.latitude}
            longitude={picked.longitude}
            value={landmark}
            onChange={setLandmark}
          />
        </>
      )}

      {error && <p className="text-[11px] font-semibold text-rose-600 px-1">⚠️ {error}</p>}

      {mapOpen && (
        <MapPinPicker
          latitude={picked?.latitude ?? location.latitude}
          longitude={picked?.longitude ?? location.longitude}
          onConfirm={handlePinned}
          onClose={() => setMapOpen(false)}
        />
      )}

      <div className="flex gap-2 pt-1">
        {!hideCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!picked || saving}
          className="flex-1 py-2 rounded-xl bg-[#0A3D2B] text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Address
        </button>
      </div>
    </div>
  );
};
