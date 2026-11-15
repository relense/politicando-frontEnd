"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  // Party pages have their own row of parties at the top instead.
  if (!(pathname === "/" || pathname.startsWith("/article/"))) return null;

  return (
    <aside
      className={`sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto lg:block 2xl:w-[var(--side-column)] ${NO_SCROLLBAR}`}
    >
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

/** Hides a scrollbar in every browser while keeping the row scrollable by touch, wheel and keyboard. */
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * A row of party chips that scrolls sideways. Above the feed on phones and tablets, where there is no party column;
 * on party pages at every width (`always`), with arrows on larger screens.
 */
export function PartyChipBar({ parties, always = false }: { parties: Party[]; always?: boolean }) {
  const active = useActiveSlug();
  const { ordered, standingOf } = useOrderedParties(parties);
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  // Bring the selected party into view without scrolling the page itself.
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !selected) return;
    list.scrollLeft = selected.offsetLeft - list.clientWidth / 2 + selected.clientWidth / 2;
  }, [active]);

  // Whether there is more to either side, for the arrows.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => setEdges({ start: list.scrollLeft <= 1, end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1 });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);

  if (parties.length === 0) return null;
  const chip = (isActive: boolean) =>
    `flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-mono text-xs font-bold ${
      isActive ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
    }`;
  const scrollBy = (direction: 1 | -1) => {
    const list = listRef.current;
    list?.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: "smooth" });
  };
  const arrow = (direction: 1 | -1) => (
    <button
      type="button"
      onClick={() => scrollBy(direction)}
      disabled={direction === -1 ? edges.start : edges.end}
      aria-label={direction === -1 ? "Partidos anteriores" : "Mais partidos"}
      className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-line hover:bg-surface disabled:opacity-30 lg:flex"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2">
        <path d={direction === -1 ? "M12 5l-5 5 5 5" : "M8 5l5 5-5 5"} />
      </svg>
    </button>
  );

  return (
    <nav aria-label="Partidos" className={`-mx-4 mb-6 ${always ? "lg:mx-0" : "lg:hidden"}`}>
      <PartyOrderToggle className={`mb-2 px-4 ${always ? "lg:px-0" : ""}`} />
      <div className="flex items-center gap-2">
        {always && arrow(-1)}
        <ul ref={listRef} className={`flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 ${always ? "lg:px-0" : ""} ${NO_SCROLLBAR}`}>
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
        {always && arrow(1)}
      </div>
    </nav>
  );
}
