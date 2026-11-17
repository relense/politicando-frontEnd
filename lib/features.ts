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
   * The cookie banner, with the choice of "everything" or "only the essential". Off for now: the site stores only
   * preferences, counts visits without cookies, and loads others' scripts only when asked (players on a click,
   * reCAPTCHA when the reader starts to post). On, the captcha also waits for the reader's yes.
   */
  cookieBanner: false,
  /**
   * "Mais votadas" and "Polémicas" in the feed's order, and the news period (hoje, ontem, 7 or 30 dias) for every
   * ranked order. Needs the API with votes (`sort=top|controversial`, `period=`): deploy that first.
   */
  newsVotes: true,
  /** "Mais lidas" in the feed's order, once the API sorts articles by reads (`sort=views`). */
  newsReadsSort: false,
  /** "Em alta" in the feed's order, once the API has `sort=trending` (backend branch article-actions). */
  newsTrending: false,
  /**
   * The feed as stories (one card per news, "7 jornais contaram isto", "Importa", "Hoje em 5") and the article page with
   * every outlet's version. Needs the API's /stories (backend branch article-actions): deploy that first.
   */
  // Off until the API with /stories is in production. To try it locally: NEXT_PUBLIC_FEATURE_STORIES=1 in .env.local.
  stories: process.env.NEXT_PUBLIC_FEATURE_STORIES === "1",
} as const;
