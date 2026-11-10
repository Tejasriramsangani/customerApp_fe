# Android location fixes and remaining verification

## Findings

The customer APK uses Capacitor 8, application ID `com.aslikaata.customer`,
bundled static files, and the default `https://localhost` origin. It does not
load a hosted frontend or laptop development server. The frontend's public Maps
key is embedded at build time. The synced assets contain the configured browser
key and `http://52.64.91.185:4000/api/v1` backend endpoint (verified without printing
the key). No environment values or deployment settings were changed.

Read-only checks of that backend returned:

| Endpoint | Result |
| --- | --- |
| `/api/v1/geo/search-config` | HTTP 404 |
| `/api/v1/geo/map-config` | HTTP 200; no Google provider/configured metadata |

The local backend has a Google Places (New) implementation with autocomplete
enabled and a two-character minimum. The deployed endpoint therefore does not
match the local implementation. A local backend `.env` cannot configure AWS.
The APK cannot provide the intended Google autocomplete against the currently
observed deployed routes. Deployment remains a separate, unperformed action.

## Issue-by-issue status

1. **Blank/denied map:** the screenshot demonstrates provider authorization
   rejection, but the exact Google error code and Cloud key restrictions cannot
   be established without device inspection and Cloud access. The SDK constructor
   can exist even after authorization fails. We now require `tilesloaded` before
   enabling confirmation, time out missing tiles, and avoid reusing an SDK known
   to have failed authorization. The key restrictions themselves are unchanged.
2. **GPS:** native fine/coarse permissions and the custom foreground location
   plugin were already present. Approximate fixes are accepted with guidance;
   no default city is returned as GPS. A late GPS result now cannot replace a
   pin the user dragged while detection was pending. Turning off location
   services during a native request now reports `disabled` rather than waiting
   for a timeout. Real GPS accuracy remains unverified.
3. **Confirmation:** inspection shows a React view-state transition to the
   existing address form, not a new route, URL, deep link, or external browser.
   The exported static bundle passes map-to-details and return-to-map tests.
   The physical-device black screen was not reproduced; its root cause remains
   unconfirmed and requires Logcat/WebView evidence. No speculative redirect or
   authentication change was made.
4. **Search:** the deployed search-config route is missing. Configuration errors
   now remain visible while typing instead of being cleared by the query effect;
   the interface no longer suggests tapping Search while configuration is absent.
   Existing debounce, session tokens, and stale-search protection remain intact.
5. **Nearby relevance:** search now accepts the flow's selected coordinates as
   bias before falling back to the active customer location. The backend already
   sends a 50km circular Google location bias. Predictions retain Google's textual
   relevance ordering; no guessed distances, forced sorting, or per-keystroke
   Place Details fan-out were added. Search does not request GPS permission.
6. **System bars:** location overlays now read Capacitor 8 SystemBars' injected
   `--safe-area-inset-*` variables, falling back to browser `env()`. Capacitor
   injects zero when native padding already handles older WebViews. Header and
   footer handling is scoped to location screens; unrelated screens were not
   changed. Physical status bar and keyboard behavior remains pending.
7. **Top map search:** removed only the large yellow map-header search control.
   The manual entry/search screen and error-recovery search action remain.
8. **Network/build:** INTERNET and location permissions, the backend's existing
   cleartext exception, mixed-content setting, static export, package ID, and
   bundled API origin were inspected. No production endpoint or network-security
   restrictions were relaxed. HTTPS backend migration requires an approved
   reachable endpoint; none was invented.

## Google Cloud configuration to verify manually

- Browser key: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, Maps JavaScript API enabled,
  billing active, Websites application restriction. Inspect the actual denied
  request/referrer in the APK's remotely debugged WebView. Its configured page
  origin is `https://localhost`; authorize the actual HTTPS referrer only after
  confirming it is sent. Do not use an Android package/SHA-1 restriction on this
  Maps JavaScript key.
- Server key: `GOOGLE_MAPS_API_KEY`, kept on the deployed backend, restricted to
  its server egress IP(s) and required APIs: Places API (New) and Geocoding API.
- The current local Google geo implementation must be deployed through the
  project's approved release process before the APK can use its routes on AWS.
- If the installed WebView omits the referrer for bundled content, website
  authorization cannot be fixed by guessing another referrer. Google's supported
  alternatives require a proper HTTPS-hosted Maps page or a native Maps SDK
  integration with a separate Android-restricted key. Neither was silently
  introduced; no unrestricted key or backend key is used in the browser.
- Restart/reload the app after correcting authorization; a failed SDK is not
  considered a successful retry merely because its global constructor exists.

Reference: https://developers.google.com/maps/api-security-best-practices

## Verification completed

- TypeScript/static Android export and targeted component/library lint passed.
- `npm.cmd run build:app` and Gradle `assembleDebug` passed.
- Bundled key presence/match and AWS API endpoint checked without exposing keys.
- Public AWS config GETs performed without authentication or database mutations.
- Four isolated Maps-loader unit tests passed (missing key, concurrent loading,
  authorization failure after SDK readiness, network-failure retry).
- 25 exported-bundle browser checks passed at 360x800, 390x844, 412x915:
  typing-to-predictions, selection, map confirmation, details without URL changes,
  return-to-map, authorization-error cleanup, latest-search wins, injected top
  insets, persistent missing-route error messaging, and constrained
  keyboard-height results. Google Maps/GPS and backend responses were simulated
  only in the external QA harness. These are not live Google/device claims.
- `adb devices` returned no connected devices. No APK installation, real Google
  tile authorization test, physical GPS test, or device Logcat capture occurred.
- No live OTPs, authenticated backend mutations, or database writes were made.

## Changed source files

- `src/lib/google-maps.ts`
- `src/components/location/MapPinPicker.tsx`
- `src/components/location/LocationSearchScreen.tsx`
- `src/components/location/LocationSelectionFlow.tsx`
- `src/components/location/LocationViewport.module.css` (new)
- `android/app/src/main/java/com/aslikaata/customer/LocationAccessPlugin.java`

Capacitor sync also regenerates bundled Android web assets/configuration. QA is
in the workspace `.design-qa/apk-location-qa.mjs` and its browser report.

## Rebuild and install (PowerShell)

```powershell
cd C:\Users\Dell\Downloads\AsliKaata_Codebase\customerApp_fe
npm.cmd run build:app
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
cd android
.\gradlew.bat assembleDebug --console=plain
$androidAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $androidAdb devices
& $androidAdb install -r .\app\build\outputs\apk\debug\app-debug.apk
& $androidAdb shell am start -n com.aslikaata.customer/.MainActivity
```

Connect one USB-debugging-enabled phone and accept its computer authorization
before installing. These commands produce a debug APK, not a signed Play Store
release. Use `chrome://inspect/#devices` to inspect the debug WebView. Record the
Google error code and referrer without sharing key-bearing URLs or credentials.
For the black screen, record its reproduction steps and native/React stack
before reloading. Keep raw logs private and redact tokens, keys, and personal data.

## Acceptance still pending

On the installed APK: authorize Maps, verify real tiles, precise/approximate GPS,
denied permission, disabled GPS, timeout, settings return, real autocomplete and
Place Details, repeated confirmation, and system bars with the keyboard open.
Do not save an address against the unverified staging database. Address saving
and persistence require a separately approved isolated test environment.
