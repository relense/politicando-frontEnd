import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Deputy photos come from our own route, which fetches each one from the Parliament once and caches it
    // (see app/fotos/deputados/[id]/route.ts). The optimiser then resizes them to a few KB for the browser.
    localPatterns: [
      { pathname: "/fotos/deputados/**", search: "" },
      { pathname: "/parties/**", search: "" },
    ],
    // Photos rarely change; a week keeps them fresh enough. There is no purge, so this stays modest.
    minimumCacheTTL: 604_800,
  },
};

export default nextConfig;
