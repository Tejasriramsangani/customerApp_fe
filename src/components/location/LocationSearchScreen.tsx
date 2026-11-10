"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "../ui";
import viewportStyles from "./LocationViewport.module.css";
import {
  loadSearchConfig,
  newSearchSession,
  resolveSearchPlace,
  SearchConfig,
  searchLocations,
  SearchPlace,
} from "../../lib/geo-client";
import { LocationData, useLocation } from "../../context/LocationContext";
import { GoogleAttribution } from "./GoogleAttribution";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onSelect: (place: LocationData) => void;
  onCurrentLocation: () => void;
  locating?: boolean;
  bias?: { latitude: number; longitude: number };
}

/** Shared by the location entry, map and address form. Search never requests GPS. */
export function LocationSearchScreen({
  query,
  onQueryChange,
  onBack,
  onSelect,
  onCurrentLocation,
  locating,
  bias: selectedBias,
}: Props) {
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [hits, setHits] = useState<SearchPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [sessionToken, setSessionToken] = useState(newSearchSession);
  const [resolving, setResolving] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const [configError, setConfigError] = useState('');
  const { location } = useLocation();
  const biasLatitude = selectedBias?.latitude ?? location.latitude;
  const biasLongitude = selectedBias?.longitude ?? location.longitude;
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    loadSearchConfig()
      .then((value) => {
        if (active) {
          setConfig(value);
          if (!value.configured)
            setError(
              "Location search is not configured. Please contact support.",
            );
        }
      })
      .catch(() => {
        if (active) setConfigError("Could not load location search from the server. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [configAttempt]);
  useEffect(() => {
    const seq = ++sequence.current;
    const text = query.trim();
    // Reset provider response state when its query/session changes, before accepting new responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHits([]);
    setError("");
    setSearched(false);
    setSearching(false);
    if (
      !config?.configured ||
      text.length < config.minimumCharacters ||
      (!config.autocomplete && submitted !== text)
    )
      return;
    setSearching(true);
    const timer = window.setTimeout(
      () => {
        const bias = biasLatitude != null && biasLongitude != null
          ? { latitude: biasLatitude, longitude: biasLongitude } : undefined;
        searchLocations(text, sessionToken, bias)
          .then((results) => {
            if (seq === sequence.current) setHits(results);
          })
          .catch(() => {
            if (seq === sequence.current)
              setError(
                "Location search is temporarily unavailable. Please retry.",
              );
          })
          .finally(() => {
            if (seq === sequence.current) {
              setSearching(false);
              setSearched(true);
            }
          });
      },
      config.autocomplete ? 300 : 0,
    );
    return () => {
      sequence.current += 1;
      window.clearTimeout(timer);
    };
  }, [
    query,
    config,
    submitted,
    sessionToken,
    biasLatitude,
    biasLongitude,
  ]);
  const pick = async (hit: SearchPlace) => {
    if (resolving) return;
    const seq = ++sequence.current;
    setResolving(true);
    setError("");
    try {
      const place = await resolveSearchPlace(hit, sessionToken);
      if (seq === sequence.current) {
        setSessionToken(newSearchSession());
        onSelect(place);
      }
    } catch {
      if (seq === sequence.current)
        setError(
          "Could not resolve this place. Select it again or try another result.",
        );
    } finally {
      setResolving(false);
    }
  };
  return (
    <section
      className={`absolute inset-0 z-[80] bg-canvas flex flex-col ${viewportStyles.screen}`}
      aria-label="Location search"
    >
      <header className="shrink-0 p-4 space-y-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            aria-label="Back from search"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-bold text-brand">Select Your Location</h2>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand" />
            <input
              autoFocus
              type="search"
              aria-label="Search an area or address"
              placeholder="Search an area or address"
              autoComplete="off"
              value={query}
              maxLength={120}
              disabled={resolving}
              onChange={(event) => {
                onQueryChange(event.target.value);
                setSubmitted("");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                aria-label="Clear location search"
                onClick={() => {
                  onQueryChange("");
                  setSubmitted("");
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {config && !config.autocomplete && (
            <Button
              type="submit"
              disabled={
                query.trim().length < config.minimumCharacters || searching
              }
              aria-label="Search locations"
            >
              <Search className="w-5 h-5" />
            </Button>
          )}
        </form>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-safe">
        {!config && configError && (
          <div role="alert" className="text-sm text-rose-700">
            <p>{configError}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setConfigError("");
                setConfigAttempt((value) => value + 1);
              }}
            >
              Retry search
            </Button>
          </div>
        )}
        {config && !config.configured && (
          <p role="alert" className="text-sm text-amber-800">
            Google location search is not configured yet. Saved addresses remain
            available.
          </p>
        )}
        {!query.trim() && (
          <Button
            variant="secondary"
            onClick={onCurrentLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2"
          >
            <Crosshair className="w-5 h-5" />
            {locating ? "Detecting location…" : "Turn on Location"}
          </Button>
        )}
        {query.trim() &&
          config &&
          query.trim().length < config.minimumCharacters && (
            <p className="text-sm text-slate-500">
              Enter at least {config.minimumCharacters} characters.
            </p>
          )}
        {query.trim().length >= (config?.minimumCharacters ?? 3) && (
          <>
            <h3 className="text-xs font-bold tracking-wider text-slate-500 mb-3">
              SEARCH RESULTS
            </h3>
            {searching && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-slate-500"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching locations…
              </p>
            )}
            {resolving && (
              <p role="status" className="text-sm text-slate-500">
                Resolving selected location…
              </p>
            )}
            {error && (
              <div role="alert" className="text-sm text-rose-700 space-y-2">
                <p>{error}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSubmitted("");
                    window.setTimeout(() => setSubmitted(query.trim()), 0);
                  }}
                >
                  Retry search
                </Button>
              </div>
            )}
            {searched && !searching && !error && hits.length === 0 && (
              <p className="text-sm text-slate-500">
                No matching places. Try a nearby road, locality or PIN code.
              </p>
            )}
            {config?.configured && !config.autocomplete && !searched && !searching && (
              <p className="text-sm text-slate-500">
                Tap Search to find matching locations.
              </p>
            )}
            <ul className="rounded-2xl overflow-hidden bg-white divide-y divide-slate-100">
              {hits.map((hit) => (
                <li key={hit.placeId}>
                  <Button
                    variant="ghost"
                    disabled={resolving}
                    onClick={() => void pick(hit)}
                    className="w-full p-4 text-left flex items-start gap-3 rounded-none"
                  >
                    <MapPin className="w-5 h-5 text-brand shrink-0 mt-1" />
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        {hit.areaName}
                      </span>
                      <span className="block mt-1 text-xs text-slate-500 leading-relaxed">
                        {hit.label}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            {hits.length > 0 && <GoogleAttribution />}
          </>
        )}
      </div>
    </section>
  );
}
