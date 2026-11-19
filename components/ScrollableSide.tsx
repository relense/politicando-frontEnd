"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const LEARNED = "politicando:lado-rolado";

function learned(): boolean {
  try {
    return window.localStorage.getItem(LEARNED) === "1";
  } catch {
    return false;
  }
}

/**
 * The right column, scrolling on its own. Until the reader first scrolls it, a small chevron at its foot says there's
 * more below; once they have, it never shows again (remembered in this browser).
 */
export function ScrollableSide({ className, children }: { className: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element || learned()) return;
    const check = () => setHint(element.scrollHeight - element.clientHeight > 24 && element.scrollTop < 8);
    const onScroll = () => {
      if (element.scrollTop < 8) return;
      try {
        window.localStorage.setItem(LEARNED, "1");
      } catch {
        // Private windows may refuse: gone for this visit only.
      }
      setHint(false);
      element.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={box} className={className}>
      {children}
      {hint && (
        <div
          aria-hidden="true"
          data-scroll-hint
          className="pointer-events-none sticky bottom-0 -mt-12 flex h-12 shrink-0 items-end justify-center bg-gradient-to-t from-paper to-transparent pb-1"
        >
          <span className="flex size-7 animate-bounce items-center justify-center rounded-full border border-line bg-paper text-muted shadow-sm">
            <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}
