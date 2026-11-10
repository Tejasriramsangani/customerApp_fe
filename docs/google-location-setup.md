# Google location flow setup

## Local inspection

The local customer frontend used Leaflet, and the backend used Nominatim/Overpass. No Google Maps integration or configured Google credential variable names were found in the workspace's environment files or process environment. Keys were not printed. Google Cloud account settings and enabled services cannot be inspected from this workspace without account access.

The location endpoints now use Google Places API (New) and Google Geocoding. The existing map picker renders Google Maps JavaScript. There is no OpenStreetMap/Nominatim fallback in this customer flow.

## Required Google Cloud setup

In the Google Cloud project that has your billing account attached, open **APIs & Services → Library** and verify these APIs are enabled:

- **Maps JavaScript API**: interactive map rendering in Next.js and the Capacitor WebView.
- **Places API (New)**: autocomplete, selected-place details, and existing nearby-landmark suggestions.
- **Geocoding API**: reverse geocoding when GPS coordinates or the map pin change.

Device GPS uses Android foreground location services or browser geolocation, not the billable Google Geolocation API. No routing API is needed for the direct origin-to-pin connection.

In **APIs & Services → Credentials**, reuse appropriate existing keys if available; otherwise create separate restricted keys:

1. Server key: restrict APIs to Places API (New) and Geocoding API, and restrict applications to the backend server's actual outbound IP addresses. Configure `GOOGLE_MAPS_API_KEY` in `aslikaata_be/.env` (or your backend deployment's secret environment). Do not put this value in any `NEXT_PUBLIC_` variable, map-config response or source code. Restart/redeploy the backend.
2. Browser key: restrict APIs to Maps JavaScript API and restrict allowed website referrers to actual frontend origins. Configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `customerApp_fe/.env.local`. This separate key is necessarily visible to Maps JavaScript; it must not be the server key. Include the development/production frontend origins you use. The configured Capacitor Android scheme serves the app at `https://localhost`; verify its referrer authorization on a physical phone. Never remove all restrictions to make a WebView error disappear.
3. Rebuild the frontend and APK after configuring the public browser key (`npm run build:app`, then Android `assembleDebug`). A build made without the key shows a recoverable map-configuration message.

Empty variable names are provided in both projects' `.env.example` files. The examples contain no secrets. Optional `GOOGLE_MAPS_BIAS_LAT` / `GOOGLE_MAPS_BIAS_LNG` backend variables adjust search bias; defaults use the existing Vijayawada service-area center. Bias does not prohibit other valid locations or establish pickup coverage.

## Reused data and behavior

- Existing `AuthContext`, `LocationContext`, `/customer/addresses` GET/POST, address identifiers and GeoJSON coordinate order `[longitude, latitude]`.
- Existing `AddAddressForm`, Home/Work/Other stored enum values, optional house number, landmark and backend address validation. Building/street uses the existing optional `line2` field.
- No floor-number or receiver fields were added: the existing model has neither. Account identity is displayed only from the authenticated user.
- Before login, the same form confirms the location on this device using **Use This Address**, without claiming server persistence. After authentication, **Save Address** succeeds only when the existing API returns a saved record.
- A map choice stays local until confirmation. Failed reverse geocoding preserves coordinates, disables confirmation and offers retry. It never substitutes a hardcoded locality or nearby PIN.

## Provider usage

Autocomplete is debounced by 300 ms. Search session tokens continue into Place Details. Identical in-flight requests are coalesced; superseded responses are ignored. Google predictions and address responses are not cached in a cross-session query store. Required Google attribution is displayed with off-map search and landmark results; Maps JavaScript renders its own attribution.

Android permission requests/settings use the local `LocationAccessPlugin`; no extra package or background permission was added. The plugin accepts approximate foreground permission, reports disabled services, collects coordinates with a timeout and stops collection when the app leaves the foreground. Browser denial shows browser instructions and does not pretend to open native Settings. Native Settings return rechecks permission before locating again.

## Manual checks after configuration

Verify autocomplete, partial words/PIN codes, Place Details and reverse geocoding against your live project. Check Cloud usage/error dashboards if an API returns denied/billing/quota errors. Verify permission denial, permanent denial, approximate location, services disabled, settings return, physical keyboard behavior and GPS accuracy on Android. Confirm a saved address survives a new authenticated session using your deployed backend/database. Fixture tests cannot establish any of these live service/device results.

Google references: [Autocomplete](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete), [API-key security](https://developers.google.com/maps/api-security-best-practices), [Maps JavaScript loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).

## Files in this change

Customer frontend:

- `.env.example`
- `src/components/location/LocationSelectionFlow.tsx`
- `src/components/location/LocationSearchScreen.tsx`
- `src/components/location/LocationBottomSheetModal.tsx`
- `src/components/location/MapPinPicker.tsx`
- `src/components/location/useLocationAccess.tsx`
- `src/components/location/GoogleAttribution.tsx`
- `src/components/location/LandmarkPicker.tsx`
- `src/components/profile/AddAddressForm.tsx`
- `src/context/LocationContext.tsx`
- `src/lib/location-access.ts`
- `src/lib/google-maps.ts`
- `src/lib/geo-client.ts`
- `src/lib/api-client.ts`
- `src/lib/address-helpers.ts`
- `public/google-attribution.png`
- `android/app/src/main/java/com/aslikaata/customer/MainActivity.java`
- `android/app/src/main/java/com/aslikaata/customer/LocationAccessPlugin.java`

Backend:

- `.env.example`
- `src/modules/geo/geo.service.ts`
- `src/modules/geo/geo.controller.ts`
- `test/google-geo.spec.ts`

Workspace `.design-qa/location-flow-*` scripts and reports exercise real components with isolated API/GPS/Google SDK fixtures. They are not part of the production build.

## Executed verification

- Backend TypeScript build passed. Nine Google integration tests and seven existing address tests passed (16 total).
- Customer production build/TypeScript check, Capacitor synchronization and targeted ESLint passed.
- 190 headless-browser fixture checks passed at 360x640, 375x667, 390x844, 412x915 and 430x932, with zero browser runtime exceptions. These cover permission guidance/cancel, GPS prompt/success/timeout, manual search while denied, partial-word/PIN searches, stale/empty/error search results, map coordinates, origin/connecting line/recenter, reverse-geocoding failure/retry, address drafts across map edits, guest confirmation, authenticated saved-address selection, list retry, failed/successful saves, and missing configuration. Search and address actions were also checked after reducing viewport height to simulate a keyboard.
- Seven additional browser checks passed for the existing profile address form, connecting-line origin, duplicate-submit protection, saved-list refresh, Google attribution aspect ratio, session-token continuity and preserving doorstep fields through small GPS changes. Total browser fixture checks: 197. The final Android debug APK build passed, and the production web/native asset directories contain no QA fixture route.
- API responses, GPS and the Google SDK were fixtures in these browser checks. They do not establish live Google API enablement, rendering quality, deployed database persistence or native permission/settings behavior. Those require the setup and manual checks above.
