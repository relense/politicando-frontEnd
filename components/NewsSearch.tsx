"use client";

import Link from "next/link";
import { useRef } from "react";

type Props = {
  q: string;
  source: string;
  partySlug: string | null;
  /** Domains with their display names, most articles first. */
  sources: { domain: string; name: string }[];
};

/**
 * A plain GET form, so it works before the page's script loads: the words go in `q`, the outlet in `fonte`.
 * Picking an outlet sends the form straight away.
 */
export function NewsSearch({ q, source, partySlug, sources }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const searching = Boolean(q || source);
  const clear = partySlug ? `/?partido=${encodeURIComponent(partySlug)}` : "/";
  return (
    <form ref={form} role="search" action="/" method="get" className="mb-4 flex flex-wrap items-center gap-2">
      {partySlug && <input type="hidden" name="partido" value={partySlug} />}
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
      {sources.length > 0 && (
        <label className="flex-[0_1_12rem]">
          <span className="sr-only">Fonte</span>
          <select
            name="fonte"
            defaultValue={source}
            onChange={() => form.current?.requestSubmit()}
            className="h-10 w-full rounded-full border border-line bg-paper px-4 font-mono text-xs focus:border-ink focus:outline-none"
          >
            <option value="">Todas as fontes</option>
            {sources.map((item) => (
              <option key={item.domain} value={item.domain}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="h-10 rounded-full border border-ink px-4 font-mono text-xs font-bold hover:bg-surface">
        Procurar
      </button>
      {searching && (
        <Link href={clear} className="font-mono text-xs text-muted underline hover:text-ink">
          Limpar
        </Link>
      )}
    </form>
  );
}
