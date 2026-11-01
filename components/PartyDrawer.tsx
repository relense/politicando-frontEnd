"use client";

import Link from "next/link";
import type { Ref } from "react";
import { partyPath } from "@/lib/parties";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";

/** A native modal dialog provides the focus trap, Esc to close, and the backdrop. */
export function PartyDrawer({ parties, ref }: { parties: Party[]; ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog
      ref={ref}
      aria-label="Partidos"
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-paper text-ink shadow-xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">Partidos</h2>
          <form method="dialog">
            <button type="submit" aria-label="Fechar lista de partidos" className="flex size-10 items-center justify-center rounded hover:bg-surface">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>
        </div>
        {parties.length === 0 ? (
          <p className="p-4 text-muted">Não foi possível carregar os partidos.</p>
        ) : (
          <ul className="flex-1 overflow-y-auto p-2">
            {parties.map((party) => (
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
