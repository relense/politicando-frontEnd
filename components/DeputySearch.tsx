"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { fold } from "@/lib/format";
import type { DeputySummary, ParliamentGroup } from "@/lib/types";
import { DeputyPortrait } from "./DeputyProfile";

const LIMIT = 8;

/**
 * Find a deputy by name (or círculo) without hunting for their seat. Picking one opens their card beside the
 * map, as pressing their seat would. A combobox: arrows move through the matches, Enter opens, Escape clears.
 */
export function DeputySearch({
  deputies,
  groups,
  onPick,
}: {
  deputies: DeputySummary[];
  groups: Map<string, ParliamentGroup>;
  onPick: (id: number) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return deputies
      .filter((deputy) => {
        const text = fold(`${deputy.name} ${deputy.constituency}`);
        return words.every((word) => text.includes(word));
      })
      .slice(0, LIMIT);
  }, [deputies, query]);

  const showList = open && query.trim().length > 0;
  const current = Math.min(active, Math.max(matches.length - 1, 0));

  function pick(deputy: DeputySummary) {
    onPick(deputy.id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length === 0) return;
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      const chosen = matches[current];
      if (showList && chosen) {
        event.preventDefault();
        pick(chosen);
      }
    } else if (event.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="sr-only">
        Procurar deputado
      </label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-activedescendant={showList && matches[current] ? `${id}-${matches[current]!.id}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Procurar deputado pelo nome"
        className="h-10 w-full rounded-full border border-line bg-paper px-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
      />
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Deputados encontrados"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-2xl border border-line bg-paper p-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-muted">
              Nenhum deputado com esse nome.
            </li>
          ) : (
            matches.map((deputy, index) => {
              const party = deputy.partySlug ? groups.get(deputy.partySlug)?.party.acronym : null;
              return (
                <li
                  key={deputy.id}
                  id={`${id}-${deputy.id}`}
                  role="option"
                  aria-selected={index === current}
                  // Before the input's blur closes the list.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(deputy)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 ${index === current ? "bg-surface" : ""}`}
                >
                  <DeputyPortrait deputy={deputy} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold leading-snug">{deputy.name}</span>
                    <span className="block truncate font-mono text-xs text-muted">
                      {[party ?? deputy.group, deputy.constituency].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
