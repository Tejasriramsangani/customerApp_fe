import type { NextConfig } from "next";

// `npm run build:app` sets CAPACITOR_BUILD to produce the static bundle (./out) that is packaged
// into the Android app. The normal web build/dev server is unchanged.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'development' && process.env.ASLIKAATA_LOCAL_UI_PREVIEW_RUNTIME === '1'
    ? { distDir: '.next-ui-preview' } : {}),
  ...(isCapacitorBuild
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        // Required for Capacitor static export — no server-side features
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
