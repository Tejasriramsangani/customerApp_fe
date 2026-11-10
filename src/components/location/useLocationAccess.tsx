"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, DialogSurface } from "../ui";
import {
  DevicePosition,
  isNativeLocation,
  locateDevice,
  locationPermission,
  openLocationSettings,
} from "../../lib/location-access";

export function useLocationAccess(
  onDetected?: (position: DevicePosition) => void,
) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [needsPermission, setNeedsPermission] = useState(false);
  const [guidance, setGuidance] = useState<false | "permission" | "services">(
    false,
  );
  const returning = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const callback = useRef(onDetected);
  useEffect(() => {
    callback.current = onDetected;
  }, [onDetected]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = useCallback(async () => {
    if (busy.current) return null;
    busy.current = true;
    setLocating(true);
    setError("");
    setNeedsPermission(false);
    try {
      const result = await locateDevice();
      if (!mounted.current) return null;
      if (result.position) {
        if (result.position.accuracy > 100)
          setError(
            "Your device returned an approximate location. Adjust the pin to your doorstep before confirming.",
          );
        callback.current?.(result.position);
        return result.position;
      }
      setNeedsPermission(["denied", "blocked", "disabled"].includes(result.error));
      if (
        result.error === "blocked" ||
        result.error === "disabled" ||
        (!isNativeLocation() && result.error === "denied")
      )
        setGuidance(result.error === "disabled" ? "services" : "permission");
      setError(
        result.error === "timeout"
          ? "Location detection timed out. Retry or search manually."
          : result.error === "disabled"
            ? "Device location services are turned off. Enable them or search manually."
            : result.error === "denied" || result.error === "blocked"
              ? "Location access is not allowed. You can search manually."
              : "Your location is unavailable. Retry or search manually.",
      );
      return null;
    } finally {
      busy.current = false;
      if (mounted.current) setLocating(false);
    }
  }, []);

  useEffect(() => {
    const resume = async () => {
      if (!returning.current || document.visibilityState === "hidden") return;
      returning.current = false;
      try {
        const status = await locationPermission();
        if (status.state === "granted" && status.servicesEnabled) {
          setGuidance(false);
          await request();
        }
      } catch {
        setError(
          "Could not check location permission. You can still search manually.",
        );
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [request]);

  const dialog = guidance && (
    <div className="absolute inset-0 z-[90] bg-slate-950/60 flex items-center justify-center p-5">
      <DialogSurface
        label="Grant Location Permission"
        onClose={() => setGuidance(false)}
        className="w-full p-5 bg-white rounded-2xl space-y-4 max-h-full overflow-y-auto"
      >
        <h2 className="text-xl font-bold text-brand">
          {guidance === "services"
            ? "Turn On Device Location"
            : "Grant Location Permission"}
        </h2>
        <p className="text-sm text-slate-600">
          To detect your pickup location accurately, enable location access for
          ASLI KAATA.
        </p>
        <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-2">
          {isNativeLocation() ? (
            <>
              <li>Open device Settings.</li>
              <li>
                {guidance === "services"
                  ? "Turn on device Location services."
                  : "Select Apps → ASLI KAATA → Permissions → Location."}
              </li>
              <li>Allow location access while using the app.</li>
            </>
          ) : (
            <>
              <li>Open this browser’s site settings for this page.</li>
              <li>
                Allow Location, and check that device Location services are
                enabled.
              </li>
              <li>Return here and tap Turn on Location to retry.</li>
            </>
          )}
        </ol>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setGuidance(false)}>
            Cancel
          </Button>
          {isNativeLocation() && (
            <Button
              onClick={async () => {
                try {
                  returning.current = true;
                  await openLocationSettings(guidance === "services");
                } catch {
                  returning.current = false;
                  setError(
                    "Settings could not be opened. Open device Settings manually.",
                  );
                }
              }}
            >
              Open Settings
            </Button>
          )}
        </div>
      </DialogSurface>
    </div>
  );
  return { request, locating, error, needsPermission, dialog };
}
