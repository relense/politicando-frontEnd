"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { partyPath } from "@/lib/parties";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";

/** "" on the home feed, the party slug on a party page, null elsewhere. */
function useActiveSlug(): string | null {
  const pathname = usePathname();
  if (pathname === "/") return "";
  const match = pathname.match(/^\/partido\/([^/]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

const current = (active: boolean) => (active ? ("page" as const) : undefined);

/** Very wide screens: what the site is, and every party, in a column on the right as wide as the one on the left. */
export function PartySidebar({ parties }: { parties: Party[] }) {
  const active = useActiveSlug();
  // The Parliament page needs the full width for the chamber.
  if (usePathname() === "/parlamento") return null;

  return (
    <aside className="hidden w-[var(--side-column)] shrink-0 self-start 2xl:block">
      <div className="mb-8 rounded-xl border border-line p-4">
        <p className="italic leading-relaxed">As notícias sobre os partidos políticos portugueses, num só lugar. Lê, compara e comenta.</p>
      </div>
      <nav aria-label="Partidos">
        <h2 className="mb-2 border-b-2 border-ink pb-2 font-mono text-xs font-bold uppercase tracking-widest">
          Partidos <span className="font-normal normal-case tracking-normal text-muted">· ordem alfabética</span>
        </h2>
        <ul className="flex flex-col">
          {parties.map((party) => (
            <li key={party.slug}>
              <Link
                href={partyPath(party.slug)}
                aria-current={current(active === party.slug)}
                title={party.name}
                className={`flex items-center gap-2.5 rounded px-1.5 py-1.5 hover:bg-surface ${
                  active === party.slug ? "bg-surface shadow-[inset_3px_0_0_var(--ink)]" : ""
                }`}
              >
                <PartyLogo slug={party.slug} acronym={party.acronym} size={24} />
                {/* One line each; the column is sized for the longest name, so nothing wraps. */}
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block whitespace-nowrap font-mono text-xs font-bold">{party.acronym}</span>
                  <span className="block whitespace-nowrap text-xs text-muted">{party.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/** Below wide screens: a row of chips that scrolls sideways, above the feed. */
export function PartyChipBar({ parties }: { parties: Party[] }) {
  const active = useActiveSlug();
  const listRef = useRef<HTMLUListElement>(null);

  // Bring the selected party into view without scrolling the page itself.
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !selected) return;
    list.scrollLeft = selected.offsetLeft - list.clientWidth / 2 + selected.clientWidth / 2;
  }, [active]);

  if (parties.length === 0) return null;
  const chip = (isActive: boolean) =>
    `flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-mono text-xs font-bold ${
      isActive ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
    }`;

  return (
    <nav aria-label="Partidos" className="-mx-4 mb-6 2xl:hidden">
      <ul ref={listRef} className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <li className="shrink-0">
          <Link href="/" aria-current={current(active === "")} className={chip(active === "")}>
            Todas
          </Link>
        </li>
        {parties.map((party) => (
          <li key={party.slug} className="shrink-0">
            <Link
              href={partyPath(party.slug)}
              aria-current={current(active === party.slug)}
              className={`${chip(active === party.slug)} pl-1.5`}
            >
              <PartyLogo slug={party.slug} acronym={party.acronym} size={22} />
              {party.acronym}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
