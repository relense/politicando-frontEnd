import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The team's moderation area and the proxy to the API are not for search engines.
const disallow = ["/admin", "/api/"];

/**
 * Crawlers that honour Crawl-delay (Google ignores it, and is unaffected): one page every few seconds, so a crawl of
 * thousands of pages doesn't hit the server all at once and run it out of memory. A crawler follows only the most
 * specific group that names it, so these repeat the disallowed paths.
 */
const SLOWED = ["bingbot", "msnbot", "Yandex", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "PetalBot"];
const CRAWL_DELAY_SECONDS = 5;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: SLOWED, allow: "/", disallow, crawlDelay: CRAWL_DELAY_SECONDS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
