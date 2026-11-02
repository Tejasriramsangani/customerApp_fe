import type { NextConfig } from "next";

// `npm run build:app` sets CAPACITOR_BUILD to produce the static bundle (./out) that is packaged
// into the Android app. The normal web build/dev server is unchanged.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild ? { output: "export" as const, images: { unoptimized: true } } : {}),
};

export default nextConfig;
