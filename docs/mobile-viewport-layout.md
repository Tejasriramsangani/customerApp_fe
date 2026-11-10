# Customer viewport and location screen verification

The customer shell is centered at a maximum width of 430px and follows the available visual viewport. Document scrolling is disabled; long page content scrolls within the shell. Headers, navigation and action sections remain outside those scroll areas. MobileViewport updates the available height when the browser viewport or keyboard changes.

Layout changes cover the root layout/styles, authentication screens, onboarding carousel, booking steps, navigation, pickup details and modal containers. Existing API and business logic are retained.

The latest location-screen changes are in LocationPermissionScreen.tsx and LocationPermissionScreen.module.css. They remove the local logo and service-area footer, reuse location-pickup.png as a full-width background, preserve its aspect ratio and complete vehicle, blend its top into the cream surface, and retain the two text-only actions. No backend changes were required.

Headless Chrome fixture checks covered 168 screen/state/viewport combinations plus 68 populated-flow and assembled-navigation combinations at 375x667, 390x844, 430x932 and 1440x900. Fixtures exercise real components with mocked data; they do not establish live backend integration or real-device keyboard behavior. Temporary fixture routes were removed before the production build and Android asset synchronization.

Final location checks at all four sizes confirm no document overflow, a maximum 430px app width, loaded artwork, removed logo/footer, and both buttons within the viewport without icons. Manual entry opens the existing selection sheet. Denied GPS opens that sheet with an explanation and resets the loading button. No browser runtime exceptions were recorded. Reports and screenshots are in the workspace .design-qa directory.

The production build includes TypeScript checking. Targeted ESLint checks cover the location component, viewport component and root layout. Native permission prompts, actual GPS accuracy, hardware keyboard behavior and device-specific safe areas still require a physical phone.
