"use client";

import type { Ref } from "react";
import { SectionLink, SITE_GROUPS } from "./SiteNav";

/** The site's sections on phones. A native modal dialog provides the focus trap, Esc to close, and the backdrop. */
export function PartyDrawer({ ref }: { ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-paper text-ink shadow-xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">Menu</h2>
          <form method="dialog">
            <button type="submit" aria-label="Fechar menu" className="flex size-10 items-center justify-center rounded hover:bg-surface">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>
        </div>
        <nav aria-label="Secções" className="no-scrollbar flex-1 overflow-y-auto p-2">
          {SITE_GROUPS.map((group) => (
            <div key={group.title} className="pb-2">
              <p aria-hidden="true" className="px-3 pb-1 pt-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
                {group.title}
              </p>
              <ul aria-label={group.title} className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <SectionLink item={item} compact onNavigate={(event) => event.currentTarget.closest("dialog")?.close()} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </dialog>
  );
}
