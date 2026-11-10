"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Crosshair,
  Home,
  Loader2,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "../ui";
import viewportStyles from "./LocationViewport.module.css";
import { useAuth } from "../../context/AuthContext";
import { LocationData, useLocation } from "../../context/LocationContext";
import { apiClient } from "../../lib/api-client";
import {
  addressIdOf,
  addressLine,
  addressTitle,
  addressToLocation,
  nextAddressLabel,
  SavedAddress,
} from "../../lib/address-helpers";
import { DevicePosition } from "../../lib/location-access";
import { AddAddressForm, PickedPlace } from "../profile/AddAddressForm";
import { MapPinPicker } from "./MapPinPicker";
import { LocationSearchScreen } from "./LocationSearchScreen";
import { useLocationAccess } from "./useLocationAccess";

interface Props {
  onClose: () => void;
  onSelectLocation?: (location: LocationData) => void;
  initialHint?: string;
}
type View = "entry" | "search" | "map" | "details";

/** A local navigation flow using the existing auth/location contexts, maps and address form. */
export function LocationSelectionFlow({
  onClose,
  onSelectLocation,
  initialHint,
}: Props) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { location, setLocation } = useLocation();
  const [view, setView] = useState<View>("entry");
  const [searchFrom, setSearchFrom] = useState<"entry" | "map">("entry");
  const [mapFrom, setMapFrom] = useState<"entry" | "search">("entry");
  const [query, setQuery] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [detectOnOpen, setDetectOnOpen] = useState(false);
  const [target, setTarget] = useState<Partial<LocationData>>({});
  const [selected, setSelected] = useState<PickedPlace | null>(null);
  const [origin, setOrigin] = useState<DevicePosition | null>(null);
  const [saved, setSaved] = useState<{ owner: string; list: SavedAddress[] }>({
    owner: "",
    list: [],
  });
  const [loading, setLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const owner = isAuthenticated ? user?.id || "" : "";
  const activeOwner = useRef(owner);
  useEffect(() => {
    activeOwner.current = owner;
  }, [owner]);
  const addresses = saved.owner === owner && owner ? saved.list : [];
  const access = useLocationAccess((position) => {
    setOrigin(position);
    setTarget(position);
    setDetectOnOpen(false);
    setMapOpen(true);
    setView("map");
    setMapFrom("entry");
  });

  const refresh = useCallback(async () => {
    if (!owner) {
      setSaved({ owner: "", list: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setAddressError("");
    try {
      const result = await apiClient.get<SavedAddress[]>("/customer/addresses");
      if (activeOwner.current !== owner) return;
      if (!result.success || !Array.isArray(result.data))
        throw new Error("Could not load your saved addresses.");
      setSaved({ owner, list: result.data });
    } catch {
      if (activeOwner.current === owner)
        setAddressError("Could not load your saved addresses. Please retry.");
    } finally {
      if (activeOwner.current === owner) setLoading(false);
    }
  }, [owner]);
  useEffect(() => {
    // Fetch is tied to authenticated identity; schedule it so identity cleanup runs before the request.
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(
    () => () => {
      activeOwner.current = "";
    },
    [],
  );

  const finish = (place: LocationData) => {
    const confirmed: LocationData = {
      ...place,
      source: "manual",
      houseNumber: place.houseNumber || "",
      landmark: place.landmark || "",
      addressId: place.addressId,
    };
    setLocation(confirmed);
    onSelectLocation?.(confirmed);
    onClose();
  };
  const openSearch = (from: "entry" | "map") => {
    setSearchFrom(from);
    setView("search");
  };
  const addAddress = () => {
    setTarget({ latitude: location.latitude, longitude: location.longitude });
    setDetectOnOpen(true);
    setMapFrom("entry");
    setMapOpen(true);
    setView("map");
  };
  const backMap = () => {
    if (mapFrom === "search") {
      setMapOpen(false);
      setView("search");
    } else {
      setMapOpen(false);
      setView("entry");
    }
  };
  const afterSaved = async (address: SavedAddress) => {
    if (activeOwner.current !== owner || !owner) return;
    setSaved((previous) => ({
      owner,
      list: [
        ...(previous.owner === owner
          ? previous.list.filter((a) => addressIdOf(a) !== addressIdOf(address))
          : []),
        address,
      ],
    }));
    await refresh();
    if (activeOwner.current === owner) finish(addressToLocation(address));
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`absolute inset-0 z-50 bg-canvas flex flex-col ${viewportStyles.screen}`}
      role="dialog"
      aria-modal="true"
      aria-label="Select Your Location"
    >
      <header className="shrink-0 p-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            aria-label="Back from location selection"
            onClick={onClose}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-bold text-brand">Select Your Location</h2>
        </div>
        <Button
          variant="secondary"
          onClick={() => openSearch("entry")}
          className="mt-4 w-full flex items-center justify-between gap-2 text-sm text-slate-500"
        >
          <span>Search an area or address</span>
          <Search className="w-5 h-5 text-brand" />
        </Button>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto p-4 pb-safe space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            disabled={access.locating}
            onClick={() => void access.request()}
            className="flex flex-col items-start gap-3 p-4 text-left"
          >
            <Crosshair
              className={`w-5 h-5 text-brand ${access.locating ? "animate-spin" : ""}`}
            />
            <span>
              {access.locating ? "Detecting location…" : "Turn on Location"}
            </span>
          </Button>
          <Button
            variant="secondary"
            onClick={addAddress}
            className="flex flex-col items-start gap-3 p-4 text-left"
          >
            <Plus className="w-5 h-5 text-brand" />
            <span>Add New Address</span>
          </Button>
        </div>
        {(initialHint || access.error) && (
          <p
            role="status"
            className="text-xs text-amber-800 rounded-xl bg-amber-50 p-3"
          >
            {access.error || initialHint}
          </p>
        )}
        <section aria-labelledby="saved-addresses-title" className="space-y-3">
          <h3
            id="saved-addresses-title"
            className="text-xs font-bold tracking-wider text-slate-500"
          >
            SAVED ADDRESSES
          </h3>
          {(authLoading || loading) && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your addresses…
            </p>
          )}
          {!authLoading && !loading && !owner && (
            <div className="bg-white rounded-2xl p-5 text-sm text-slate-500">
              <Home className="w-6 h-6 text-brand mb-3" />
              <p>
                Your saved addresses will appear after you sign in. You can
                search and confirm a pickup location now.
              </p>
            </div>
          )}
          {addressError && (
            <div role="alert" className="text-sm text-rose-700 space-y-2">
              <p>{addressError}</p>
              <Button variant="secondary" onClick={() => void refresh()}>
                Retry saved addresses
              </Button>
            </div>
          )}
          {!!owner && !loading && !addressError && addresses.length === 0 && (
            <p className="text-sm text-slate-500 p-5 bg-white rounded-2xl">
              No saved addresses yet. Add your first pickup address.
            </p>
          )}
          <ul className="bg-white rounded-2xl overflow-hidden divide-y divide-slate-100">
            {addresses.map((address) => (
              <li key={addressIdOf(address)}>
                <Button
                  variant="ghost"
                  onClick={() => finish(addressToLocation(address))}
                  className="w-full p-4 flex items-start gap-3 text-left rounded-none"
                >
                  <MapPin className="w-5 h-5 text-brand shrink-0 mt-1" />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      {addressTitle(address)}
                      {address.isDefault ? " · Primary" : ""}
                    </span>
                    <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                      {[
                        addressLine(address),
                        address.city,
                        address.state,
                        address.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </main>
      {mapOpen && (
        <MapPinPicker
          inline
          active={view === "map"}
          latitude={target.latitude}
          longitude={target.longitude}
          currentPosition={origin}
          detectOnOpen={detectOnOpen}
          onClose={backMap}
          onSearch={() => openSearch("map")}
          onConfirm={(place) => {
            setSelected(place);
            setView("details");
          }}
        />
      )}
      {selected && (
        <section
          className={`absolute inset-0 z-[70] bg-canvas flex flex-col ${viewportStyles.screen} ${view === "details" ? "" : "hidden"}`}
          aria-label="Location Details"
        >
          <header className="shrink-0 p-4 bg-white border-b border-slate-100 flex items-center gap-3">
            <Button
              variant="ghost"
              aria-label="Back to map"
              onClick={() => setView("map")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-bold text-brand">Location Details</h2>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-safe">
            {owner && user && (
              <p className="text-xs text-slate-500 mb-3">
                Saving to {user.fullName || user.mobile}’s account
              </p>
            )}
            <AddAddressForm
              key={owner || "guest"}
              initialPlace={selected}
              defaultLabel={nextAddressLabel(addresses)}
              hideTitle
              onCancel={() => setView("map")}
              onEditPlace={() => setView("map")}
              onSaved={afterSaved}
              onSelected={
                owner
                  ? undefined
                  : (place) => finish({ ...place, source: "manual" })
              }
            />
            {!owner && (
              <p className="text-xs text-slate-500 mt-3">
                This confirms your pickup location on this device. Save it to
                your account after signing in.
              </p>
            )}
          </div>
        </section>
      )}
      {view === "search" && (
        <LocationSearchScreen
          query={query}
          onQueryChange={setQuery}
          onBack={() => setView(searchFrom)}
          bias={target.latitude != null && target.longitude != null ? { latitude: target.latitude, longitude: target.longitude } : undefined}
          locating={access.locating}
          onCurrentLocation={() => void access.request()}
          onSelect={(place) => {
            setTarget(place);
            setDetectOnOpen(false);
            setMapFrom(searchFrom === "map" ? mapFrom : "search");
            setMapOpen(true);
            setView("map");
          }}
        />
      )}
      {access.dialog}
    </div>,
    document.getElementById("customer-mobile-shell") || document.body,
  );
}
