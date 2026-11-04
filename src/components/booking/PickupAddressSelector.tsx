"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Home, MapPin, Plus, X, Loader2, Check, Star } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import {
  MAX_SAVED_ADDRESSES,
  SavedAddress,
  AddressLabel,
  addressIdOf,
  addressLine,
  addressTitle,
  fetchSavedAddresses,
  nextAddressLabel,
} from '../../lib/address-helpers';
import { isCompleteBookingAddress } from '../../lib/booking-helpers';
import { useLocation } from '../../context/LocationContext';
import { AddAddressForm, PickedPlace } from '../profile/AddAddressForm';

interface PickupAddressSelectorProps {
  /** The address currently chosen for this booking. */
  selectedId?: string;
  /** Called whenever the chosen address changes, including the automatic first choice. */
  onSelect: (address: SavedAddress) => void;
}

const ICONS: Record<AddressLabel, typeof Home> = { HOME: Home, WORK: Briefcase, OTHER: MapPin };

/**
 * Where should we pick it up? The customer's saved addresses (Home / Work / Other, primary first) to tap,
 * a "make primary" shortcut, and "Add new address". The primary one is selected by default, and a single
 * address is automatically primary.
 */
export const PickupAddressSelector: React.FC<PickupAddressSelectorProps> = ({ selectedId, onSelect }) => {
  const { location } = useLocation();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  /** Reload the list, then make sure one valid address is selected (`prefer` wins, then the current choice, then primary). */
  const refresh = useCallback(async (prefer?: string, forceEmit = false) => {
    const list = await fetchSavedAddresses();
    setAddresses(list);
    setLoading(false);
    if (list.length === 0) return;

    const byId = (id?: string) => (id ? list.find((a) => addressIdOf(a) === id) : undefined);
    const chosen = byId(prefer) || byId(selectedRef.current) || list.find((a) => a.isDefault) || list[0];
    if (forceEmit || addressIdOf(chosen) !== selectedRef.current) onSelectRef.current(chosen);
  }, []);

  useEffect(() => {
    void refresh(undefined, true);
  }, [refresh]);

  const makePrimary = async (address: SavedAddress) => {
    const id = addressIdOf(address);
    setBusyId(id);
    setError('');
    try {
      const res = await apiClient.put(`/customer/addresses/${id}/primary`);
      if (!res.success) setError('Could not change the primary address. Please try again.');
    } catch {
      setError('Could not change the primary address. Please try again.');
    }
    setBusyId('');
    await refresh(selectedRef.current);
  };

  const handleSaved = async (saved: SavedAddress) => {
    setAdding(false);
    await refresh(addressIdOf(saved), true);
  };

  // The customer's current location, if it is a complete address, saves them retyping it for a first address.
  const currentPlace: PickedPlace | null = isCompleteBookingAddress(location)
    ? {
        areaName: location.areaName,
        city: location.city,
        state: location.state || '',
        pincode: location.pincode,
        formattedAddress: location.formattedAddress,
        latitude: location.latitude!,
        longitude: location.longitude!,
      }
    : null;

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  // First address: no choice to make yet, just name it and save.
  if (addresses.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Pickup address</h3>
        <p className="text-xs text-slate-500">Where should we collect your scrap? Save your address to continue.</p>
        <AddAddressForm
          onSaved={handleSaved}
          onCancel={() => undefined}
          initialPlace={currentPlace}
          defaultLabel="HOME"
          hideTitle
          hideCancel
        />
      </div>
    );
  }

  const canAdd = addresses.length < MAX_SAVED_ADDRESSES;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Pickup address</h3>
        {canAdd && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 cursor-pointer hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Add new address
          </button>
        )}
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Pickup address">
        {addresses.map((address) => {
          const id = addressIdOf(address);
          const selected = id === selectedId;
          const Icon = ICONS[address.label || 'OTHER'];
          return (
            <div
              key={id}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => onSelect(address)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(address);
                }
              }}
              className={`rounded-2xl border-2 p-3 flex items-start gap-3 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A3D2B]/40 ${
                selected ? 'border-[#0A3D2B] bg-emerald-50 ring-2 ring-[#0A3D2B]/10' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  selected ? 'bg-[#0A3D2B] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-900">{addressTitle(address)}</span>
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{addressLine(address)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {address.city} - {address.pincode}
                  {address.landmark ? ` · Near ${address.landmark}` : ''}
                </p>
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void makePrimary(address);
                    }}
                    disabled={busyId === id}
                    className="mt-1.5 text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
                  >
                    {busyId === id && <Loader2 className="w-3 h-3 animate-spin" />}
                    Make primary
                  </button>
                )}
              </div>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                  selected ? 'border-[#0A3D2B] bg-[#0A3D2B] text-white' : 'border-slate-300'
                }`}
                aria-hidden="true"
              >
                {selected && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </div>
          );
        })}
      </div>

      {!canAdd && (
        <p className="text-[10px] text-slate-400">
          You can save up to {MAX_SAVED_ADDRESSES} addresses. Delete one in Profile → My Addresses to add another.
        </p>
      )}
      {error && <p className="text-[11px] font-semibold text-rose-600">⚠️ {error}</p>}

      {adding &&
        typeof document !== 'undefined' &&
        createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Add New Address</h3>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AddAddressForm
              onSaved={handleSaved}
              onCancel={() => setAdding(false)}
              defaultLabel={nextAddressLabel(addresses)}
              hideTitle
            />
          </div>
        </div>,
        document.body,
        )}
    </div>
  );
};
