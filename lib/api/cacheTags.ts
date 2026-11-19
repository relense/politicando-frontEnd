/**
 * What the backend says changed after each job (POST /api/revalidate, app/api/revalidate/route.ts), and the cached API
 * requests each name covers, by the path's first part. request() tags every cached request with these, so one ping
 * drops every page's copy of that data. No imports: the route and the API client both use it.
 */
export const CACHE_TAGS = ["news", "podcast", "agenda", "blog", "parliament"] as const;
export type CacheTag = (typeof CACHE_TAGS)[number];

const BY_FIRST_PART: Record<string, CacheTag> = {
  stories: "news",
  today: "news",
  articles: "news",
  sitemap: "news",
  podcast: "podcast",
  agenda: "agenda",
  editorial: "blog",
  parliament: "parliament",
  deputies: "parliament",
  initiatives: "parliament",
  parties: "parliament",
  legislatures: "parliament",
};

export function tagsFor(path: string): CacheTag[] {
  const first = path.replace(/^\/+/, "").split(/[/?#]/)[0] ?? "";
  const tag = BY_FIRST_PART[first];
  return tag ? [tag] : [];
}

export const isCacheTag = (value: unknown): value is CacheTag =>
  typeof value === "string" && (CACHE_TAGS as readonly string[]).includes(value);
