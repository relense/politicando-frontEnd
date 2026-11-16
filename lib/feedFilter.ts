/**
 * The news filter: any number of parties and of outlets. In the address as `?partido=ps,psd&fonte=publico.pt,expresso.pt`
 * (one value, as in older links, still works), and saved as the reader's own feed in a cookie of the same shape.
 */
export type FeedFilter = { parties: string[]; sources: string[] };
/** Newest first, or the most commented of the last week (`?ordem=comentadas`). */
export type FeedSort = "recentes" | "comentadas";
export const sortOf = (value: string | string[] | undefined): FeedSort => (value === "comentadas" ? "comentadas" : "recentes");
/** How far back "Mais comentadas" looks, in hours. */
export const COMMENTED_HOURS = 24 * 7;

export const FEED_COOKIE = "feed";
/** A year; the reader can change or forget it at any time. */
export const FEED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const SLUG = /^[a-z0-9-]{1,40}$/;
const DOMAIN = /^[a-z0-9.-]{3,80}$/;
const MAX = 20;

function listOf(value: string | string[] | undefined | null, valid: RegExp): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return [
    ...new Set(
      raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => valid.test(item)),
    ),
  ].slice(0, MAX);
}

/** The filter from the address (or the cookie), keeping only well-formed values; unknown ones are dropped later. */
export function parseFilter(params: { partido?: string | string[] | null; fonte?: string | string[] | null }): FeedFilter {
  return { parties: listOf(params.partido, SLUG), sources: listOf(params.fonte, DOMAIN) };
}

export const isEmpty = (filter: FeedFilter) => filter.parties.length === 0 && filter.sources.length === 0;

export const sameFilter = (a: FeedFilter, b: FeedFilter) =>
  [...a.parties].sort().join() === [...b.parties].sort().join() && [...a.sources].sort().join() === [...b.sources].sort().join();

/** "partido=ps,psd&fonte=publico.pt", without the empty parts; commas stay readable. */
export function filterQuery(filter: FeedFilter, extra: Record<string, string> = {}): string {
  const parts = [
    filter.parties.length > 0 ? `partido=${filter.parties.map(encodeURIComponent).join(",")}` : null,
    filter.sources.length > 0 ? `fonte=${filter.sources.map(encodeURIComponent).join(",")}` : null,
    ...Object.entries(extra)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`),
  ].filter(Boolean);
  return parts.join("&");
}

/** The cookie's value: the same text as the address. */
export const serializeFilter = (filter: FeedFilter) => filterQuery(filter);

export function readSavedFilter(cookie: string | undefined): FeedFilter | null {
  if (!cookie) return null;
  const params = new URLSearchParams(cookie);
  const filter = parseFilter({ partido: params.get("partido"), fonte: params.get("fonte") });
  return isEmpty(filter) ? null : filter;
}

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
