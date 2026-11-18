/**
 * A deputy's photo, fetched from the Parliament once and then served from our cache.
 *
 * parlamento.pt serves ~0.5 MB PNGs slowly and with no cache lifetime; asked for many at once it often takes
 * longer than the 7 seconds the image optimiser waits. This route waits longer, asks for a few at a time, shrinks
 * each photo once and keeps the small copy in memory, so the optimiser (and the browser) get it straight from us.
 * Only numeric ids are accepted and the address is built here, so it can't be used to fetch anything else.
 */

const SOURCE = "https://app.parlamento.pt/webutils/getimage.aspx";
const WEEK = 604_800;
const MAX_PARALLEL = 2;
const TIMEOUT = 30_000;
/** The biggest any page shows a deputy (112 px, twice that on dense screens), rounded up to an optimiser width. */
const WIDTH = 256;
/** Small photos kept in memory: ~10 KB each, so every deputy fits in a few MB. */
const KEPT = 400;

let running = 0;
const queue: (() => void)[] = [];
/** One download per photo at a time, and at most a few photos at once, to be kind to parlamento.pt. */
const inFlight = new Map<string, Promise<Small | null>>();
/** The shrunk photos, oldest first; the oldest leave when it's full. */
const kept = new Map<string, Small>();

type Small = { body: Uint8Array; type: string };

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

/**
 * The image library (sharp, which Next installs for its image optimiser). Without it, photos are passed through as
 * they come. Its own cache is off and it works one thread at a time: the server has little memory.
 */
const loadSharp = (async () => {
  try {
    const sharp = (await import("sharp")).default;
    sharp.cache(false);
    sharp.concurrency(1);
    return sharp;
  } catch {
    return null;
  }
})();

/**
 * The Parliament's photo, shrunk once to a small WebP. Its originals are ~0.5 MB PNGs at 450×600; the Parliament page
 * asks for all 230 at once, and resizing those in parallel took the 512 MB server over its limit. Shrunk here, a
 * few at a time, the optimiser then only ever sees ~10 KB images.
 */
async function shrink(id: string): Promise<Small | null> {
  const response = await fetch(`${SOURCE}?id=${id}&type=deputado`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !type.startsWith("image/")) return null;
  const original = new Uint8Array(await response.arrayBuffer());
  const sharp = await loadSharp;
  if (!sharp) return { body: original, type };
  const body = await sharp(original).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return { body: new Uint8Array(body), type: "image/webp" };
}

function photo(id: string): Promise<Small | null> {
  const known = kept.get(id);
  if (known) return Promise.resolve(known);
  const existing = inFlight.get(id);
  if (existing) return existing;
  const promise = limited(() => shrink(id))
    .then((small) => {
      if (small) {
        kept.set(id, small);
        if (kept.size > KEPT) kept.delete(kept.keys().next().value!);
      }
      return small;
    })
    .finally(() => inFlight.delete(id));
  inFlight.set(id, promise);
  return promise;
}

export async function GET(_request: Request, ctx: RouteContext<"/fotos/deputados/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d{1,7}$/.test(id)) return new Response("Not found", { status: 404 });

  try {
    const small = await photo(id);
    if (!small) return new Response("Not found", { status: 404 });
    return new Response(small.body as BodyInit, {
      headers: { "Content-Type": small.type, "Cache-Control": `public, max-age=${WEEK}, stale-while-revalidate=${WEEK}` },
    });
  } catch {
    // A timeout or network error: the page shows the deputy's initials instead.
    return new Response("Unavailable", { status: 504, headers: { "Cache-Control": "no-store" } });
  }
}
