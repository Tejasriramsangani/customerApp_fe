"use client";

import { Button } from "../ui";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Crosshair,
  Search,
  MapPin,
  Loader2,
  Home,
  Briefcase,
  Map as MapIcon,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "../../lib/api-client";
import { hasPincode } from "../../lib/geo-client";
import { DevicePosition, validCoordinates } from "../../lib/location-access";
import { LandmarkPicker } from "../location/LandmarkPicker";
import { MapPinPicker, PinnedPlace } from "../location/MapPinPicker";
import { LocationSearchScreen } from "../location/LocationSearchScreen";
import { useLocationAccess } from "../location/useLocationAccess";
import { useLocation } from "../../context/LocationContext";
import type { AddressLabel, SavedAddress } from "../../lib/address-helpers";

export interface PickedPlace {
  areaName: string;
  city: string;
  state: string;
  pincode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}
interface AddAddressFormProps {
  onSaved: (address: SavedAddress) => void | Promise<void>;
  onCancel: () => void;
  initialPlace?: PickedPlace | null;
  defaultLabel?: AddressLabel;
  hideTitle?: boolean;
  hideCancel?: boolean;
  onEditPlace?: () => void;
  onSelected?: (
    place: PickedPlace & { houseNumber?: string; landmark?: string },
  ) => void;
}
const LABEL_CHOICES: Array<{
  value: AddressLabel;
  text: string;
  Icon: typeof Home;
}> = [
  { value: "HOME", text: "Home", Icon: Home },
  { value: "WORK", text: "Work", Icon: Briefcase },
  { value: "OTHER", text: "Other", Icon: MapPin },
];

