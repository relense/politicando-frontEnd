"use client";

import { useEffect, useRef, useState } from "react";
import { hasNewer } from "@/lib/feedFreshness";
import type { ArticlePage } from "@/lib/types";
import type { StoryPage } from "@/lib/api/stories";

type Page = ArticlePage | StoryPage;

/** How often an open feed looks for news, and the least time between two looks when the tab comes back. */
export const CHECK_EVERY_MS = 5 * 60_000;
const AGAIN_AFTER_MS = 60_000;

/**
 * "Há notícias novas": while the feed is open, it quietly asks for its first page every few minutes and when the tab
 * comes back. With something newer than what the reader has, a button at the top offers it; nothing moves until they
 * press it. Not on the first load (the page is fresh then) and not while the tab is hidden.
 */
export function NewNews({
  enabled,
  pages,
  loadFresh,
  onShow,
}: {
  enabled: boolean;
  pages: Page[];
  loadFresh: () => Promise<Page>;
  onShow: (fresh: Page) => void;
}) {
  const [fresh, setFresh] = useState<Page | null>(null);
  // The latest values, read by the timer without restarting it.
  const latest = useRef({ pages, loadFresh });
  useEffect(() => {
    latest.current = { pages, loadFresh };
  });

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let live = true;
    const check = () => {
      if (document.hidden) return;
      last = Date.now();
      latest.current
        .loadFresh()
        .then((page) => {
          if (live && hasNewer(latest.current.pages, page)) setFresh(page);
        })
        .catch(() => {
          // The API is down or slow: the reader keeps what they have; the next look tries again.
        });
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const back = () => {
      if (!document.hidden && Date.now() - last >= AGAIN_AFTER_MS) check();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [enabled]);

  return (
    <div aria-live="polite" className="pointer-events-none sticky top-20 z-20 -mb-11 flex h-11 justify-center">
      {fresh && enabled && (
        <button
          type="button"
          onClick={() => {
            onShow(fresh);
            setFresh(null);
          }}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 font-mono text-sm font-bold text-paper shadow-lg hover:opacity-90"
        >
          <span aria-hidden="true">↑</span> Há notícias novas
        </button>
      )}
    </div>
  );
}
