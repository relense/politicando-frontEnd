import type { NextConfig } from "next";
import { PODCAST_COVER_HOSTS } from "./lib/podcastCovers";
import { umamiHost } from "./lib/umami";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The deputies have no list page of their own: the Parliament's hemicycle, with its search, is that list.
  // The query (?partido=, ?deputado=) is passed through, and the Parliament page reads both.
  async redirects() {
    return [{ source: "/deputados", destination: "/parlamento", permanent: true }];
  },
  // Umami's script from our own address, so ad blockers don't drop it (lib/umami.ts). Its events come back through
  // app/stats/api/send/route.ts, which adds the reader's IP and browser: a plain rewrite might not pass them on.
  async rewrites() {
    return [{ source: "/stats/script.js", destination: `${umamiHost()}/script.js` }];
  },
  // Map outlines: each URL carries a version (?v=, lib/maps.ts), so the browser can keep it for good.
  async headers() {
    return [{ source: "/mapas/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
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
      // The podcast's covers (lib/podcastCovers.ts): through the optimiser, so readers never contact these hosts.
      ...PODCAST_COVER_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
    ],
    // Photos rarely change; a week keeps them fresh enough. There is no purge, so this stays modest.
    minimumCacheTTL: 604_800,
  },
};

export default nextConfig;
