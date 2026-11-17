/**
 * The news cards' look, shared by the story card and the article card: the designer's spec (values only; colours are
 * the tokens in app/globals.css: --card, --inset, --card-line…). The fonts stay the site's.
 *
 * Card: 18px/20px padding, 16px radius, 1px border, 14px between cards; hover: stronger border and background. Below
 * `sm` the card runs edge to edge with no side borders and 16px padding.
 */
export const cardBox =
  "group relative rounded-2xl border border-[var(--card-line)] bg-[var(--card)] px-5 py-[18px] transition-colors hover:border-[var(--card-line-strong)] hover:bg-[var(--card-bg-hover)] focus-within:border-[var(--card-line-strong)] max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0 max-sm:px-4";

/** Header row: badge, meta (12.5px, secondary; the outlet's name in the main colour). */
export const cardMeta = "relative z-10 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[12.5px] text-muted";

/** Title: 26px (20px on a phone), 600, 1.2, 12px under the header; underlined on hover. */
export const cardTitle = "mt-3 text-xl font-semibold leading-[1.2] sm:text-[26px]";
export const cardTitleLink = "after:absolute after:inset-0 after:rounded-2xl group-hover:underline decoration-1 underline-offset-4";

/** Excerpt: 17px, 1.5, in the excerpt colour, 8px under the title. */
export const cardExcerpt = "mt-2 line-clamp-3 text-base leading-normal text-[var(--text-excerpt)] sm:line-clamp-none sm:text-[17px]";

/** Image: 300px tall (190px on a phone), 12px radius, cover, 14px below. */
export const cardImage = "relative z-10 mt-3.5 block h-[190px] overflow-hidden rounded-xl bg-[var(--inset)] sm:h-[300px]";

/** Action bar: 14px above, 8px gaps; 38px pills on the button colour, 12.5px, 500, 7px between icon and text. */
export const cardActions = "relative z-10 mt-3.5 flex flex-wrap items-center gap-2";
export const cardAction =
  "inline-flex h-[38px] items-center gap-[7px] rounded-full bg-[var(--button)] px-3.5 font-mono text-[12.5px] font-medium hover:bg-[var(--button-hover)] [&_svg]:size-4";
/** "Ler no [jornal] ↗": pushed right, 12px, secondary; hidden on a phone. */
export const cardReadOn = "ml-auto hidden font-mono text-xs text-muted underline underline-offset-4 hover:text-ink sm:inline";
