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
  return have === null || newest > have;
}
