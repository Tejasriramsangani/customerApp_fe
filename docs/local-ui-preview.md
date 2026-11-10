# Local customer UI preview

Actual mock OTP login remains **blocked**: the configured database is remote and
its isolation is unverified; local MongoDB was unavailable. No backend provider,
database configuration, OTP verification or session logic was changed.

The existing local backend selects `SMS_PROVIDER=fast2sms` with
`FAST2SMS_CHANNEL=whatsapp`, so MockSmsService and its generated `devOtp` response
are not used. A provider delivery failure returns `OTP_SMS_FAILED`; it cannot
navigate to verification as if a code had been delivered. Reported HTTP 401 is
an authorization rejection, not evidence of template approval status.

This separate frontend harness reuses existing screens with one synthetic
customer and in-memory sample data. It is **not login**: no JWT, OTP, real
customer, authenticated request or database write is created. All auth actions
are rejected. Use the screen selector to view the unchanged login and OTP
screens; no code is shown or accepted in preview.

## Start (PowerShell, in customerApp_fe)

Create a unique password with at least 32 characters and 16 distinct characters,
preferably in your password manager. Do not use an API key or share it in chat.

```powershell
$env:NODE_ENV = 'development'
$env:ASLIKAATA_UI_PREVIEW_ENABLED = 'true'
$previewCredential = Read-Host 'Local preview password' -AsSecureString
$env:ASLIKAATA_UI_PREVIEW_SECRET = [System.Net.NetworkCredential]::new('', $previewCredential).Password
npm.cmd run preview:ui
```

Keep this terminal open. Open **http://127.0.0.1:3010** on this computer and enter
the same password. The normal app at http://localhost:3000 still uses real OTP.
The backend is not required for preview. No environment files need changing.

Preview binds only to loopback, requires a signed HttpOnly SameSite cookie,
rejects forwarded/cross-origin requests, rate limits unlocking and refuses
production/staging/hosted environments. The normal Next server cannot unlock
it; production builds return 404 for `/ui-preview`. Never deploy or tunnel it.

Use Home/Rates/My Pickups/Profile/Request navigation and the preview selector.
The address form starts with an explicitly synthetic place; saved preview
addresses and profile edits exist only in memory and reset on refresh.
Booking screens can be designed, but submitting a real booking is disabled.
Unsupported endpoints return preview errors without network requests.

Preview-only browser policies disable external connections and GPS. Live Maps,
search, GPS, uploads, realtime tracking, payments, OTP verification and database
persistence are not supported or validated here. Their source/UI is unchanged.

## Disable

Click **Lock preview** to clear its cookie. Stop its terminal with Ctrl+C and
close the terminal, or clear the process variables:

```powershell
Remove-Item Env:ASLIKAATA_UI_PREVIEW_ENABLED,Env:ASLIKAATA_UI_PREVIEW_SECRET,Env:NODE_ENV -ErrorAction SilentlyContinue
Remove-Variable previewCredential -ErrorAction SilentlyContinue
```

## Files and checks

- `scripts/customer-ui-preview.cjs`, `scripts/ui-preview-security.cjs`: local server and secret gate.
- `scripts/ui-preview.test.cjs`: security, session and network-isolation tests.
- `src/app/ui-preview/page.tsx`, `src/components/preview/CustomerUiPreview.tsx`: separate harness using existing components.
- `src/lib/ui-preview-data.ts`: synthetic in-memory fixtures.
- `src/lib/api-client.ts`: preview transport before network/token handling.
- `src/context/AuthContext.tsx`: synthetic persona without authentication/storage.
- `next.config.ts`, `tsconfig.json`, `.gitignore`: separate preview development output/types.
- `package.json`: launcher/test commands.
- This document: activation and limitations.
- `../.design-qa/ui-preview-browser.mjs` and its JSON report: browser isolation/navigation verification; the script generates an ephemeral private test secret and stops its own server.

```powershell
npm.cmd run test:ui-preview
npx.cmd tsc --noEmit --incremental false
```

Future real mock login requires a verified isolated database, one restricted
development account, local-only guards and removal of the existing fixed-code
shortcut. None of those backend changes are enabled by this harness.
