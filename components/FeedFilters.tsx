"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  FEED_COOKIE,
  FEED_COOKIE_MAX_AGE,
  filterQuery,
  isEmpty,
  sameFilter,
  serializeFilter,
  toggle,
  type FeedFilter,
} from "@/lib/feedFilter";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";
import { SourceLogo } from "./SourceLogo";
import { PartyOrderToggle, useOrderedParties } from "./PartyOrder";

type Props = {
  parties: Party[];
  sources: { domain: string; name: string }[];
  filter: FeedFilter;
  /** The reader's saved feed, if any; the front page opens with it. */
  saved: FeedFilter | null;
  /** Words being searched, kept while the filter changes. */
  q: string;
};

const chip = (pressed: boolean) =>
  `flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-mono text-xs font-bold ${
    pressed ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
  }`;

/** A row of chips that scrolls sideways, with arrows on wide screens. */
function ChipRow({ label, children, more }: { label: string; children: React.ReactNode; more: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
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
  const arrow = (direction: 1 | -1) => (
    <button
      type="button"
      onClick={() => listRef.current?.scrollBy({ left: direction * listRef.current.clientWidth * 0.8, behavior: "smooth" })}
      disabled={direction === -1 ? edges.start : edges.end}
      aria-label={direction === -1 ? `${more} anteriores` : `Mais ${more.toLowerCase()}`}
      className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-line hover:bg-surface disabled:opacity-30 lg:flex"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2">
        <path d={direction === -1 ? "M12 5l-5 5 5 5" : "M8 5l5 5-5 5"} />
      </svg>
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {arrow(-1)}
      <ul ref={listRef} aria-label={label} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {children}
      </ul>
      {arrow(1)}
    </div>
  );
}

/**
 * Filters the news by any number of parties and of outlets, in place. Each chip switches on or off; the choice can be
 * saved as the reader's own feed, which the front page then opens with (kept in a cookie, never sent anywhere else).
 */
export function FeedFilters({ parties, sources, filter, saved, q }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const { ordered, standingOf } = useOrderedParties(parties);
  const isSaved = saved !== null && sameFilter(filter, saved);

  const go = (next: FeedFilter) => {
    // With a saved feed, "everything" needs saying, or the front page would open the saved one again.
    const query = filterQuery(next, { q, ...(isEmpty(next) && saved ? { tudo: "1" } : {}) });
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const save = (value: FeedFilter | null) => {
    document.cookie = value
      ? `${FEED_COOKIE}=${encodeURIComponent(serializeFilter(value))}; Max-Age=${FEED_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
      : `${FEED_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    startTransition(() => router.refresh());
  };

  if (parties.length === 0 && sources.length === 0) return null;
  const partyNames = filter.parties.map((slug) => parties.find((party) => party.slug === slug)?.acronym ?? slug);
  const sourceNames = filter.sources.map((domain) => sources.find((item) => item.domain === domain)?.name ?? domain);

  return (
    <nav aria-label="Filtrar notícias" className="mb-6 rounded-2xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Partidos</h2>
        <PartyOrderToggle />
      </div>
      <ChipRow label="Partidos" more="Partidos">
        <li className="shrink-0">
          <button
            type="button"
            aria-pressed={filter.parties.length === 0}
            onClick={() => go({ ...filter, parties: [] })}
            className={chip(filter.parties.length === 0)}
          >
            Todos
          </button>
        </li>
        {ordered.map((party) => {
          const pressed = filter.parties.includes(party.slug);
          return (
            <li key={party.slug} className="shrink-0">
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => go({ ...filter, parties: toggle(filter.parties, party.slug) })}
                title={standingOf(party.slug) ?? undefined}
                className={`${chip(pressed)} pl-1.5`}
              >
                <PartyLogo slug={party.slug} acronym={party.acronym} size={22} />
                {party.acronym}
              </button>
            </li>
          );
        })}
      </ChipRow>

      {sources.length > 0 && (
        <>
          <h2 className="mb-3 mt-4 font-mono text-xs font-bold uppercase tracking-widest text-muted">Jornais</h2>
          <ChipRow label="Jornais" more="Jornais">
            <li className="shrink-0">
              <button
                type="button"
                aria-pressed={filter.sources.length === 0}
                onClick={() => go({ ...filter, sources: [] })}
                className={chip(filter.sources.length === 0)}
              >
                Todos
              </button>
            </li>
            {sources.map((source) => {
              const pressed = filter.sources.includes(source.domain);
              return (
                <li key={source.domain} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => go({ ...filter, sources: toggle(filter.sources, source.domain) })}
                    className={`${chip(pressed)} pl-1.5`}
                  >
                    <SourceLogo domain={source.domain} name={source.name} size={22} />
                    {source.name}
                  </button>
                </li>
              );
            })}
          </ChipRow>
        </>
      )}

      {(!isEmpty(filter) || saved) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p className="min-w-0 text-sm" aria-live="polite">
            {isEmpty(filter) ? (
              <span className="text-muted">A mostrar tudo. O teu feed guardado abre quando voltas à página inicial.</span>
            ) : (
              <>
                {isSaved && <b>O teu feed: </b>}
                <span className="text-muted">
                  {partyNames.length > 0 ? partyNames.join(", ") : "Todos os partidos"} ·{" "}
                  {sourceNames.length > 0 ? sourceNames.join(", ") : "todos os jornais"}
                </span>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
            {!isEmpty(filter) && !isSaved && (
              <button type="button" onClick={() => save(filter)} className="rounded-full bg-ink px-3 py-1.5 text-paper hover:opacity-90">
                Guardar como o meu feed
              </button>
            )}
            {saved && (isSaved || isEmpty(filter)) && (
              <button type="button" onClick={() => save(null)} className="rounded-full border border-line px-3 py-1.5 hover:bg-surface">
                Esquecer o meu feed
              </button>
            )}
            {!isEmpty(filter) && (
              <button
                type="button"
                onClick={() => go({ parties: [], sources: [] })}
                className="rounded-full border border-line px-3 py-1.5 hover:bg-surface"
              >
                Ver tudo
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
