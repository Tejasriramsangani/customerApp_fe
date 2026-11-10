import { Capacitor, registerPlugin } from "@capacitor/core";

export type LocationPermission =
  "granted" | "prompt" | "denied" | "blocked" | "unsupported";
export interface PermissionStatus {
  state: LocationPermission;
  servicesEnabled: boolean;
}
interface NativeLocationSettings {
  status(): Promise<PermissionStatus>;
  request(): Promise<PermissionStatus>;
  position(): Promise<DevicePosition>;
  openSettings(options: { locationServices: boolean }): Promise<void>;
}
const native = registerPlugin<NativeLocationSettings>("LocationAccess");
export const isNativeLocation = () => Capacitor.getPlatform() === "android";

export async function locationPermission(): Promise<PermissionStatus> {
  if (isNativeLocation()) return native.status();
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return { state: "unsupported", servicesEnabled: true };
  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return { state: result.state, servicesEnabled: true };
  } catch {
    return { state: "prompt", servicesEnabled: true };
  }
}

export async function openLocationSettings(
  locationServices = false,
): Promise<boolean> {
  if (!isNativeLocation()) return false;
  await native.openSettings({ locationServices });
  return true;
}

export interface DevicePosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}
export type LocationFailure =
  "denied" | "blocked" | "disabled" | "timeout" | "unavailable" | "unsupported";
export type PositionResult =
  | { position: DevicePosition; error?: never }
  | { position?: never; error: LocationFailure };
export function validCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}
let pending: Promise<PositionResult> | null = null;
let recent: DevicePosition | null = null;

/** One foreground request at a time. Reuse only a recent, sufficiently accurate, permitted fix. */
export async function locateDevice(): Promise<PositionResult> {
  if (pending) return pending;
  pending = (async (): Promise<PositionResult> => {
    try {
      let permission = await locationPermission();
      if (!permission.servicesEnabled) return { error: "disabled" };
      if (permission.state === "unsupported") return { error: "unsupported" };
      if (
        permission.state === "blocked" ||
        (!isNativeLocation() && permission.state === "denied")
      )
        return { error: permission.state };
      if (isNativeLocation() && permission.state !== "granted")
        permission = await native.request();
      if (isNativeLocation() && permission.state !== "granted")
        return { error: permission.state === "blocked" ? "blocked" : "denied" };
      if (
        permission.state === "granted" &&
        recent &&
        Date.now() - recent.timestamp < 30000 &&
        recent.accuracy <= 100
      )
        return { position: recent };
      if (isNativeLocation()) {
        try {
          const position = await native.position();
          if (!validCoordinates(position.latitude, position.longitude))
            return { error: "unavailable" };
          recent = position;
          return { position };
        } catch (reason) {
          const code =
            reason && typeof reason === "object" && "code" in reason
              ? reason.code
              : "";
          return {
            error:
              code === "timeout"
                ? "timeout"
                : code === "disabled"
                  ? "disabled"
                  : code === "denied"
                    ? "denied"
                    : "unavailable",
          };
        }
      }
      return await new Promise<PositionResult>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (result) => {
            const { latitude, longitude, accuracy } = result.coords;
            if (!validCoordinates(latitude, longitude)) {
              resolve({ error: "unavailable" });
              return;
            }
            recent = {
              latitude,
              longitude,
              accuracy,
              timestamp: result.timestamp,
            };
            resolve({ position: recent });
          },
          (error) =>
            resolve({
              error:
                error.code === 1
                  ? "denied"
                  : error.code === 3
                    ? "timeout"
                    : "unavailable",
            }),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        );
      });
    } catch {
      return { error: "unavailable" };
    }
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
