/**
 * A deputy's photo, fetched from the Parliament once and then served from our cache.
 *
 * parlamento.pt serves ~0.5 MB PNGs slowly and with no cache lifetime; asked for many at once it often takes
 * longer than the 7 seconds the image optimiser waits. This route waits longer, asks for a few at a time and
 * keeps each photo in Next's data cache, so the optimiser (and the browser) get it straight from us.
 * Only numeric ids are accepted and the address is built here, so it can't be used to fetch anything else.
 */

const SOURCE = "https://app.parlamento.pt/webutils/getimage.aspx";
const WEEK = 604_800;
const MAX_PARALLEL = 4;
const TIMEOUT = 30_000;

let running = 0;
const queue: (() => void)[] = [];
/** One download per photo at a time, and at most a few photos at once, to be kind to parlamento.pt. */
const inFlight = new Map<string, Promise<Response>>();

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => queue.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    queue.shift()?.();
  }
}

function download(id: string): Promise<Response> {
  const existing = inFlight.get(id);
  if (existing) return existing.then((response) => response.clone());
  const promise = limited(() =>
    fetch(`${SOURCE}?id=${id}&type=deputado`, { next: { revalidate: WEEK }, signal: AbortSignal.timeout(TIMEOUT) }),
  ).finally(() => inFlight.delete(id));
  inFlight.set(id, promise);
  return promise.then((response) => response.clone());
}

export async function GET(_request: Request, ctx: RouteContext<"/fotos/deputados/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d{1,7}$/.test(id)) return new Response("Not found", { status: 404 });

  try {
    const upstream = await download(id);
    const type = upstream.headers.get("content-type")?.toLowerCase() ?? "";
    if (!upstream.ok || !type.startsWith("image/")) return new Response("Not found", { status: 404 });
    return new Response(await upstream.arrayBuffer(), {
      headers: { "Content-Type": type, "Cache-Control": `public, max-age=${WEEK}, stale-while-revalidate=${WEEK}` },
    });
  } catch {
    // A timeout or network error: the page shows the deputy's initials instead.
    return new Response("Unavailable", { status: 504, headers: { "Cache-Control": "no-store" } });
  }
}
