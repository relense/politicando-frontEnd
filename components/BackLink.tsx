"use client";

import Link from "next/link";
import { cameFromFeed } from "@/lib/navigationHistory";

/**
 * "← Últimas notícias". Coming from a news list it goes back, so the list keeps its scroll position;
 * otherwise it opens the home page.
 */
export function BackLink() {
  return (
    <Link
      href="/"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (cameFromFeed()) {
          event.preventDefault();
          window.history.back();
        }
      }}
      className="inline-flex items-center gap-1.5 font-mono text-sm text-muted hover:text-ink hover:underline"
    >
      <span aria-hidden="true">←</span> Últimas notícias
    </Link>
  );
}
