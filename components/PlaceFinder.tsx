"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fold } from "@/lib/format";

export type FinderPlace = { key: string; name: string; href: string; mayor: string | null; party: string | null; color: string | null };
export type FinderGroup = { key: string; name: string; href: string; places: FinderPlace[] };

/** Every municipality by district, with its mayor, and a box to find one by name. */
export function PlaceFinder({ groups }: { groups: FinderGroup[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return groups;
    return groups
      .map((group) => ({
        ...group,
        places: group.places.filter((place) => {
          const text = fold(`${place.name} ${group.name} ${place.mayor ?? ""}`);
          return words.every((word) => text.includes(word));
        }),
      }))
      .filter((group) => group.places.length > 0);
  }, [groups, query]);
  const count = shown.reduce((sum, group) => sum + group.places.length, 0);

  return (
    <div>
      <label className="mb-2 block">
        <span className="sr-only">Procurar concelho</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Procurar concelho, distrito ou presidente"
          className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm placeholder:text-muted focus:border-ink focus:outline-none sm:max-w-md"
        />
      </label>
      <p className="mb-6 font-mono text-xs text-muted" aria-live="polite">
        {query ? `${count} ${count === 1 ? "concelho encontrado" : "concelhos encontrados"}` : ""}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhum concelho com esse nome.</p>
      ) : (
        <div className="columns-1 gap-8 sm:columns-2 lg:columns-3">
          {shown.map((group) => (
            <section key={group.key} aria-labelledby={`distrito-${group.key}`} className="mb-6 break-inside-avoid">
              <h3
                id={`distrito-${group.key}`}
                className="mb-1 border-b border-line pb-1 font-mono text-xs font-bold uppercase tracking-widest"
              >
                <Link prefetch={false} href={group.href} className="hover:underline">
                  {group.name}
                </Link>
              </h3>
              <ul>
                {group.places.map((place) => (
                  <li key={place.key}>
                    <Link prefetch={false} href={place.href} className="-mx-2 flex items-baseline gap-2 rounded px-2 py-1 hover:bg-surface">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 self-center rounded-sm"
                        style={{ backgroundColor: place.color ?? "var(--line)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">{place.name}</span>
                        {place.mayor && <span className="block truncate text-xs text-muted">{place.mayor}</span>}
                      </span>
                      {place.party && <span className="shrink-0 font-mono text-[11px] font-bold">{place.party}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
