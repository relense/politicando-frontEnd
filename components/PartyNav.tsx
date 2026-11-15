"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";
import { PartyOrderToggle, useOrderedParties } from "./PartyOrder";

const current = (active: boolean) => (active ? ("page" as const) : undefined);

/**
 * A row of party chips that scrolls sideways, above the feed, to filter the news by party without leaving the page
 * (`/?partido=ps`). The party's own page is reached from the parties page or the party on each article.
 * `active`: the chosen party's slug, or null for all.
 */
export function PartyChipBar({ parties, active }: { parties: Party[]; active: string | null }) {
  const { ordered, standingOf } = useOrderedParties(parties);
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  // Bring the selected party into view without scrolling the page itself.
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !selected) return;
    // Measured against the list itself (offsetLeft would be against the page), and centred when it can be.
    const listBox = list.getBoundingClientRect();
    const box = selected.getBoundingClientRect();
    const target = list.scrollLeft + (box.left - listBox.left) - (listBox.width - box.width) / 2;
    list.scrollTo?.({ left: Math.max(0, target), behavior: "smooth" });
  }, [active, ordered]);

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
    <nav aria-label="Filtrar por partido" className="-mx-4 mb-6 lg:mx-0">
      <PartyOrderToggle className="mb-2 px-4 lg:px-0" />
      <div className="flex items-center gap-2">
        {arrow(-1)}
        <ul ref={listRef} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 lg:px-0">
          <li className="shrink-0">
            <Link href="/" scroll={false} aria-current={current(active === null)} className={chip(active === null)}>
              Todas
            </Link>
          </li>
          {ordered.map((party) => (
            <li key={party.slug} className="shrink-0">
              <Link
                href={`/?partido=${encodeURIComponent(party.slug)}`}
                scroll={false}
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
        {arrow(1)}
      </div>
    </nav>
  );
}
