/**
 * Native push notifications (Firebase Cloud Messaging) for the Capacitor Android app.
 *
 * Everything here is a no-op in a normal browser, so `npm run dev` and the website keep working.
 * Keep this file identical in customerApp_fe and employee_fe.
 *
 * Flow:  login -> enablePush(register)  -> OS permission -> FCM token -> POST /devices
 *        logout -> disablePush(unregister) -> DELETE /devices
 *        push arrives (app open)  -> PUSH_RECEIVED_EVENT   (refresh data)
 *        user taps a push         -> onPushOpen(cb)         (open the right screen)
 */
import { Capacitor } from '@capacitor/core';

/** Must match PICKUP_CHANNEL_ID in the backend push.service.ts. */
export const PUSH_CHANNEL_ID = 'pickup_updates';
export const PUSH_RECEIVED_EVENT = 'aslikaata:push-received';

const TOKEN_KEY = 'aslikaata_push_token';

export type PushData = Record<string, string | undefined>;
export type PushPlatform = 'ANDROID' | 'IOS';
type RegisterFn = (token: string, platform: PushPlatform) => Promise<unknown>;
type UnregisterFn = (token: string) => Promise<unknown>;

let listenersReady = false;
let registerFn: RegisterFn | null = null;
let pendingOpen: PushData | null = null;
const openListeners = new Set<(data: PushData) => void>();

export const isNativePush = () => typeof window !== 'undefined' && Capacitor.isNativePlatform();

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

async function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;
  const { PushNotifications } = await import('@capacitor/push-notifications');

  await PushNotifications.addListener('registration', ({ value }) => {
    try {
      localStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* storage is optional */
    }
    void registerFn?.(value, Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID');
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration failed', err);
  });

  // App is open: Android does not show a system banner, so let the app refresh itself.
  await PushNotifications.addListener('pushNotificationReceived', (n) => {
    window.dispatchEvent(new CustomEvent(PUSH_RECEIVED_EVENT, { detail: n.data as PushData }));
  });

  // User tapped a notification (also fires after a cold start from a tap).
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = (action.notification.data || {}) as PushData;
    if (openListeners.size === 0) pendingOpen = data;
    else openListeners.forEach((cb) => cb(data));
  });
}

/** Ask for permission, create the Android channel and register this device for the logged-in user. */
export async function enablePush(register: RegisterFn): Promise<void> {
  if (!isNativePush()) return;
  registerFn = register;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await ensureListeners();

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'Pickup updates',
      description: 'Picker assigned, on the way, arrived and schedule changes',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
    // Fires the 'registration' listener, which sends the token to the backend.
    await PushNotifications.register();
  } catch (err) {
    console.warn('[push] enable failed', err);
  }
}

/**
 * Call BEFORE the auth tokens are cleared: the unregister request needs them, and `unregister`
 * is invoked synchronously here so it reads the token before logout wipes it.
 */
export function disablePush(unregister: UnregisterFn): void {
  registerFn = null;
  const token = readToken();
  if (!isNativePush() || !token) return;
  void unregister(token).catch(() => undefined);
}

/** Subscribe to "user tapped a push". A tap that launched the app is delivered immediately. */
export function onPushOpen(cb: (data: PushData) => void): () => void {
  openListeners.add(cb);
  if (pendingOpen) {
    const data = pendingOpen;
    pendingOpen = null;
    cb(data);
  }
  return () => {
    openListeners.delete(cb);
  };
}
