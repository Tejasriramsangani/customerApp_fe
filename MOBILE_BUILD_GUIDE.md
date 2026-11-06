# ASLI KAATA Customer App — Mobile Build Guide

## Backend Configuration
- **API Base URL:** `http://52.64.91.185:4000/api/v1`
- **Socket.IO URL:** `http://52.64.91.185:4000`
- **Platform:** Next.js 16 → Capacitor 8 → Android APK

---

## Prerequisites

Install the following before proceeding:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| Android Studio | Ladybug+ | https://developer.android.com/studio |
| Java JDK | 17 | bundled with Android Studio |
| Android SDK | 34 | via Android Studio SDK Manager |

---

## Step-by-Step Mobile Build

### 1. Install dependencies
```bash
cd customerApp_fe
npm install
```

### 2. Add Android platform (run once)
```bash
npx cap add android
node android-config/post-android-setup.js    # patches HTTP + network security
```

### 3. Build the static export and sync to Android
```bash
npm run build:app
# Runs: CAPACITOR_BUILD=1 next build --webpack && cap sync android
```

### 4. Open in Android Studio
```bash
npm run android:open
# Then: Build → Make Project → Run → Select Device
```

---

## Environment Variables

`.env.local` (already created):
```
NEXT_PUBLIC_API_URL=http://52.64.91.185:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://52.64.91.185:4000
```

---

## Changes Made for Mobile

| File | What Changed |
|------|-------------|
| `.env.local` | ✅ Created — sets backend IP for all API calls |
| `capacitor.config.ts` | ✅ Added `allowNavigation`, `allowMixedContent`, edge-to-edge |
| `next.config.ts` | ✅ Added `trailingSlash: true` for Capacitor static export |
| `src/app/globals.css` | ✅ Input font-size ≥ 16px (no iOS zoom), safe areas, overscroll |
| `src/app/layout.tsx` | ✅ `viewportFit: "cover"`, `display: swap` for font, Apple PWA meta |
| `public/manifest.json` | ✅ Created PWA manifest |
| `android-config/` | ✅ Network security config + setup script |

---

## App Flow (All Screens)

```
Splash ──► Onboarding (5 slides) ──► Location Gate ──► Login ──► OTP ──► Personalize
                                                                              │
                                                                              ▼
                                                                       Main App Shell
                                                                       ├── Home Tab
                                                                       ├── Rates Tab
                                                                       ├── + Request (Booking Wizard)
                                                                       ├── My Pickups Tab
                                                                       └── Profile Tab
```

---

## Key Architecture Notes

- **API client** (`src/lib/api-client.ts`): automatic JWT Bearer injection, 401 → refresh token rotation, server health monitoring
- **Push notifications**: Capacitor `@capacitor/push-notifications`, FCM via backend `/devices` endpoint
- **Real-time tracking**: Socket.IO client connects on `PickupDetailsScreen` to live pickup room
- **GPS location**: Browser Geolocation API + backend reverse geocode at `/geo/reverse`
- **Photo upload**: Cloudinary signed upload via backend `/uploads/sign`
- **Offline resilience**: `localStorage` for auth tokens, profile, location — session survives app restart

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API calls fail on device | Verify `network_security_config.xml` has the backend IP; check `usesCleartextTraffic="true"` in `AndroidManifest.xml` |
| Socket.IO disconnects | Confirm `NEXT_PUBLIC_SOCKET_URL` matches backend exactly |
| White screen on launch | Check `out/` directory was created by `next build`; ensure `webDir: "out"` in `capacitor.config.ts` |
| Font not loading | Google Fonts need internet; `display: "swap"` falls back to system font during load |
| GPS not working | In Android Studio, ensure `ACCESS_FINE_LOCATION` permission in `AndroidManifest.xml` |
| Push notifications not working | Requires Firebase setup + `google-services.json` in `android/app/` |

