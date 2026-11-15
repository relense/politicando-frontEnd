/**
 * Pages that are built but switched off for now. Off, they answer 404 (or redirect) and are left out of the menu
 * and the sitemap; turning one back on is changing its flag here.
 */
export const FEATURES = {
  /** The corruption record (`/registo`) and declared interests (`/interesses`), and the record box on people's pages. */
  record: false,
  /** `/como-ser-deputado`, now a blog post (see lib/localPosts.ts): while off it redirects there. */
  becomeDeputyPage: false,
  /**
   * The search box and the newest/oldest order on `/iniciativas`. Off until the API filters by `q` and `sort`, or the
   * box would show unfiltered results; the tests build with it on.
   */
  initiativeSearch: process.env.NEXT_PUBLIC_INITIATIVE_SEARCH === "on",
} as const;
