/**
 * "Há notícias novas" (components/NewNews.tsx): whether a fresh first page of the feed has something newer than what the
 * reader already has. By date, so a story that got a new article counts too.
 */
type Page = { articles: { publishedAt: string | null }[] } | { stories: { lastPublishedAt: string }[] };

const datesOf = (page: Page) =>
  ("stories" in page ? page.stories.map((story) => story.lastPublishedAt) : page.articles.map((article) => article.publishedAt))
    .map((date) => (date ? Date.parse(date) : NaN))
    .filter((time) => Number.isFinite(time));

/** The newest date across the pages, or null when there is none. */
export function newestOf(pages: Page[]): number | null {
  const times = pages.flatMap(datesOf);
  return times.length > 0 ? Math.max(...times) : null;
}

export function hasNewer(current: Page[], fresh: Page): boolean {
  const newest = newestOf([fresh]);
  if (newest === null) return false;
  const have = newestOf(current);
  // An empty feed has nothing to compare with: it never offers new news.
  return have !== null && newest > have;
}

type Item = { parties?: { slug: string }[]; sourceDomain?: string; versions?: { sourceDomain: string }[] };

/**
 * Whether every item of a fresh page belongs to the feed the reader is on: one of its parties, from one of its outlets.
 * A safety net: a page that doesn't fit is never offered, so pressing «Há notícias novas» can't swap a party's feed
 * for everyone's (seen on 19 Nov on a phone, on PPM's news).
 */
export function fitsFeed(page: { articles: Item[] } | { stories: Item[] }, feed: { parties: string[]; sources: string[] }): boolean {
  const items: Item[] = "stories" in page ? page.stories : page.articles;
  return items.every((item) => {
    const parties = (item.parties ?? []).map((party) => party.slug);
    const domains = item.versions ? item.versions.map((version) => version.sourceDomain) : item.sourceDomain ? [item.sourceDomain] : [];
    return (
      (feed.parties.length === 0 || parties.some((slug) => feed.parties.includes(slug))) &&
      (feed.sources.length === 0 || domains.some((domain) => feed.sources.includes(domain)))
    );
  });
}