/** The existing address form and API serve both profile/booking and the location-onboarding flow. */
export const AddAddressForm: React.FC<AddAddressFormProps> = ({
  onSaved,
  onCancel,
  initialPlace = null,
  defaultLabel = "HOME",
  hideTitle = false,
  hideCancel = false,
  onEditPlace,
  onSelected,
}) => {
  const { location } = useLocation();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [origin, setOrigin] = useState<DevicePosition | null>(null);
  const [mapTarget, setMapTarget] = useState<{
    latitude?: number;
    longitude?: number;
  }>({});
  const [picked, setPicked] = useState<PickedPlace | null>(initialPlace);
  const [label, setLabel] = useState<AddressLabel>(defaultLabel);
  const [labelName, setLabelName] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // Map edits update only the selected place; preserve all user-entered address fields.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialPlace) setPicked(initialPlace);
  }, [initialPlace]);
  const access = useLocationAccess((position) => {
    setOrigin(position);
    setMapTarget(position);
    setMapOpen(true);
    setSearchOpen(false);
  });
  const handlePinned = (place: PinnedPlace) => {
    setPicked(place);
    setMapOpen(false);
    setSearchOpen(false);
    setError("");
  };
  const validPlace =
    !!picked &&
    validCoordinates(picked.latitude, picked.longitude) &&
    hasPincode(picked) &&
    !!picked.city &&
    !!picked.state &&
    !!picked.formattedAddress;
  const handleSave = async () => {
    if (savingRef.current) return;
    if (!picked || !validPlace) {
      setError(
        "Choose a location with a city, state and valid 6-digit PIN code.",
      );
      return;
    }
    if (onSelected) {
      onSelected({
        ...picked,
        houseNumber: houseNumber.trim(),
        landmark: landmark.trim(),
      });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await apiClient.post<SavedAddress>("/customer/addresses", {
        line1: picked.formattedAddress,
        line2: line2.trim() || undefined,
        houseNumber: houseNumber.trim() || undefined,
        landmark: landmark.trim() || undefined,
        label,
        labelName:
          label === "OTHER" ? labelName.trim() || undefined : undefined,
        city: picked.city,
        state: picked.state,
        pincode: picked.pincode,
        coordinates: [picked.longitude, picked.latitude],
      });
      if (res.success && (res.data?._id || res.data?.id))
        await onSaved(res.data);
      else
        setError(
          getApiErrorMessage(
            res.error,
            "Could not save the address. Please try again.",
          ),
        );
    } catch (reason) {
      setError(
        getApiErrorMessage(
          reason,
          "Could not save the address. Please try again.",
        ),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const portal =
    typeof document !== "undefined"
      ? document.getElementById("customer-mobile-shell") || document.body
      : null;

  return (
    <div className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50/40 space-y-4 mt-2">
      {!hideTitle && (
        <h4 className="text-base font-bold text-brand">
          {onSelected ? "Location Details" : "Add New Address"}
        </h4>
      )}
      {!picked && (
        <>
          <Button
            variant="secondary"
            onClick={() => void access.request()}
            disabled={access.locating}
            className="w-full flex items-center gap-2"
          >
            <Crosshair className="w-5 h-5" />
            {access.locating
              ? "Detecting location…"
              : "Use my current location"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setMapTarget({
                latitude: location.latitude,
                longitude: location.longitude,
              });
              setMapOpen(true);
            }}
            className="w-full flex items-center gap-2"
          >
            <MapIcon className="w-5 h-5" />
            Choose on map
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            Search an area or address
          </Button>
        </>
      )}
      {picked && (
        <>
          <div className="p-3 rounded-2xl bg-white border border-emerald-300 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-brand shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand">{picked.areaName}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {picked.formattedAddress}
              </p>
            </div>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                if (onEditPlace) onEditPlace();
                else {
                  setMapTarget(picked);
                  setMapOpen(true);
                }
              }}
            >
              Edit
            </Button>
          </div>
          {!onSelected && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">
                Save address as
              </p>
              <div className="grid grid-cols-3 gap-2">
                {LABEL_CHOICES.map(({ value, text, Icon }) => (
                  <Button
                    key={value}
                    variant="secondary"
                    disabled={saving}
                    onClick={() => setLabel(value)}
                    aria-pressed={label === value}
                    className={`flex items-center justify-center gap-1 py-3 rounded-xl border-2 text-xs font-bold ${label === value ? "border-brand bg-emerald-50 text-brand" : "border-slate-200 bg-white text-slate-600"}`}
                  >
                    <Icon className="w-4 h-4" />
                    {text}
                  </Button>
                ))}
              </div>
              {label === "OTHER" && (
                <label className="block mt-3 text-xs text-slate-600">
                  Address name (optional)
                  <input
                    aria-label="Address name (optional)"
                    className="w-full mt-1 p-3 rounded-xl bg-white border border-slate-200"
                    value={labelName}
                    maxLength={30}
                    onChange={(event) => setLabelName(event.target.value)}
                    disabled={saving}
                  />
                </label>
              )}
            </div>
          )}
          <label className="block text-xs font-semibold text-slate-600">
            House / Flat Number (optional)
            <input
              aria-label="House / Flat Number (optional)"
              className="w-full mt-1 p-3 rounded-xl bg-white border border-slate-200"
              value={houseNumber}
              maxLength={60}
              onChange={(event) => setHouseNumber(event.target.value)}
              disabled={saving}
            />
          </label>
          {!onSelected && (
            <label className="block text-xs font-semibold text-slate-600">
              Building / Street (optional)
              <input
                aria-label="Building / Street (optional)"
                className="w-full mt-1 p-3 rounded-xl bg-white border border-slate-200"
                value={line2}
                maxLength={120}
                onChange={(event) => setLine2(event.target.value)}
                disabled={saving}
              />
            </label>
          )}
          <LandmarkPicker
            latitude={picked.latitude}
            longitude={picked.longitude}
            value={landmark}
            onChange={setLandmark}
            autoFill={false}
          />
        </>
      )}
      {(error || access.error) && (
        <p role="alert" className="text-xs text-rose-700">
          {error || access.error}
        </p>
      )}
      <div className="flex gap-2 sticky bottom-0 bg-emerald-50 py-2">
        {!hideCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button
          onClick={() => void handleSave()}
          disabled={!validPlace || saving}
          className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {onSelected ? "Use This Address" : "Save Address"}
        </Button>
      </div>
      {mapOpen && (
        <MapPinPicker
          latitude={mapTarget.latitude}
          longitude={mapTarget.longitude}
          currentPosition={origin}
          onSearch={() => setSearchOpen(true)}
          onConfirm={handlePinned}
          onClose={() => setMapOpen(false)}
        />
      )}
      {portal &&
        searchOpen &&
        createPortal(
          <LocationSearchScreen
            query={query}
            onQueryChange={setQuery}
            onBack={() => setSearchOpen(false)}
            onCurrentLocation={() => void access.request()}
            locating={access.locating}
            onSelect={(place) => {
              setMapTarget(place);
              setMapOpen(true);
              setSearchOpen(false);
            }}
          />,
          portal,
        )}
      {portal &&
        access.dialog &&
        createPortal(
          <div className="absolute inset-0 z-[95]">{access.dialog}</div>,
          portal,
        )}
    </div>
  );
};
