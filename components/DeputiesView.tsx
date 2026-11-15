"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeputySummary, ParliamentGroup } from "@/lib/types";
import { DeputyCard } from "./DeputyPanel";
import { DeputyPortrait } from "./DeputyProfile";

type Props = {
  deputies: DeputySummary[];
  groups: ParliamentGroup[];
  /** The deputy in the address (`?deputado=`), if any. */
  initialDeputy: number | null;
};

/** Lowercase without accents, so "joao" finds "João". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** The width at which the card sits beside the grid instead of over it. */
const WIDE = "(min-width: 1280px)";

/**
 * Every deputy as a grid, with their summary in a card beside it, as on the Parliament page. Pressing a deputy
 * opens the card; the full record is one more press away. On smaller screens the card slides over the grid.
 */
export function DeputiesView({ deputies, groups, initialDeputy }: Props) {
  const byId = useMemo(() => new Map(deputies.map((deputy) => [deputy.id, deputy])), [deputies]);
  const partyOf = useMemo(() => new Map(groups.map((group) => [group.party.slug, group.party])), [groups]);
  const [selected, setSelected] = useState<number | null>(() => (initialDeputy !== null && byId.has(initialDeputy) ? initialDeputy : null));
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const deputy = selected !== null ? (byId.get(selected) ?? null) : null;
  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return deputies;
    return deputies.filter((item) => {
      const text = fold(`${item.name} ${item.constituency ?? ""}`);
      return words.every((word) => text.includes(word));
    });
  }, [deputies, query]);

  function choose(id: number | null) {
    setSelected(id);
    // Keeps the choice in the address so it can be shared, without a history entry per press.
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete("deputado");
    else url.searchParams.set("deputado", String(id));
    window.history.replaceState(window.history.state, "", url);
  }

  function open(id: number, button: HTMLElement) {
    opener.current = button;
    choose(id);
  }

  function close() {
    choose(null);
    opener.current?.focus();
  }

  // When the card opens over the grid, take focus there and let Escape close it.
  useEffect(() => {
    if (!deputy) return;
    const wide = window.matchMedia(WIDE).matches;
    const heading = panel.current?.querySelector<HTMLElement>("#deputado-nome");
    if (heading && !wide) {
      heading.tabIndex = -1;
      heading.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !window.matchMedia(WIDE).matches) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when another deputy opens
  }, [deputy?.id]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <label className="mb-4 block">
          <span className="sr-only">Procurar deputado</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar por nome ou círculo"
            className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm placeholder:text-muted focus:border-ink focus:outline-none sm:max-w-sm"
          />
        </label>
        <p className="sr-only" aria-live="polite">
          {query ? `${shown.length} ${shown.length === 1 ? "deputado encontrado" : "deputados encontrados"}` : ""}
        </p>

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhum deputado com esse nome.</p>
        ) : (
          <ul aria-label="Deputados" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((item) => {
              const party = item.partySlug ? partyOf.get(item.partySlug) : undefined;
              const active = item.id === selected;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={(event) => open(item.id, event.currentTarget)}
                    className={`flex h-full w-full items-center gap-4 rounded-2xl border p-4 text-left hover:bg-surface ${
                      active ? "border-ink bg-surface" : "border-line"
                    }`}
                  >
                    <DeputyPortrait deputy={item} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-bold leading-snug">{item.name}</span>
                      <span className="block font-mono text-xs text-muted">
                        <span className="font-bold text-ink">{party?.acronym ?? item.group}</span> · {item.constituency}
                      </span>
                      {item.role && <span className="block text-xs text-muted">{item.role}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Beside the grid on a large screen, sticky as the grid scrolls; over it on smaller ones, only while open. */}
      <div
        ref={panel}
        className={
          deputy ? "fixed inset-0 z-40 flex justify-end bg-ink/40 xl:static xl:z-auto xl:block xl:bg-transparent" : "hidden xl:block"
        }
        onClick={(event) => {
          if (event.target === event.currentTarget && deputy) close();
        }}
      >
        <div className="h-full w-full max-w-md p-3 sm:p-4 xl:sticky xl:top-20 xl:h-[calc(100vh-6rem)] xl:max-w-none xl:p-0">
          {deputy ? (
            <DeputyCard key={deputy.id} summary={deputy} group={null} onBack={() => undefined} onClose={close} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-muted">
              <p className="font-bold text-ink">Carrega num deputado</p>
              <p className="mt-1 text-sm">para ver quem é, o que propôs, como votou e o que dizem as notícias.</p>
              <Link href="/parlamento" className="mt-4 font-mono text-sm text-link underline">
                Ver no hemiciclo
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
