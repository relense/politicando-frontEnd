"use client";

import { useState, type ReactNode } from "react";

/**
 * On a phone, a round search button that opens the box below the other controls; from `sm` up the box is always there.
 * Open from the start when there are words searched, so they stay visible.
 */
export function SearchToggle({ label, open: startOpen, children }: { label: string; open: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Fechar a pesquisa" : label}
        onClick={() => setOpen(!open)}
        className={`flex size-10 shrink-0 items-center justify-center rounded-full border sm:hidden ${open ? "border-ink" : "border-line"}`}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`order-last basis-full sm:order-none sm:flex-[1_1_18rem] sm:basis-auto ${open ? "" : "max-sm:hidden"}`}>
        {children}
      </div>
    </>
  );
}
