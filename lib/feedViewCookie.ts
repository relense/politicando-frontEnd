/**
 * How the front page shows the news: big cards, or a compact list (headline, a line of text, a small photo). Kept in
 * a cookie, so the server draws the reader's choice from the first paint. The hook is in lib/feedView.ts (browser).
 */
export type FeedView = "cartoes" | "lista";
export const FEED_VIEW_COOKIE = "feed-view";
export const parseFeedView = (value: string | undefined | null): FeedView => (value === "lista" ? "lista" : "cartoes");
