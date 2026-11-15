/** The page this tab was on before the current one, when both are pages of this site. */
let previousPath: string | null = null;

export const recordNavigation = (from: string) => {
  previousPath = from;
};

/** True when the previous page was a news list, so going back returns to it at the same scroll position. */
export const cameFromFeed = () =>
  previousPath !== null && (previousPath === "/" || previousPath.startsWith("/partido/"));
