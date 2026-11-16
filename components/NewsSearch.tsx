"use client";

import Link from "next/link";
import { filterQuery, type FeedFilter } from "@/lib/feedFilter";

type Props = { q: string; filter: FeedFilter };

/**
 * A plain GET form for words, so it works before the page's script loads. The parties and outlets chosen above ride
 * along as hidden fields, so a search stays within them.
 */
export function NewsSearch({ q, filter }: Props) {
  const clear = filterQuery(filter);
  return (
    <form role="search" action="/" method="get" className="mb-4 flex flex-wrap items-center gap-2">
      {filter.parties.length > 0 && <input type="hidden" name="partido" value={filter.parties.join(",")} />}
      {filter.sources.length > 0 && <input type="hidden" name="fonte" value={filter.sources.join(",")} />}
      <label className="relative min-w-0 flex-[1_1_16rem]">
        <span className="sr-only">Procurar nas notícias</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        >
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder="Procurar nas notícias, ex.: «habitação»"
          className="h-10 w-full rounded-full border border-line bg-paper pl-9 pr-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </label>
      <button type="submit" className="h-10 rounded-full border border-ink px-4 font-mono text-xs font-bold hover:bg-surface">
        Procurar
      </button>
      {q && (
        <Link href={clear ? `/?${clear}` : "/"} className="font-mono text-xs text-muted underline hover:text-ink">
          Limpar
        </Link>
      )}
    </form>
  );
}
