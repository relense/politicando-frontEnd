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

/** Desktop: a sticky list beside the content. */
export function PartySidebar({ parties }: { parties: Party[] }) {
  const active = useActiveSlug();
  const item = (isActive: boolean) =>
    `flex items-center gap-3 rounded px-2 py-1.5 hover:bg-surface ${isActive ? "bg-surface shadow-[inset_3px_0_0_var(--ink)]" : ""}`;

  return (
    <nav
      aria-label="Partidos"
      className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-52 shrink-0 self-start overflow-y-auto lg:block"
    >
      <h2 className="mb-2 px-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">Partidos</h2>
      <ul className="flex flex-col gap-0.5">
        <li>
          <Link href="/" aria-current={current(active === "")} className={item(active === "")}>
            <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs font-bold text-muted">
              ∗
            </span>
            <span className="font-mono text-sm font-bold">Todas as notícias</span>
          </Link>
        </li>
        {parties.map((party) => (
          <li key={party.slug}>
            <Link href={partyPath(party.slug)} aria-current={current(active === party.slug)} className={item(active === party.slug)}>
              <PartyLogo slug={party.slug} acronym={party.acronym} size={28} />
              <span className="min-w-0">
                <span className="block font-mono text-sm font-bold">{party.acronym}</span>
                <span className="block truncate text-xs text-muted">{party.name}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Mobile and tablet: a row of chips that scrolls sideways, above the feed. */
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
    <nav aria-label="Partidos" className="-mx-4 mb-6 lg:hidden">
      <ul ref={listRef} className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <li className="shrink-0">
          <Link href="/" aria-current={current(active === "")} className={chip(active === "")}>
            Todas
          </Link>
        </li>
        {parties.map((party) => (
          <li key={party.slug} className="shrink-0">
            <Link href={partyPath(party.slug)} aria-current={current(active === party.slug)} className={`${chip(active === party.slug)} pl-1.5`}>
              <PartyLogo slug={party.slug} acronym={party.acronym} size={22} />
              {party.acronym}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
