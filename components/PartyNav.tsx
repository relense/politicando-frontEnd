"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { partyPath } from "@/lib/parties";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";
import { PartyOrderToggle, useOrderedParties } from "./PartyOrder";

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

/** On the news pages, from laptop width: what the site is, and every party, in a column on the right as wide as the one on the left. */
export function PartySidebar({ parties }: { parties: Party[] }) {
  const active = useActiveSlug();
  const { ordered, order, standingOf } = useOrderedParties(parties);
  // Only beside the news: the feed, the party feeds and the articles. The other pages use the width themselves.
  const pathname = usePathname();
  if (!(pathname === "/" || pathname.startsWith("/partido/") || pathname.startsWith("/article/"))) return null;

  return (
    <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto lg:block 2xl:w-[var(--side-column)]">
      <div className="mb-8 rounded-xl border border-line p-4">
        <p className="text-sm italic leading-relaxed 2xl:text-base">
          As notícias sobre os partidos políticos portugueses, num só lugar. Lê, compara e comenta.
        </p>
      </div>
      <nav aria-label="Partidos">
        <div className="mb-2 flex items-center justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest">Partidos</h2>
          <PartyOrderToggle />
        </div>
        <ul className="flex flex-col">
          {ordered.map((party) => (
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
                {/* One line each. On very wide screens the column fits the longest name; narrower, long names end in "…" (the full name is the title). */}
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block whitespace-nowrap font-mono text-xs font-bold">{party.acronym}</span>
                  <span className="block truncate text-xs text-muted">{party.name}</span>
                  {order === "votes" && standingOf(party.slug) && (
                    <span className="block whitespace-nowrap font-mono text-[0.6875rem] text-muted">{standingOf(party.slug)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/** Phones and tablets, where there is no party column: a row of chips that scrolls sideways, above the feed. */
export function PartyChipBar({ parties }: { parties: Party[] }) {
  const active = useActiveSlug();
  const { ordered, standingOf } = useOrderedParties(parties);
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
    <nav aria-label="Partidos" className="-mx-4 mb-6 lg:hidden">
      <PartyOrderToggle className="mb-2 px-4" />
      <ul ref={listRef} className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <li className="shrink-0">
          <Link href="/" aria-current={current(active === "")} className={chip(active === "")}>
            Todas
          </Link>
        </li>
        {ordered.map((party) => (
          <li key={party.slug} className="shrink-0">
            <Link
              href={partyPath(party.slug)}
              aria-current={current(active === party.slug)}
              title={standingOf(party.slug) ?? undefined}
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
