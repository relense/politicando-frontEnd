"use client";

import type { ReactNode } from "react";

/**
 * A link to a section of this page that scrolls there without adding a history entry: Next's router does not know
 * entries made by plain hash links, so Back from another page would change the address and leave that page on screen.
 */
export function JumpLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(to);
        if (!target) return;
        event.preventDefault();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}
