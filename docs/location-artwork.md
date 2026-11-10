# Location-access screen

Project asset: `public/onboarding/location-pickup.png`.

Created with the built-in imagegen tool. The user's attached location-screen image was used as a scene/style reference. The actual application logo, heading, description and location actions are live UI; they are not baked into the illustration.

## Final generation prompt

Use case: illustration-story. Create ONE production illustration asset for ASLI KAATA's customer location permission screen. The latest attached tall location screen image is a STYLE AND SCENE REFERENCE ONLY. Generate ONLY the illustrated scene, no UI or logo. Scene: a cheerful compact Indian three-wheeler scrap collection cargo auto, bright warm yellow cabin and dark forest green cargo bed, parked on a clean residential Indian neighborhood lane. Cargo contains neatly stacked old newspapers, cardboard boxes, metal household recyclables and a few small discarded appliances. Friendly cream-colored two-storey Indian homes with balconies and dark green windows behind, lush green trees and plants on both sides. A large simple golden-yellow map location pin floats above the truck, with a circular white cutout. Warm cream #FFFDF6 sky, soft morning sun. Style: polished hand-painted cartoon editorial illustration matching the reference and the earlier onboarding artwork: clean contours, softly shaded detailed objects, friendly trustworthy sustainable feel, forest green #1B5E3A, yellow #FFC615, warm ivory. Composition: portrait 4:5 illustration, whole vehicle fully visible in lower-middle foreground, floating map pin centered upper-middle, houses and trees framing both sides. The scene fills the image naturally edge-to-edge, cream sky near the top and a soft pale sand/cream ground at the bottom. No text, no titles, no words, no ASLI KAATA lettering, no logos, no buttons, no phone frame, no status bar, no UI, no watermark. This image will be placed under live headings and above live buttons; do not draw any of the reference screen's interface. High quality final asset.

## Behavior and verification

The existing location context, address completeness validation, manual selection sheet and completion callback are retained. A denied/unavailable GPS result opens manual selection with an explanation. Unexpected GPS errors also reset the loading state and offer manual entry.

TypeScript, component ESLint, production static build, Capacitor synchronization and debug APK generation passed. Headless Chrome checks passed at 320x640, 390x844 and 768x900: artwork loaded, no horizontal overflow, both actions visible, manual sheet opened, and denied geolocation opened the sheet with a hint and reset the loading button. Real-device geolocation accuracy and native permission prompts require a physical phone.
