import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

/**
 * What the site's server adds to its requests to the API (docs/rate-limits.md in the backend):
 * - the shared key, so the API knows the request comes from this site's server;
 * - on uncached requests only, the reader's IP, so each reader gets their own rate limit instead of all sharing the server's.
 * Cached requests carry no IP: Next's cache keys on the headers, so one would split the shared cache per reader.
 * Server only: package.json "imports" gives the browser an empty stand-in, so the key never reaches it.
 */
export async function serverHeaders(cachedRequest: boolean): Promise<Record<string, string>> {
  const secret = process.env.FRONTEND_API_KEY;
  if (!secret) return {};
  const key = { "X-Frontend-Key": secret };
  if (cachedRequest) return key;
  try {
    // Set by Cloudflare in front of Render; readers can't forge it, unlike x-forwarded-for.
    const ip = (await headers()).get("true-client-ip");
    return ip ? { ...key, "X-Reader-IP": ip } : key;
  } catch (error) {
    // Next's own signals (a page that turns dynamic) must pass; outside a request (a build), the key alone.
    unstable_rethrow(error);
    return key;
  }
}
