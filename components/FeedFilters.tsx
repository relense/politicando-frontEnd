"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import {
  COMMENTED_HOURS,
  FEED_COOKIE,
  FEED_COOKIE_MAX_AGE,
  filterQuery,
  isEmpty,
  sameFilter,
  serializeFilter,
  toggle,
  type FeedFilter,
  type FeedSort,
} from "@/lib/feedFilter";
import { useQuery } from "@tanstack/react-query";
import { getFeedPage } from "@/lib/api/client";
import { fold, formatNumber } from "@/lib/format";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";
import { PartyOrderToggle, useOrderedParties } from "./PartyOrder";
import { SourceLogo } from "./SourceLogo";

type Source = { domain: string; name: string; count: number };

type Props = {
  parties: Party[];
  sources: Source[];
  filter: FeedFilter;
  /** The reader's saved feed, if any; the front page opens with it. */
  saved: FeedFilter | null;
  q: string;
  sort: FeedSort;
};

const pill = (pressed: boolean) =>
  `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border pl-1 pr-2.5 font-mono text-xs font-bold ${
    pressed ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
  }`;

/** A button that opens a panel below it; closes on Escape, on a click outside, or when the choice is applied. */
function Dropdown({
  label,
  count,
  title,
  children,
}: {
  label: string;
  count: number;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="sm:relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={`flex h-10 items-center gap-2 rounded-full border px-3 font-mono text-xs font-bold sm:px-4 ${
          count > 0 || open ? "border-ink" : "border-line hover:bg-surface"
        }`}
      >
        {label}
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--marker)] text-[10px] text-ink">
            {count}
            <span className="sr-only"> escolhidos</span>
          </span>
        )}
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-3.5 fill-none stroke-current stroke-2 ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={title}
          className="absolute inset-x-0 z-30 mt-2 rounded-2xl border border-line bg-paper p-4 shadow-xl sm:left-auto sm:right-0 sm:w-[34rem]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A choice in a panel: a checkbox row with the icon, the name and a number. */
function CheckRow({
  checked,
  onChange,
  icon,
  label,
  note,
}: {
  checked: boolean;
  onChange: () => void;
  icon: ReactNode;
  label: string;
  note?: string | number | null;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-xs font-bold ${
        checked ? "border-ink bg-surface" : "border-line hover:bg-surface"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="size-3.5 accent-[var(--ink)]" />
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {note !== undefined && note !== null && <span className="font-normal text-muted">{note}</span>}
    </label>
  );
}

/** How many articles a choice would show, asked of the API as the boxes are ticked; null while unknown. */
function useMatchCount(filter: FeedFilter, q: string, sort: FeedSort): number | null {
  const { data } = useQuery({
    queryKey: ["feed-count", filter.parties.join(","), filter.sources.join(","), q, sort],
    queryFn: async () =>
      (
        await getFeedPage({
          party: filter.parties,
          source: filter.sources,
          q,
          limit: 1,
          ...(sort === "comentadas" ? { sort: "comments" as const, since: COMMENTED_HOURS } : {}),
        })
      ).total ?? null,
    staleTime: 60_000,
  });
  return data ?? null;
}

const showLabel = (count: number | null) =>
  count === null ? "Mostrar notícias" : count === 1 ? "Mostrar 1 notícia" : `Mostrar ${formatNumber(count)} notícias`;

function PanelFooter({
  onClear,
  clearLabel,
  onApply,
  count,
}: {
  onClear: () => void;
  clearLabel: string;
  onApply: () => void;
  count: number | null;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
      <button type="button" onClick={onClear} className="font-mono text-xs text-muted underline hover:text-ink">
        {clearLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-full bg-ink px-4 py-2 font-mono text-xs font-bold text-paper hover:opacity-90"
      >
        {showLabel(count)}
      </button>
    </div>
  );
}

const heading = "mb-2 mt-4 font-mono text-[11px] font-bold uppercase tracking-widest text-muted first:mt-0";

type PanelProps = { chosen: string[]; onApply: (values: string[]) => void; filter: FeedFilter; q: string; sort: FeedSort };

function PartiesPanel({ parties, chosen, onApply, filter, q, sort }: PanelProps & { parties: Party[] }) {
  const { ordered, seatsOf } = useOrderedParties(parties);
  const [draft, setDraft] = useState(chosen);
  const count = useMatchCount({ ...filter, parties: draft }, q, sort);
  const [query, setQuery] = useState("");
  const words = fold(query.trim());
  const shown = ordered.filter((party) => !words || fold(`${party.acronym} ${party.name}`).includes(words));
  const seated = shown.filter((party) => (seatsOf(party.slug) ?? 1) > 0);
  const others = shown.filter((party) => (seatsOf(party.slug) ?? 1) === 0);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Procurar partido"
          aria-label="Procurar partido"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 font-mono text-xs"
        />
        <PartyOrderToggle />
      </div>
      <div className="mt-4 max-h-[55vh] overflow-y-auto overscroll-contain">
        {seated.length > 0 && (
          <fieldset>
            <legend className={heading}>{others.length > 0 ? `Com deputados · ${seated.length}` : `Partidos · ${seated.length}`}</legend>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {seated.map((party) => (
                <CheckRow
                  key={party.slug}
                  checked={draft.includes(party.slug)}
                  onChange={() => setDraft(toggle(draft, party.slug))}
                  icon={<PartyLogo slug={party.slug} acronym={party.acronym} size={18} />}
                  label={party.acronym}
                  note={seatsOf(party.slug)}
                />
              ))}
            </div>
          </fieldset>
        )}
        {others.length > 0 && (
          <fieldset className="mt-4">
            <legend className={heading}>Sem deputados · {others.length}</legend>
            <div className="flex flex-wrap gap-1.5">
              {others.map((party) => {
                const checked = draft.includes(party.slug);
                return (
                  <label key={party.slug} className={`${pill(checked)} cursor-pointer`}>
                    <input type="checkbox" checked={checked} onChange={() => setDraft(toggle(draft, party.slug))} className="sr-only" />
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
                    {party.acronym}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {shown.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhum partido com esse nome.</p>}
      </div>
      <PanelFooter onClear={() => setDraft([])} clearLabel="Limpar partidos" onApply={() => onApply(draft)} count={count} />
    </>
  );
}

function SourcesPanel({ sources, chosen, onApply, filter, q, sort }: PanelProps & { sources: Source[] }) {
  const [draft, setDraft] = useState(chosen);
  const count = useMatchCount({ ...filter, sources: draft }, q, sort);
  const [query, setQuery] = useState("");
  const words = fold(query.trim());
  const shown = sources.filter((source) => !words || fold(`${source.name} ${source.domain}`).includes(words));
  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Procurar jornal"
        aria-label="Procurar jornal"
        className="h-9 w-full rounded-lg border border-line bg-paper px-3 font-mono text-xs"
      />
      <fieldset className="mt-4 max-h-[55vh] overflow-y-auto overscroll-contain">
        <legend className={heading}>Jornais · {sources.length}</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {shown.map((source) => (
            <CheckRow
              key={source.domain}
              checked={draft.includes(source.domain)}
              onChange={() => setDraft(toggle(draft, source.domain))}
              icon={<SourceLogo domain={source.domain} name={source.name} size={18} />}
              label={source.name}
              note={source.count > 0 ? source.count.toLocaleString("pt-PT") : null}
            />
          ))}
        </div>
        {shown.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhum jornal com esse nome.</p>}
      </fieldset>
      <PanelFooter onClear={() => setDraft([])} clearLabel="Limpar jornais" onApply={() => onApply(draft)} count={count} />
    </>
  );
}

/**
 * The news toolbar: words, parties and papers (any number of each), and the order. The parties in Parliament are also
 * one tap away below it. The choice can be saved as the reader's own feed, which the front page then opens with (kept
 * in a cookie, never sent anywhere else).
 */
export function FeedFilters({ parties, sources, filter, saved, q, sort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const { ordered, seatsOf } = useOrderedParties(parties);
  const isSaved = saved !== null && sameFilter(filter, saved);
  const quick = ordered.filter((party) => (seatsOf(party.slug) ?? 0) > 0);

  const go = (next: FeedFilter, extra: { q?: string; sort?: FeedSort } = {}) => {
    const words = extra.q ?? q;
    const order = extra.sort ?? sort;
    // With a saved feed, "everything" needs saying, or the front page would open the saved one again.
    const query = filterQuery(next, {
      q: words,
      ordem: order === "comentadas" ? "comentadas" : "",
      ...(isEmpty(next) && saved ? { tudo: "1" } : {}),
    });
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const save = (value: FeedFilter | null) => {
    document.cookie = value
      ? `${FEED_COOKIE}=${encodeURIComponent(serializeFilter(value))}; Max-Age=${FEED_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
      : `${FEED_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    startTransition(() => router.refresh());
  };

  const partyOf = (slug: string) => parties.find((party) => party.slug === slug);
  const sourceOf = (domain: string) => sources.find((source) => source.domain === domain);

  return (
    <nav aria-label="Filtrar notícias" className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          action="/"
          method="get"
          className="relative min-w-0 basis-full sm:flex-[1_1_18rem]"
          onSubmit={(event) => {
            event.preventDefault();
            const words = String(new FormData(event.currentTarget).get("q") ?? "").trim();
            go(filter, { q: words });
          }}
        >
          {filter.parties.length > 0 && <input type="hidden" name="partido" value={filter.parties.join(",")} />}
          {filter.sources.length > 0 && <input type="hidden" name="fonte" value={filter.sources.join(",")} />}
          <label>
            <span className="sr-only">Procurar nas notícias</span>
            <input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Procurar nas notícias, ex.: «habitação»"
              className="h-10 w-full rounded-full border border-line bg-paper pl-10 pr-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>
          <button
            type="submit"
            aria-label="Procurar"
            className="absolute left-1 top-1 flex size-8 items-center justify-center rounded-full text-muted hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        {parties.length > 0 && (
          <Dropdown label="Partidos" count={filter.parties.length} title="Escolher partidos">
            {(close) => (
              <PartiesPanel
                parties={parties}
                chosen={filter.parties}
                filter={filter}
                q={q}
                sort={sort}
                onApply={(next) => {
                  close();
                  go({ ...filter, parties: next });
                }}
              />
            )}
          </Dropdown>
        )}
        {sources.length > 0 && (
          <Dropdown label="Jornais" count={filter.sources.length} title="Escolher jornais">
            {(close) => (
              <SourcesPanel
                sources={sources}
                chosen={filter.sources}
                filter={filter}
                q={q}
                sort={sort}
                onApply={(next) => {
                  close();
                  go({ ...filter, sources: next });
                }}
              />
            )}
          </Dropdown>
        )}
        {/* On a phone the order is a small menu, so it fits on the row with Partidos and Jornais. */}
        <div className="ml-auto sm:hidden">
          <Dropdown label={sort === "comentadas" ? "Comentadas" : "Recentes"} count={0} title="Ordenar notícias">
            {(close) => (
              <div role="group" aria-label="Ordenar notícias" className="flex flex-col gap-1 font-mono text-xs font-bold">
                {(
                  [
                    ["recentes", "Recentes", "As mais recentes primeiro"],
                    ["comentadas", "Mais comentadas", "As mais comentadas dos últimos 7 dias"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={sort === value}
                    onClick={() => {
                      close();
                      go(filter, { sort: value });
                    }}
                    className={`rounded-xl px-3 py-2.5 text-left ${sort === value ? "bg-ink text-paper" : "hover:bg-surface"}`}
                  >
                    {label}
                    <span className="block font-normal opacity-70">{hint}</span>
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
        </div>
        <div
          role="group"
          aria-label="Ordenar notícias"
          className="hidden h-10 overflow-hidden rounded-full border border-line font-mono text-xs font-bold sm:flex"
        >
          {(
            [
              ["recentes", "Recentes"],
              ["comentadas", "Mais comentadas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => go(filter, { sort: value })}
              className={`px-4 ${sort === value ? "bg-ink text-paper" : "hover:bg-surface"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {quick.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-muted">Com deputados</span>
          <ul aria-label="Partidos com deputados" className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
            {quick.map((party) => {
              const pressed = filter.parties.includes(party.slug);
              return (
                <li key={party.slug} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => go({ ...filter, parties: toggle(filter.parties, party.slug) })}
                    className={pill(pressed)}
                  >
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={22} />
                    {party.acronym}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(!isEmpty(filter) || saved) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-line py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {isEmpty(filter) ? (
              <span className="text-sm text-muted">A mostrar tudo. O teu feed abre quando voltas à página inicial.</span>
            ) : (
              <>
                {isSaved && <span className="mr-1 font-mono text-xs font-bold">★ O teu feed</span>}
                <ul aria-label="Filtros escolhidos" className="flex flex-wrap gap-1.5">
                  {filter.parties.map((slug) => {
                    const party = partyOf(slug);
                    return (
                      <li key={slug}>
                        <button
                          type="button"
                          onClick={() => go({ ...filter, parties: filter.parties.filter((item) => item !== slug) })}
                          className={pill(false)}
                        >
                          <PartyLogo slug={slug} acronym={party?.acronym ?? slug} size={20} />
                          <span>
                            <span className="sr-only">Tirar </span>
                            {party?.acronym ?? slug}
                          </span>
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    );
                  })}
                  {filter.sources.map((domain) => {
                    const source = sourceOf(domain);
                    return (
                      <li key={domain}>
                        <button
                          type="button"
                          onClick={() => go({ ...filter, sources: filter.sources.filter((item) => item !== domain) })}
                          className={pill(false)}
                        >
                          <SourceLogo domain={domain} name={source?.name ?? domain} size={20} />
                          <span>
                            <span className="sr-only">Tirar </span>
                            {source?.name ?? domain}
                          </span>
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => go({ parties: [], sources: [] })}
                  className="ml-1 font-mono text-xs text-muted underline hover:text-ink"
                >
                  Limpar tudo
                </button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
            {!isEmpty(filter) && !isSaved && (
              <button type="button" onClick={() => save(filter)} className="rounded-full border border-ink px-3 py-1.5 hover:bg-surface">
                ☆ Guardar como o meu feed
              </button>
            )}
            {saved && (isSaved || isEmpty(filter)) && (
              <button type="button" onClick={() => save(null)} className="rounded-full border border-line px-3 py-1.5 hover:bg-surface">
                Esquecer o meu feed
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
