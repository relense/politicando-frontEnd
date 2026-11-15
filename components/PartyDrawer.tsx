"use client";

import Link from "next/link";
import type { Ref } from "react";
import { partyPath } from "@/lib/parties";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";
import { PartyOrderToggle, useOrderedParties } from "./PartyOrder";
import { SectionLink, SITE_SECTIONS } from "./SiteNav";

/** A native modal dialog provides the focus trap, Esc to close, and the backdrop. */
export function PartyDrawer({ parties, ref }: { parties: Party[]; ref: Ref<HTMLDialogElement> }) {
  const { ordered, standingOf } = useOrderedParties(parties);
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
        <nav aria-label="Secções" className="border-b border-line p-2">
          <ul>
            {SITE_SECTIONS.map((item) => (
              <li key={item.label}>
                <SectionLink item={item} onNavigate={(event) => event.currentTarget.closest("dialog")?.close()} />
              </li>
            ))}
          </ul>
        </nav>
        {parties.length === 0 ? (
          <p className="p-4 text-muted">Não foi possível carregar os partidos.</p>
        ) : (
          <ul aria-label="Partidos" className="no-scrollbar flex-1 overflow-y-auto p-2">
            <li className="flex items-center justify-between gap-2 px-2 pb-1 pt-2">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Partidos</span>
              <PartyOrderToggle />
            </li>
            {ordered.map((party) => (
              <li key={party.slug}>
                <Link
                  href={partyPath(party.slug)}
                  onClick={(event) => event.currentTarget.closest("dialog")?.close()}
                  className="flex items-center gap-3 rounded p-2 hover:bg-surface"
                >
                  <PartyLogo slug={party.slug} acronym={party.acronym} size={32} />
                  <span>
                    <span className="block font-mono text-sm font-bold">{party.acronym}</span>
                    <span className="block text-sm text-muted">{party.name}</span>
                    {standingOf(party.slug) && <span className="block font-mono text-xs text-muted">{standingOf(party.slug)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
