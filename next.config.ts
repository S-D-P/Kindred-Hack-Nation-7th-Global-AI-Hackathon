import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep demo recordings and screenshots clean; build and runtime errors still surface.
  devIndicators: false,
  // This app lives inside a parent folder that has its own lockfile.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
