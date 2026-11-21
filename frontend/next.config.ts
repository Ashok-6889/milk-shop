import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["54.224.165.98"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
