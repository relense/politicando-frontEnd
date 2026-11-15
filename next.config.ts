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
    // Government photos come from the Government portal's CDN, which is fast; the optimiser resizes them there.
    // Only its media folder is allowed. Its query (?h=…&w=…) varies per photo.
    remotePatterns: [
      { protocol: "https", hostname: "edge.sitecorecloud.io", pathname: "/centrodeges65c9-cegere0de-prod6279-8af9/media/**" },
      // The President's official photo, from the Presidency's site.
      { protocol: "https", hostname: "www.presidencia.pt", pathname: "/media/**" },
    ],
    // Photos rarely change; a week keeps them fresh enough. There is no purge, so this stays modest.
    minimumCacheTTL: 604_800,
  },
};

export default nextConfig;
