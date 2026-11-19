/**
 * Umami Cloud, the site's statistics: no cookies, no IP stored, only totals and named events. Readers' browsers send to
 * our own /stats (app/stats/api/send/route.ts, and a rewrite for the script in next.config.ts) so ad blockers don't
 * drop it, and we forward to Umami. Umami still needs the reader's IP to tell their country (it doesn't keep it) and
 * their browser, so both are passed on: without them everyone would look like our server.
 */

/** Where Umami lives: cloud.umami.is unless UMAMI_HOST names the region the site was created in. */
export const umamiHost = () => (process.env.UMAMI_HOST || "https://cloud.umami.is").replace(/\/+$/, "");

/** The reader's IP: Cloudflare's, which readers can't forge (Render sits behind Cloudflare), else the forwarded chain's first. */
export function readerIp(headers: Headers): string | null {
  const ip = headers.get("true-client-ip") ?? headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  return ip?.trim() || null;
}

// What Umami reads: the event, the browser (for browser, OS and device) and its own cache token. Never cookies.
const PASSED_IN = ["content-type", "user-agent", "accept-language", "x-umami-cache"];

/** An event from the reader's browser, on to Umami. Quiet when Umami can't be reached: the page never waits on it. */
export async function forwardToUmami(request: Request): Promise<Response> {
  const headers = new Headers();
  for (const name of PASSED_IN) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ip = readerIp(request.headers);
  if (ip) headers.set("x-forwarded-for", ip);
  try {
    const upstream = await fetch(`${umamiHost()}/api/send`, {
      method: "POST",
      headers,
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
