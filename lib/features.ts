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
} as const;
