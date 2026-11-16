"use client";

import { useEffect } from "react";

/**
 * Opens a page at the top. Next keeps the scroll position when the new page's first element is already on screen,
 * so a person reached from far down another page would open halfway. A link to a spot (#votacoes) still goes there.
 */
export function ScrollToTop({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [id]);
  return null;
}
